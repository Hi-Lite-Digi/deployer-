/** Browser-only demo transport. No network requests, real credentials or cloud resources. */
import type {
  App,
  AppDetectDraft,
  Deployment,
  InstanceSettings,
  Invite,
  Member,
  Project,
  User,
} from "../api/types";

export const DEMO_STORAGE_KEY = "deployer-demo-v1";
type Store = Pick<Storage, "getItem" | "setItem">;
type DemoState = {
  version: 1;
  signedIn: boolean;
  user: User;
  projects: Project[];
  apps: App[];
  deployments: Deployment[];
  members: Record<string, Member[]>;
  invites: Record<string, Invite[]>;
  settings: InstanceSettings;
  githubConnected: boolean;
};
type Data = Record<string, unknown>;

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const error = (message: string, status = 400) =>
  json({ error: { code: "demo_unavailable", message, details: {} } }, status);
const id = () => crypto.randomUUID();
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "demo-app";
const record = (value: unknown): Data =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Data)
    : {};
const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
const nullableText = (value: unknown) =>
  typeof value === "string" && value ? value : null;
const presets = ["static", "node", "python", "dockerfile"] as const;
const active = (d: Deployment) =>
  ["queued", "building", "deploying"].includes(d.status);

function makeApp(
  projectId: string,
  input: Data,
  origin: string,
  created: string,
): App {
  const appId = id();
  const preset = presets.find((p) => p === input.preset) ?? "static";
  return {
    id: appId,
    project_id: projectId,
    name: text(input.name, "My app"),
    slug: slug(text(input.name, "My app")),
    repo_url: text(input.repo_url, "https://github.com/Hi-Lite-Digi/deployer-"),
    branch: text(input.branch, "main"),
    root_dir: text(input.root_dir, "."),
    preset,
    install_command: nullableText(input.install_command),
    build_command: nullableText(input.build_command),
    start_command: nullableText(input.start_command),
    output_dir: nullableText(input.output_dir),
    container_port:
      typeof input.container_port === "number" ? input.container_port : null,
    env_keys: Object.keys(record(input.env)),
    has_repo_token: false,
    api_key_id: null,
    database_access: false,
    internet_access: false,
    cohost: false,
    cohost_share_repo_access: false,
    replicas: [],
    github: null,
    port: 8100,
    local_url: `${origin}/demo/site/${appId}`,
    urls: [],
    target: "local",
    cloud_connection_id: null,
    cloud: null,
    build: { location: "pc" },
    live_deployment: null,
    domains: [],
    created_at: created,
    updated_at: created,
  };
}

function makeDeployment(
  app: App,
  created: string,
  trigger: Deployment["trigger"] = "manual",
): Deployment {
  return {
    id: id(),
    app_id: app.id,
    status: "queued",
    trigger,
    commit_sha: (id() + id()).replaceAll("-", "").slice(0, 40),
    commit_message: "Demo: publish an app update",
    branch: app.branch,
    image_tag: null,
    created_at: created,
    started_at: null,
    finished_at: null,
    error: null,
    rollback_of: null,
    job_id: null,
    log: "[Demo] Deployment queued. No repository is cloned and no container is started.\n",
  };
}

function initialState(origin: string, now: number): DemoState {
  const created = new Date(now - 3_600_000).toISOString();
  const user: User = {
    id: "demo-owner",
    email: "owner@example.com",
    display_name: "Demo workspace",
    avatar_url: null,
    is_instance_owner: true,
    is_active: true,
    has_password: false,
    created_at: created,
    identities: [],
  };
  const project: Project = {
    id: "launchpad",
    name: "Launchpad",
    slug: "launchpad",
    description: "Try GitHub imports, build logs and deployments.",
    owner_id: user.id,
    my_role: "owner",
    created_at: created,
    updated_at: created,
    data_source_counts: { sql: 0, nosql: 0 },
  };
  const app = makeApp(
    project.id,
    {
      name: "Storefront",
      root_dir: "dashboard",
      preset: "static",
      install_command: "npm ci",
      build_command: "npm run build",
      output_dir: "dist",
      env: { NODE_ENV: "demo" },
    },
    origin,
    created,
  );
  const deployed = makeDeployment(app, created);
  deployed.status = "live";
  deployed.started_at = created;
  deployed.finished_at = created;
  deployed.log +=
    "[Demo] Sample build completed. This is simulated deployment history.\n";
  app.live_deployment = deployed;
  const provider = (name: string) => ({
    client_id: null,
    secret_set: false,
    configured: false,
    callback_url: `${origin}/v1/auth/oauth/${name}/callback`,
  });
  return {
    version: 1,
    signedIn: true,
    user,
    projects: [project],
    apps: [app],
    deployments: [deployed],
    members: {
      [project.id]: [
        {
          user_id: user.id,
          email: user.email,
          display_name: user.display_name,
          avatar_url: null,
          role: "owner",
          created_at: created,
        },
      ],
    },
    invites: {},
    githubConnected: true,
    settings: {
      public_url: origin,
      local_url: origin,
      allow_signup: true,
      owner_only_projects: false,
      google: provider("google"),
      github: provider("github"),
      alert_webhook_url: null,
      api_key_rate_limit: 120,
    },
  };
}

/** Injectable storage and clock let the entire interaction be verified without timers or network access. */
export function createDemoFetch(
  storage: Store,
  origin: string,
  clock = Date.now,
) {
  let state: DemoState = initialState(origin, clock());
  try {
    const saved: unknown = JSON.parse(
      storage.getItem(DEMO_STORAGE_KEY) ?? "null",
    );
    const data = record(saved);
    if (
      data.version === 1 &&
      Array.isArray(data.projects) &&
      Array.isArray(data.apps) &&
      Array.isArray(data.deployments) &&
      record(data.user).id &&
      data.settings &&
      data.members &&
      data.invites
    ) {
      state = saved as DemoState;
    }
  } catch {
    /* Corrupt or unavailable browser storage starts a fresh demo. */
  }

  const persist = () => {
    try {
      storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* The in-memory demo still works. */
    }
  };
  const auth = () => ({
    access_token: "demo-session-only",
    token_type: "bearer",
    expires_in: 3600,
    user: state.user,
  });

  function advanceBuilds() {
    for (const dep of state.deployments.filter(active)) {
      const elapsed = clock() - Date.parse(dep.created_at);
      dep.status =
        elapsed < 1500
          ? "queued"
          : elapsed < 4500
            ? "building"
            : elapsed < 8000
              ? "deploying"
              : "live";
      if (dep.status !== "queued") dep.started_at = dep.created_at;
      dep.log =
        "[Demo] Simulated build. No repository is cloned, no commands are executed, and no webhook is installed.\n";
      if (elapsed >= 1500)
        dep.log +=
          "[Demo] Reading example source and installing sample dependencies…\n";
      if (elapsed >= 4500)
        dep.log += "[Demo] Build output prepared. Starting example rollout…\n";
      if (elapsed >= 8000) {
        const app = state.apps.find((a) => a.id === dep.app_id);
        if (!app) continue;
        dep.finished_at = new Date(clock()).toISOString();
        if (
          dep.trigger !== "rollback" &&
          (dep.branch === "demo-failure" ||
            app.build_command?.includes("exit 1"))
        ) {
          dep.status = "failed";
          dep.error =
            "Simulated build failure. The previous demo deployment stays live.";
          dep.log += `[Demo] ${dep.error}\n`;
        } else {
          for (const old of state.deployments)
            if (
              old.app_id === app.id &&
              old.status === "live" &&
              old.id !== dep.id
            )
              old.status = "superseded";
          app.live_deployment = dep;
          dep.log +=
            "[Demo] Example app is ready. Open its sample preview page.\n";
        }
      }
    }
  }

  function handle(method: string, url: URL, body: Data): Response {
    const path = url.pathname.replace(/^\/v1/, "");
    const created = new Date(clock()).toISOString();
    if (url.origin !== origin || !url.pathname.startsWith("/v1/"))
      return error("The demo only handles its own API routes.", 403);
    if (path === "/setup/status")
      return json({
        initialized: true,
        version: "demo",
        public_url: origin,
        reachable_elsewhere: true,
        providers: { google: false, github: false },
        allow_signup: true,
        managed_mongodb: false,
      });
    if (path === "/auth/providers")
      return json({ google: false, github: false, allow_signup: true });
    if (path === "/auth/refresh")
      return state.signedIn ? json(auth()) : error("Sign in to the demo.", 401);
    if (path === "/auth/login" || path === "/auth/signup") {
      state.signedIn = true;
      // Passwords are deliberately neither inspected nor retained by the demo.
      state.user.display_name = text(
        body.display_name,
        state.user.display_name ?? "Demo workspace",
      );
      return json(auth());
    }
    if (path === "/auth/logout") {
      state.signedIn = false;
      return json({ ok: true });
    }
    if (!state.signedIn) return error("Sign in to the demo.", 401);
    if (path === "/auth/me") {
      if (method === "PATCH")
        state.user.display_name = text(
          body.display_name,
          state.user.display_name ?? "Demo workspace",
        );
      return json(state.user);
    }
    if (path === "/instance/settings") {
      if (method === "PUT") {
        if (
          Object.keys(body).some(
            (k) =>
              k.includes("secret") ||
              k.includes("client_id") ||
              k === "alert_webhook_url",
          )
        )
          return error(
            "Real provider credentials and outgoing notifications are disabled in this demo.",
            409,
          );
        if (body.public_url !== undefined && body.public_url !== origin)
          return error(
            "The demo's public address cannot be changed. No DNS changes were made.",
            409,
          );
        if (typeof body.allow_signup === "boolean")
          state.settings.allow_signup = body.allow_signup;
        if (typeof body.owner_only_projects === "boolean")
          state.settings.owner_only_projects = body.owner_only_projects;
      }
      return json(state.settings);
    }
    if (path === "/instance/users") return json([state.user]);
    if (path === "/instance/projects")
      return json(
        state.projects.map((p) => ({
          ...p,
          owner_email: state.user.email,
          member_count: state.members[p.id]?.length ?? 1,
        })),
      );
    if (path === "/integrations/github") {
      if (method === "DELETE") {
        state.githubConnected = false;
        return json({
          ok: true,
          apps_using_connection: 0,
          message: "Sample GitHub connection removed.",
        });
      }
      return json({
        connected: state.githubConnected,
        login: state.githubConnected ? "sample-workspace" : null,
        configured: false,
        scopes: [],
      });
    }
    if (path === "/integrations/github/repos")
      return json([
        {
          full_name: "Hi-Lite-Digi/deployer-",
          private: false,
          default_branch: "main",
          html_url: "https://github.com/Hi-Lite-Digi/deployer-",
          clone_url: "https://github.com/Hi-Lite-Digi/deployer-.git",
          pushed_at: created,
          description:
            "Sample selection for the interactive demo. Repository contents are not fetched.",
        },
      ]);
    if (path === "/instance/cloud")
      return method === "GET"
        ? json({ connections: [] })
        : error("Cloud accounts cannot be connected in this demo.", 409);
    if (path === "/instance/cloud/requirements")
      return json({
        aws: { policies: [], boundary: {}, boundary_name: "demo" },
        firebase: { roles: [], apis: [] },
      });
    if (path === "/instance/alerts") return json([]);
    const emptyRequests = {
      requests: 0,
      errors_5xx: 0,
      error_rate: null,
      p95_ms: null,
    };
    if (path === "/instance/metrics/summary")
      return json({
        current: null,
        requests_5m: emptyRequests,
        containers: null,
        alerts: { active: 0, visible: 0, critical: 0, top: null },
      });
    if (path === "/instance/metrics")
      return json({
        window: url.searchParams.get("window") ?? "1h",
        step_seconds: 60,
        current: null,
        points: [],
        requests: emptyRequests,
        routes: [],
        containers: null,
      });
    if (path === "/projects") {
      if (method === "POST") {
        const name = text(body.name).trim();
        if (!name) return error("Give your project a name.", 422);
        const project: Project = {
          id: id(),
          name,
          slug: `${slug(name)}-${id().slice(0, 4)}`,
          description: nullableText(body.description),
          owner_id: state.user.id,
          my_role: "owner",
          created_at: created,
          updated_at: created,
          data_source_counts: { sql: 0, nosql: 0 },
        };
        state.projects.push(project);
        state.members[project.id] = [
          {
            user_id: state.user.id,
            email: state.user.email,
            display_name: state.user.display_name,
            avatar_url: null,
            role: "owner",
            created_at: created,
          },
        ];
        return json(project);
      }
      return json(state.projects);
    }
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    if (parts[0] !== "projects")
      return error(
        "This feature needs the hosted backend. It is not enabled in the interactive demo.",
        409,
      );
    const project = state.projects.find((p) => p.id === parts[1]);
    if (!project) return error("Project not found.", 404);
    if (parts.length === 2) {
      if (method === "PATCH") {
        project.name = text(body.name, project.name);
        project.description =
          body.description === undefined
            ? project.description
            : nullableText(body.description);
        project.updated_at = created;
      }
      if (method === "DELETE") {
        if (url.searchParams.get("confirm") !== project.slug)
          return error("Project confirmation does not match.", 422);
        const appIds = new Set(
          state.apps
            .filter((a) => a.project_id === project.id)
            .map((a) => a.id),
        );
        state.projects = state.projects.filter((p) => p.id !== project.id);
        state.apps = state.apps.filter((a) => a.project_id !== project.id);
        state.deployments = state.deployments.filter(
          (d) => !appIds.has(d.app_id),
        );
        delete state.members[project.id];
        delete state.invites[project.id];
        return json({ ok: true });
      }
      return json(project);
    }
    if (parts[2] === "members") return json(state.members[project.id] ?? []);
    if (parts[2] === "invites") {
      if (method !== "GET")
        return error("Real invitations are not sent from this demo.", 409);
      return json(state.invites[project.id] ?? []);
    }
    if (parts[2] === "jobs") return json([]);
    if (parts[2] === "cloud" && parts[3] === "connections") return json([]);
    if (parts[2] === "cloud" && parts[3] === "targets")
      return json([
        {
          id: "local",
          label: "Demo preview",
          provider: null,
          kind: "any",
          for: "Try the deployment flow with sample data.",
          when_pc_off: "Builds are simulated in your browser.",
          cost: "No cloud resources are created by this demo.",
          uses_deployer_data: false,
          available: true,
        },
      ]);
    if (parts[2] !== "apps")
      return error("This feature is not part of the interactive demo.", 409);
    if (parts[3] === "detect") {
      const repo = text(body.repo_url).replace(/\.git$/, "");
      if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(repo))
        return error("Use a GitHub repository URL for this demo.", 422);
      const draft: AppDetectDraft = {
        name: repo.split("/").filter(Boolean).at(-1) ?? "My app",
        repo_url: repo,
        branch: text(body.branch, "main"),
        root_dir: repo.includes("Hi-Lite-Digi/deployer-") ? "dashboard" : ".",
        preset: "static",
        install_command: "npm ci",
        build_command: "npm run build",
        start_command: null,
        output_dir: "dist",
        container_port: null,
        env_keys: [],
        database_access_suggested: false,
        detected: [
          { what: "Demo build settings", from: "Sample Vite configuration" },
        ],
        warnings: [
          "Demo only: repository contents were not inspected. Builds and GitHub connections are simulated.",
        ],
        private: false,
      };
      return json(draft);
    }
    if (parts.length === 3) {
      if (method === "POST") {
        const app = makeApp(project.id, body, origin, created);
        state.apps.push(app);
        return json({
          ...app,
          warnings: ["Demo only: no GitHub webhook was installed."],
        });
      }
      return json(state.apps.filter((a) => a.project_id === project.id));
    }
    const app = state.apps.find(
      (a) => a.id === parts[3] && a.project_id === project.id,
    );
    if (!app) return error("App not found.", 404);
    if (parts.length === 4) {
      if (method === "DELETE") {
        state.apps = state.apps.filter((a) => a.id !== app.id);
        state.deployments = state.deployments.filter(
          (d) => d.app_id !== app.id,
        );
        return json({ job_id: null, teardown_job_id: null });
      }
      if (method === "PATCH") {
        for (const key of ["name", "repo_url", "branch", "root_dir"] as const)
          if (typeof body[key] === "string") app[key] = body[key];
        const preset = presets.find((p) => p === body.preset);
        if (preset) app.preset = preset;
        for (const key of [
          "install_command",
          "build_command",
          "start_command",
          "output_dir",
        ] as const)
          if (body[key] !== undefined) app[key] = nullableText(body[key]);
        if (body.env !== undefined)
          app.env_keys = Object.keys(record(body.env));
        if (typeof body.container_port === "number")
          app.container_port = body.container_port;
        app.updated_at = created;
      }
      return json(app);
    }
    if (parts[4] === "env")
      return json({
        env: Object.fromEntries(app.env_keys.map((key) => [key, "demo-value"])),
      });
    if (parts[4] === "webhook")
      return json({
        url: `${origin}/v1/hooks/github/${app.id}`,
        secret: "demo-only-not-a-real-webhook-secret",
        hook_active: false,
        warnings: [
          "This demo does not receive GitHub pushes. Use Deploy now to simulate a build.",
        ],
      });
    if (parts[4] === "logs")
      return json({
        lines: [
          "[Demo] Sample application is ready.",
          "[Demo] This is simulated runtime output.",
        ],
        container: "demo-container",
      });
    if (parts[4] === "github-runs") return json({ runs: [], runs_url: null });
    if (parts[4] === "domains")
      return method === "GET"
        ? json([])
        : error("Domain and DNS changes are disabled in the demo.", 409);
    if (parts[4] === "deploy") {
      const dep = makeDeployment(app, created);
      if (typeof body.branch === "string") dep.branch = body.branch;
      // A new demo build replaces a queued build rather than leaving an endless list of active rows.
      for (const previous of state.deployments.filter(
        (d) => d.app_id === app.id && active(d),
      ))
        previous.status = "cancelled";
      state.deployments.unshift(dep);
      return json(dep);
    }
    if (parts[4] === "deployments") {
      if (!parts[5])
        return json({
          deployments: url.searchParams.has("before")
            ? []
            : state.deployments.filter((d) => d.app_id === app.id),
          has_more: false,
        });
      const dep = state.deployments.find(
        (d) => d.id === parts[5] && d.app_id === app.id,
      );
      if (!dep) return error("Deployment not found.", 404);
      if (parts[6] === "cancel") {
        dep.status = "cancelled";
        dep.finished_at = created;
      }
      if (parts[6] === "rollback") {
        const rollback = makeDeployment(app, created, "rollback");
        rollback.rollback_of = dep.id;
        rollback.commit_sha = dep.commit_sha;
        rollback.branch = dep.branch;
        state.deployments.unshift(rollback);
        return json(rollback);
      }
      return json(dep);
    }
    return error(
      "This action needs the hosted backend. No external changes were made.",
      409,
    );
  }

  return async (input: string, init?: RequestInit): Promise<Response> => {
    if (init?.signal?.aborted)
      throw new DOMException("Request aborted", "AbortError");
    advanceBuilds();
    let body: Data = {};
    try {
      if (typeof init?.body === "string") body = record(JSON.parse(init.body));
    } catch {
      return error("Invalid JSON.", 422);
    }
    const response = handle(
      init?.method ?? "GET",
      new URL(input, origin),
      body,
    );
    persist();
    return response;
  };
}

let browserFetch: ReturnType<typeof createDemoFetch> | undefined;
export async function demoFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  if (!browserFetch) {
    const storage: Store = {
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
    };
    browserFetch = createDemoFetch(storage, window.location.origin);
  }
  return browserFetch(input, init);
}
