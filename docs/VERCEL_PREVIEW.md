# Interactive Vercel preview

This preview is for trying the dashboard before the Docker backend is hosted. It includes a sample
workspace, repository import settings, simulated build logs, failed builds, rollback and app settings.
The notice at the bottom of every page identifies it as a demo.

Import `Hi-Lite-Digi/deployer-` into a **new** Vercel project with:

- Root directory: `dashboard`
- Framework: Vite
- Build command override: `npm run build:demo`
- Output directory: `dist`
- Install command: `npm ci`

No environment variables or external database are required. The SPA rewrite in
`dashboard/vercel.json` makes project and deployment deep links work after a refresh.

The demo opens as a sample owner. Create a project, select the example repository or paste a GitHub
URL, and choose **Create & deploy**. Its simulated build takes about eight seconds. Open **Settings**
to change the branch or environment-variable names. Use branch `demo-failure` or build command
`exit 1` to explore a failed build; the previous sample version stays live. The rollback button
restores an earlier sample deployment. **Reset demo** restores the initial workspace.

Only this browser's demo state is saved in local storage. Passwords, repository tokens and
environment-variable values are not retained. Use sample values. GitHub authorization, real push
webhooks, cloud credentials, invitations and DNS changes are disabled. No repository is cloned,
no build command is executed and no container is started. A sample site represents the resulting app.

The normal `npm run build` continues to use the real API and excludes the demo transport. This
Vercel project is an interface preview, not a working app-hosting server. Follow
[AWS_HOSTING.md](AWS_HOSTING.md) for real GitHub push deployments with the Docker worker.
