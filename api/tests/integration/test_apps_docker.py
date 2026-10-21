"""Builds and runs a one-file static site through the real Docker CLI (docs/DEPLOYMENTS.md).

Needs a Docker engine plus `git` and `docker` on PATH:
`DEPLOYER_TEST_DOCKER=1 pytest tests/integration/test_apps_docker.py`.
Caddy is not part of the test: the reload is a no-op and the health check runs inside the container.
"""

import hashlib
import hmac
import json
import os
import subprocess

import pytest

from app.config import get_settings
from app.models import App, Deployment
from app.services import app_runner, deployments, jobs

pytestmark = pytest.mark.skipif(os.environ.get("DEPLOYER_TEST_DOCKER") != "1", reason="DEPLOYER_TEST_DOCKER=1 not set")


class HostDockerCli(app_runner.DockerCli):
    """Same commands; the health probe runs inside the container (the test host is not on the app network)."""

    def wait_tcp(self, host, port, timeout):
        import time

        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            probe = subprocess.run(
                ["docker", "exec", host, "wget", "-q", "-O", "-", f"http://127.0.0.1:{port}/"],
                capture_output=True,
                text=True,
            )
            if probe.returncode == 0 and "Hello from Deployer" in probe.stdout:
                return True
            time.sleep(1)
        return False

    def caddy_reload(self):
        pass


def test_static_site_end_to_end(db, tmp_path, monkeypatch, make_user, make_project, client):
    repo = tmp_path / "site"
    repo.mkdir()
    (repo / "index.html").write_text("<h1>Hello from Deployer</h1>", encoding="utf-8")
    git = ["git", "-c", "user.name=t", "-c", "user.email=t@example.com"]
    subprocess.run([*git, "init", "-q", "-b", "main"], cwd=repo, check=True)
    subprocess.run([*git, "add", "."], cwd=repo, check=True)
    subprocess.run([*git, "commit", "-q", "-m", "site"], cwd=repo, check=True)

    monkeypatch.setattr(get_settings(), "caddy_apps_dir", str(tmp_path / "apps"))
    monkeypatch.setattr(get_settings(), "app_network", "bridge")
    cli = HostDockerCli()
    app_runner.set_docker(cli)
    project = make_project(make_user())
    app = App(
        project_id=project.id,
        name="Site",
        slug="site",
        repo_url=repo.as_posix(),
        preset="static",
        port=deployments.allocate_port(db),
    )
    deployments.set_env(app, {})
    deployments.rotate_webhook_secret(app)
    db.add(app)
    db.commit()
    try:
        dep, job = deployments.start_deployment(db, app, trigger="manual", user_id=None)
        db.commit()
        assert jobs.run_job(job.id) == "succeeded", db.get(Deployment, dep.id).log
        db.expire_all()
        dep = db.get(Deployment, dep.id)
        assert dep.status == "live" and dep.commit_sha and (tmp_path / "apps" / f"{app.id}.caddy").exists()
        assert cli.wait_tcp(dep.container_name, 80, 5)
        previous_container = dep.container_name

        def push_commit(message):
            subprocess.run([*git, "add", "."], cwd=repo, check=True)
            subprocess.run([*git, "commit", "-q", "-m", message], cwd=repo, check=True)
            sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo, text=True).strip()
            body = json.dumps({"ref": "refs/heads/main", "after": sha}).encode()
            digest = hmac.new(deployments.webhook_secret(app).encode(), body, hashlib.sha256).hexdigest()
            response = client.post(
                f"/v1/hooks/github/{app.id}",
                content=body,
                headers={
                    "X-GitHub-Event": "push",
                    "X-Hub-Signature-256": f"sha256={digest}",
                    "X-GitHub-Delivery": f"test-{sha}",
                },
            )
            assert response.status_code == 202, response.text
            pushed = db.get(Deployment, response.json()["deployment_id"])
            jobs.run_job(pushed.job_id)
            db.expire_all()
            return db.get(Deployment, pushed.id)

        (repo / "index.html").write_text("<h1>Hello from Deployer - updated</h1>", encoding="utf-8")
        updated = push_commit("Update site")
        assert updated.status == "live", updated.log
        assert app.live_deployment_id == updated.id
        assert cli.wait_tcp(updated.container_name, 80, 5)
        assert all(row["name"] != previous_container for row in cli.list_containers())
        html = subprocess.check_output(
            [
                "docker",
                "exec",
                updated.container_name,
                "wget",
                "-qO-",
                "http://127.0.0.1:80/",
            ],
            text=True,
        )
        assert "Hello from Deployer - updated" in html

        (repo / "Dockerfile").write_text("FROM scratch\nRUN exit 1\n", encoding="utf-8")
        app.preset = "dockerfile"
        db.commit()
        failed = push_commit("Broken build")
        assert failed.status == "failed"
        assert app.live_deployment_id == updated.id
        assert cli.wait_tcp(updated.container_name, 80, 5)
    finally:
        remove = jobs.enqueue(db, type="app.remove", params={"app_id": app.id, "slug": app.slug})
        db.commit()
        jobs.run_job(remove.id)
        app_runner.set_docker(None)
    assert all(row["app"] != app.id for row in cli.list_containers())
