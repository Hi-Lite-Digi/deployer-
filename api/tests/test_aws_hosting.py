"""The AWS configuration helper must never rotate an existing install's secrets."""

import base64
import importlib.util
from pathlib import Path

import pytest

_path = Path(__file__).resolve().parents[2] / "deploy" / "aws" / "configure.py"
_spec = importlib.util.spec_from_file_location("aws_hosting_configure", _path)
_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_module)


def test_configuration_is_hosting_only_with_fresh_secrets(tmp_path):
    one, two = tmp_path / "one.env", tmp_path / "two.env"
    for path in (one, two):
        _module.configure(path, "https://deploy.example.com/")
    values = dict(line.split("=", 1) for line in one.read_text().splitlines() if line and not line.startswith("#"))
    assert values["PUBLIC_URL"] == "https://deploy.example.com"
    assert values["DEPLOYER_BIND"] == "127.0.0.1"
    assert values["COMPOSE_PROFILES"] == ""
    assert values["LEGACY_BAAS_ENABLED"] == "false"
    assert values["MANAGED_MONGODB_ENABLED"] == "false"
    assert len(base64.b64decode(values["MASTER_KEY"])) == 32
    assert "dev-only-change-me" not in one.read_text()
    assert one.read_text() != two.read_text()


def test_existing_configuration_is_preserved(tmp_path):
    path = tmp_path / "install.env"
    _module.configure(path, "http://localhost:8080")
    original = path.read_bytes()
    with pytest.raises(FileExistsError):
        _module.configure(path, "https://new.example.com")
    assert path.read_bytes() == original


@pytest.mark.parametrize(
    "url",
    [
        "ftp://deploy.example.com",
        "https://user:secret@example.com",
        "https://example.com/path",
        "https://example.com\nKEY=value",
    ],
)
def test_invalid_public_url_cannot_write_configuration(tmp_path, url):
    path = tmp_path / "install.env"
    with pytest.raises(ValueError):
        _module.configure(path, url)
    assert not path.exists()
