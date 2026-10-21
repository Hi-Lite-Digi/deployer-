# Host Deployer on AWS

This deploys the **Deployer platform itself**. Apps imported by your users then build and run on
that server. You can also connect an AWS account in the dashboard to deploy individual apps to
S3/CloudFront or App Runner using the existing cloud targets.

## Server

Use an x86-64 EC2 instance running Ubuntu 24.04 LTS, with 8 GB RAM and enough encrypted gp3 EBS
storage for source checkouts, Docker images and the platform database. Actual capacity depends on
your builds. Start with a single trusted team; repository builds execute code on the Docker host.
The current worker needs a Docker daemon, so run the platform on EC2. It is not a standalone
App Runner application. This is a single-server installation, not a highly available cluster.

EBS holds Docker volumes across reboots. Configure EBS snapshots or AWS Backup and preserve the
encryption key in `deploy/.env`; replacing or terminating an instance is a separate recovery task.
See [AWS EBS documentation](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/storage_ebs.html).

Install Git, Python 3, [Docker Engine and Compose](https://docs.docker.com/engine/install/ubuntu/).
Allow SSH only from your administration IP in the EC2 security group. Keep ports 8080, 8100-8199,
3306, 6379 and Docker's API closed to the internet. The supplied stack binds browser ports to loopback.
It uses the existing Cloudflare tunnel for public HTTPS without inbound application ports.

## Start

```bash
git clone https://github.com/Hi-Lite-Digi/deployer-.git
cd deployer-
sudo bash deploy/aws/start.sh
```

The script creates `deploy/.env` with fresh secrets, builds images from this checkout, runs migrations
and starts MariaDB (platform metadata), Redis, the API, worker, dashboard, Caddy and tunnel connector.
MongoDB and the query-shell do not start. Configuration is never overwritten on a rerun.

On your computer, open an SSH tunnel (use your own key and EC2 address):

```bash
ssh -L 8080:localhost:8080 ubuntu@YOUR_EC2_ADDRESS
```

Open `http://localhost:8080/setup` and create the instance owner immediately. Under **Instance →
Domains & remote access**, connect Cloudflare and add a dashboard hostname, such as
`deploy.example.com`. Finish GitHub setup only after this stable public HTTPS URL is working.

## GitHub and automatic deployments

1. Create your own GitHub OAuth app with homepage `https://deploy.example.com` and callback
   `https://deploy.example.com/v1/auth/oauth/github/callback`. Enter its client ID and secret under
   **Instance settings → Sign-in apps**. Secrets stay outside Git.
2. If other people should register, enable signups in Instance settings. Hosting installations allow
   members to create their own projects by default; the owner can restrict this explicitly.
3. Create a project, connect your GitHub account and choose a repository. Deployer reads the default
   branch and suggests build settings; select your production branch, root directory and environment.
4. Click **Create & deploy**. A connection with repository webhook permissions lets Deployer install
   the push webhook. If GitHub refuses it, the app shows a warning and **App settings → Push to deploy**
   gives the URL and secret for manual setup. Pasting a public repo alone requires this manual webhook.
5. Push a commit to that branch. GitHub sends a signed webhook; the worker builds that commit, starts
   a replacement container, waits for its port and switches Caddy to it. Failed builds leave the live
   version serving. Check build logs, runtime logs and deployment history in the app.
6. Add an app hostname under its settings so visitors reach it through the same HTTPS tunnel.

Other branches, tag pushes, deletions, invalid commit IDs and repository mismatches are ignored.
Accepted GitHub delivery IDs are persisted so a redelivery cannot replace a newer queued commit.
The webhook checks HMAC-SHA256 before processing. See GitHub's
[signature guidance](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
and [delivery guidance](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks).
GitHub does not automatically retry failed deliveries; use its webhook delivery page to redeliver
after an outage. The dashboard and worker must be running to receive pushes and build apps.

## Updates and operations

To update the platform itself, review and pull the desired commit in this checkout, then rerun
`sudo bash deploy/aws/start.sh`. This rebuilds the platform services and applies migrations without
deleting data. Push-to-deploy inside the dashboard updates imported apps, not the platform checkout.

```bash
sudo docker compose --env-file deploy/.env -f deploy/docker-compose.yml ps
sudo docker compose --env-file deploy/.env -f deploy/docker-compose.yml logs --tail 100 api worker
curl --fail http://localhost:8080/v1/health
```

Do not run `down --volumes` on a live installation. Back up the metadata volume and `deploy/.env`
together. Running containers and Docker images also live on the EC2 disk; monitor its capacity.

The old database-as-a-service code and schema remain for migration compatibility only. Its APIs,
UI, managed database provisioning, attached data API keys, query console and background database
tasks are disabled by default (`LEGACY_BAAS_ENABLED=false`). Apps can connect to external databases
with their own environment variables. Historical documents under `docs/` describe the old product;
this document and the root README describe the current hosting workflow.
