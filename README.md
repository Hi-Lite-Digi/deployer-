# Deployer

A self-hosted app deployment platform. Connect GitHub, import a repository and deploy it.
Every push to the selected production branch rebuilds the app and publishes the update.

This fork focuses on hosting apps, with the former database-as-a-service features removed from
the dashboard and disabled in the default API. MariaDB stores the platform's own accounts,
projects and deployment history; Redis queues builds. No Supabase account or service is required.

## What it does

- GitHub connection and repository picker, including private repositories you authorize.
- Automatic detection for static sites, Node.js, Python and Dockerfile projects.
- Production branch and monorepo root settings, encrypted environment variables and build logs.
- Signed GitHub push webhooks, durable delivery receipts and queued build coalescing.
- Replacement containers routed through Caddy after a startup check. A failed build keeps the
  previous version live. Deployment history, runtime logs and rollbacks are included.
- Accounts, project roles and team invitations. Instance owners control public signups.
- Custom domains and public HTTPS through your own Cloudflare tunnel.
- Optional AWS or Firebase hosting targets for individual apps.

## Run on AWS

Follow [the EC2 hosting guide](docs/AWS_HOSTING.md). On an EC2 Linux server with Git, Python 3,
Docker Engine and Compose installed:

```bash
git clone https://github.com/Hi-Lite-Digi/deployer-.git
cd deployer-
sudo bash deploy/aws/start.sh
```

Open an SSH tunnel to port 8080, finish setup at `http://localhost:8080/setup`, configure a public
HTTPS domain, and register your GitHub OAuth app in Instance settings. Create a project and connect
your repository. The first deployment starts from **Create & deploy**; later branch pushes update it.
GitHub connection credentials, AWS credentials and generated secrets are never committed.

The platform runs on one Docker host. Connected repositories execute build code on that host;
use it for repositories from people you trust. It is not a sandbox for arbitrary public tenants.
The server must stay running to receive webhooks and deploy updates.

## Develop

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r api/requirements-dev.txt
npm ci --prefix dashboard
npm run dev --prefix dashboard
```

Run the API and supporting services with Docker Compose; the development override mounts the
API source and enables reload:

```bash
python deploy/aws/configure.py
docker compose --env-file deploy/.env -f deploy/docker-compose.yml -f deploy/docker-compose.dev.yml up --build
```

The dashboard dev server proxies `/v1` to the local Compose gateway (see `dashboard/vite.config.ts`).
For a dashboard-only production build: `npm run build --prefix dashboard`.

## Validate

```powershell
.\.venv\Scripts\python.exe -m pytest api/tests
.\.venv\Scripts\ruff.exe check api
.\.venv\Scripts\ruff.exe format --check api
npm run test --prefix dashboard -- --run
npm run lint --prefix dashboard
npm run build --prefix dashboard
```

The service test suite retains coverage of historical database features for migration compatibility.
`api/tests/test_hosting_mode.py` exercises the current production API and GitHub deployment flow.
Container integration tests require a running Docker daemon; AWS deployment requires your account,
region, server access and domain. No AWS resources are created by changing or pushing this repository.

## Documentation

- [AWS hosting and GitHub push-to-deploy setup](docs/AWS_HOSTING.md)
- [Full documentation index and historical guides](docs/README.md)

## Roadmap

1. Hosting foundation: repository import, automatic push deployments and a hosting dashboard.
2. AWS launch *(current)*: deploy EC2, configure HTTPS and GitHub OAuth, and verify real repository pushes.
3. Operations: validate backup recovery, monitor capacity and strengthen isolation before supporting public tenants.

## Security

Use trusted repositories and keep server credentials and `deploy/.env` private. Follow
[SECURITY.md](SECURITY.md) for vulnerability reporting and the
[AWS hosting guide](docs/AWS_HOSTING.md) for server access and network configuration.

## Compatibility

Legacy service code and metadata migrations are retained to avoid destroying existing installations.
`LEGACY_BAAS_ENABLED=false` is the production default. The current dashboard contains no database
management, SQL console, schema browser, data API keys or co-hosting controls. Apps use external
services through their environment variables. Older documents and installers are retained as historical
references; use [AWS_HOSTING.md](docs/AWS_HOSTING.md) for this fork.

See [LICENSE](LICENSE) for the original project's license and attribution.
