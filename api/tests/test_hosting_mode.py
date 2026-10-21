"""Production hosting flow, with the legacy database product disabled."""

import hashlib
import hmac
import json

import pytest
from alembic import command
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select

from app.config import get_settings
from app.models import DataSource, Deployment, GitHubDelivery
from app.services import deployments, jobs
from tests.apps_support import make_app


@pytest.fixture
def hosting_client(monkeypatch):
    from app.main import create_app

    monkeypatch.setattr(get_settings(), "legacy_baas_enabled", False)
    with TestClient(create_app()) as client:
        yield client


def push(client, app, sha, *, delivery="delivery-1", **overrides):
    body = json.dumps(
        {
            "ref": "refs/heads/main",
            "after": sha,
            "repository": {"full_name": "acme/shop"},
            "head_commit": {"message": "Update shop"},
            **overrides,
        }
    ).encode()
    signature = hmac.new(deployments.webhook_secret(app).encode(), body, hashlib.sha256).hexdigest()
    return client.post(
        f"/v1/hooks/github/{app.id}",
        content=body,
        headers={
            "X-Hub-Signature-256": f"sha256={signature}",
            "X-GitHub-Event": "push",
            "X-GitHub-Delivery": delivery,
            "Content-Type": "application/json",
        },
    )


def test_new_member_can_create_hosting_project(hosting_client, make_user, owner, auth_headers, db):
    user = make_user()
    response = hosting_client.post("/v1/projects", json={"name": "Shop"}, headers=auth_headers(user))
    assert response.status_code == 200, response.text
    assert db.scalar(select(DataSource)) is None
    denied = hosting_client.post(
        "/v1/projects",
        json={
            "name": "Database",
            "provision": {"sql": True},
        },
        headers=auth_headers(owner),
    )
    assert denied.status_code == 422


def test_database_apis_are_absent(hosting_client):
    paths = hosting_client.get("/v1/openapi.json").json()["paths"]
    assert "/v1/projects/{project_id}/apps" in paths
    assert "/v1/hooks/github/{app_id}" in paths
    assert "/v1/instance/cloud" in paths
    removed = (
        "data-sources",
        "/schema",
        "/query",
        "/backups",
        "/api-keys",
        "/mcp",
        "/devices",
        "/transfer",
        "/cloud/databases",
    )
    assert not [path for path in paths if any(part in path for part in removed)]


def test_cloud_setup_does_not_request_database_permissions(hosting_client, owner, auth_headers):
    response = hosting_client.get("/v1/instance/cloud/requirements", headers=auth_headers(owner))
    assert response.status_code == 200
    requirements = response.json()
    assert "DeployerDatabases" not in {p["name"] for p in requirements["aws"]["policies"]}
    assert "DeployerHosting" in {p["name"] for p in requirements["aws"]["policies"]}
    assert "roles/datastore.user" not in {r["role"] for r in requirements["firebase"]["roles"]}


@pytest.mark.parametrize("feature,value", [("database_access", True), ("api_key_id", "key"), ("cohost", True)])
def test_database_attachment_is_rejected(hosting_client, owner, make_project, auth_headers, feature, value):
    project = make_project(owner)
    response = hosting_client.post(
        f"/v1/projects/{project.id}/apps",
        headers=auth_headers(owner),
        json={
            "name": "Shop",
            "repo_url": "https://github.com/acme/shop",
            "preset": "node",
            feature: value,
        },
    )
    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "database_hosting_removed"


def test_push_replaces_live_app_and_failed_update_keeps_it(hosting_client, db, owner, make_project, docker):
    app = make_app(db, make_project(owner))
    first = push(hosting_client, app, "a" * 40)
    assert first.status_code == 202, first.text
    jobs.run_queued()
    db.expire_all()
    previous = db.get(Deployment, first.json()["deployment_id"])
    assert previous.status == "live"
    second = push(hosting_client, app, "b" * 40, delivery="delivery-2")
    assert second.status_code == 202
    jobs.run_queued()
    db.expire_all()
    current = db.get(Deployment, second.json()["deployment_id"])
    assert current.status == "live" and previous.status == "superseded"
    assert ("checkout", "b" * 40) in docker.calls
    assert app.live_deployment_id == current.id
    live_container = current.container_name
    docker.fail_at = "build"
    failed = push(hosting_client, app, "c" * 40, delivery="delivery-3")
    jobs.run_queued()
    db.expire_all()
    assert db.get(Deployment, failed.json()["deployment_id"]).status == "failed"
    assert app.live_deployment_id == current.id
    assert live_container in docker.containers


def test_redelivery_cannot_replace_newer_queued_push(hosting_client, db, owner, make_project):
    app = make_app(db, make_project(owner))
    assert push(hosting_client, app, "a" * 40).status_code == 202
    newest = push(hosting_client, app, "b" * 40, delivery="delivery-2")
    assert newest.status_code == 202
    assert push(hosting_client, app, "a" * 40).json() == {"ignored": True}
    db.expire_all()
    assert db.get(Deployment, newest.json()["deployment_id"]).commit_sha == "b" * 40
    assert len(db.scalars(select(GitHubDelivery)).all()) == 2


@pytest.mark.parametrize(
    "overrides",
    [
        {"ref": "refs/heads/other"},
        {"ref": "refs/tags/v1"},
        {"deleted": True},
        {"after": "bad-sha"},
        {"after": "0" * 40},
        {"repository": {"full_name": "someone/else"}},
    ],
)
def test_unrelated_pushes_are_ignored(hosting_client, db, owner, make_project, overrides):
    app = make_app(db, make_project(owner))
    assert push(hosting_client, app, "a" * 40, **overrides).json() == {"ignored": True}
    assert db.scalar(select(Deployment)) is None


def test_malformed_commit_metadata_does_not_crash(hosting_client, db, owner, make_project):
    app = make_app(db, make_project(owner))
    assert push(hosting_client, app, "a" * 40, head_commit="invalid").status_code == 202


def test_delivery_migration_upgrade_and_downgrade(migration_db):
    cfg, path = migration_db
    command.upgrade(cfg, "head")
    engine = create_engine(f"sqlite:///{path.as_posix()}")
    try:
        assert "github_deliveries" in inspect(engine).get_table_names()
        command.downgrade(cfg, "0014")
        assert "github_deliveries" not in inspect(engine).get_table_names()
    finally:
        engine.dispose()
