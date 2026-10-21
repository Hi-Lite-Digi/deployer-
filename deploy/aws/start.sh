#!/usr/bin/env bash
# Run on an EC2 Linux host after Docker Engine, Compose v2, Python 3 and Git are installed.
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v python3 >/dev/null || { echo 'Install Python 3 first.' >&2; exit 1; }
docker info >/dev/null
docker compose version >/dev/null
if [ ! -f deploy/.env ]; then
  python3 deploy/aws/configure.py "$@"
elif [ "$#" -gt 0 ]; then
  echo 'An installation already exists. Change its public URL in Instance settings.' >&2
  exit 1
fi
docker compose --env-file deploy/.env -f deploy/docker-compose.yml config --quiet
docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d --build
echo 'Deployer is starting at http://localhost:8080. Use an SSH tunnel to finish setup.'
