"""Create an EC2 hosting configuration; never print secrets or overwrite an install."""

import argparse
import base64
import os
import secrets
from pathlib import Path
from urllib.parse import urlsplit


def configure(destination: Path, public_url: str) -> None:
    url = urlsplit(public_url)
    if url.scheme not in {"http", "https"} or not url.hostname or url.username or url.password:
        raise ValueError("Use an http(s) public URL without credentials")
    if url.path not in {"", "/"} or url.query or url.fragment or any(c.isspace() for c in public_url):
        raise ValueError("The public URL must contain only a scheme, host and optional port")
    template = Path(__file__).resolve().parents[1] / ".env.example"
    values = {
        "PUBLIC_URL": public_url.rstrip("/"),
        "LEGACY_BAAS_ENABLED": "false",
        "COMPOSE_PROFILES": "",
        "MANAGED_MONGODB_ENABLED": "false",
        "DEPLOYER_BIND": "127.0.0.1",
        "DEPLOYER_IMAGE_PREFIX": "deployer",
        "DEPLOYER_VERSION": "local",
        "MARIADB_ROOT_PASSWORD": secrets.token_hex(32),
        "MARIADB_PASSWORD": secrets.token_hex(32),
        "MONGO_ROOT_PASSWORD": secrets.token_hex(32),
        "REDIS_PASSWORD": secrets.token_hex(32),
        "JWT_SECRET": secrets.token_urlsafe(48),
        "MASTER_KEY": base64.b64encode(os.urandom(32)).decode(),
    }
    lines = []
    for line in template.read_text(encoding="utf-8").splitlines():
        key = line.partition("=")[0]
        if key in values:
            lines.append(f"{key}={values.pop(key)}")
        else:
            lines.append(line)
    lines += [f"{key}={value}" for key, value in values.items()]
    # O_EXCL prevents a rerun from rotating encryption keys and losing access to stored secrets.
    descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as output:
        output.write("\n".join(lines) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public-url", default="http://localhost:8080")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / ".env")
    args = parser.parse_args()
    try:
        configure(args.output, args.public_url)
    except (ValueError, OSError) as exc:
        parser.exit(1, f"Configuration was not changed: {exc}\n")
    print(f"Created {args.output}. Keep this file private and back it up with your data.")


if __name__ == "__main__":
    main()
