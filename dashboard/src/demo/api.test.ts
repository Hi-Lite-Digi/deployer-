import { beforeEach, describe, expect, it, vi } from "vitest";
import type { App, Deployment, Project } from "../api/types";
import { createDemoFetch, DEMO_STORAGE_KEY } from "./api";

describe("interactive demo", () => {
  let now: number;
  let storage: Map<string, string>;
  let transport: ReturnType<typeof createDemoFetch>;
  const origin = "https://preview.example.com";
  const store = () => ({
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  });
  async function request<T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    const response = await transport(`/v1${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    expect(response.ok).toBe(true);
    return response.json() as Promise<T>;
  }
  beforeEach(() => {
    now = Date.parse("2026-10-22T00:00:00Z");
    storage = new Map();
    transport = createDemoFetch(store(), origin, () => now);
  });

  it("supports creating a project, importing an app, watching a build and reloading its state", async () => {
    const project = await request<Project>("/projects", "POST", {
      name: "My first app",
    });
    const app = await request<App>(`/projects/${project.id}/apps`, "POST", {
      name: "Website",
      repo_url: "https://github.com/Hi-Lite-Digi/deployer-",
      preset: "static",
    });
    const base = `/projects/${project.id}/apps/${app.id}`;
    const deploy = await request<Deployment>(`${base}/deploy`, "POST", {});
    expect(deploy.status).toBe("queued");
    now += 2500;
    expect(
      (await request<Deployment>(`${base}/deployments/${deploy.id}`)).status,
    ).toBe("building");
    now += 7000;
    const live = await request<App>(base);
    expect(live.live_deployment?.status).toBe("live");
    expect(live.local_url).toBe(`${origin}/demo/site/${app.id}`);
    expect(live.live_deployment?.log).toContain("No repository is cloned");
    transport = createDemoFetch(store(), origin, () => now);
    expect((await request<App>(base)).live_deployment?.id).toBe(deploy.id);
  });

  it("preserves the previous live deployment on failure and can roll back after a bad configuration", async () => {
    const apps = await request<App[]>("/projects/launchpad/apps");
    const base = `/projects/launchpad/apps/${apps[0].id}`;
    const original = apps[0].live_deployment;
    await request(base, "PATCH", {
      branch: "demo-failure",
      build_command: "exit 1",
    });
    const failed = await request<Deployment>(`${base}/deploy`, "POST");
    now += 9000;
    expect(
      (await request<Deployment>(`${base}/deployments/${failed.id}`)).status,
    ).toBe("failed");
    expect((await request<App>(base)).live_deployment?.id).toBe(original?.id);
    const rollback = await request<Deployment>(
      `${base}/deployments/${original?.id}/rollback`,
      "POST",
    );
    now += 9000;
    expect((await request<App>(base)).live_deployment?.id).toBe(rollback.id);
  });

  it("does not persist passwords, repository tokens or environment variable values", async () => {
    await request("/auth/login", "POST", {
      email: "test@example.com",
      password: "private-password",
    });
    const app = await request<App>("/projects/launchpad/apps", "POST", {
      name: "Secrets test",
      repo_token: "private-repo-token",
      env: { API_KEY: "private-api-value" },
    });
    expect(app.env_keys).toEqual(["API_KEY"]);
    expect(storage.get(DEMO_STORAGE_KEY)).not.toMatch(
      /private-password|private-repo-token|private-api-value/,
    );
    const response = await transport("/v1/instance/settings", {
      method: "PUT",
      body: JSON.stringify({ github_client_secret: "private-client-secret" }),
    });
    expect(response.status).toBe(409);
    expect(storage.get(DEMO_STORAGE_KEY)).not.toContain(
      "private-client-secret",
    );
  });

  it("never calls the network for external destinations or unsupported actions", async () => {
    const realFetch = vi.spyOn(globalThis, "fetch");
    expect(
      (await transport("https://another.example.com/v1/projects")).status,
    ).toBe(403);
    expect(
      (await transport("/v1/integrations/github/connect", { method: "POST" }))
        .status,
    ).toBe(409);
    expect(realFetch).not.toHaveBeenCalled();
    realFetch.mockRestore();
  });

  it("isolates app reads by project and cancels a simulated build", async () => {
    const app = (await request<App[]>("/projects/launchpad/apps"))[0];
    const project = await request<Project>("/projects", "POST", {
      name: "Another team",
    });
    expect(
      (await transport(`/v1/projects/${project.id}/apps/${app.id}`)).status,
    ).toBe(404);
    const base = `/projects/launchpad/apps/${app.id}`;
    const deploy = await request<Deployment>(`${base}/deploy`, "POST");
    await request(`${base}/deployments/${deploy.id}/cancel`, "POST");
    now += 20000;
    expect(
      (await request<Deployment>(`${base}/deployments/${deploy.id}`)).status,
    ).toBe("cancelled");
  });

  it("recovers from corrupt browser data and resets only its own demo storage", async () => {
    storage.set(DEMO_STORAGE_KEY, "broken JSON");
    storage.set("another-app", "keep me");
    transport = createDemoFetch(store(), origin, () => now);
    expect((await request<Project[]>("/projects"))[0].name).toBe("Launchpad");
    storage.delete(DEMO_STORAGE_KEY);
    transport = createDemoFetch(store(), origin, () => now);
    expect(await request<Project[]>("/projects")).toHaveLength(1);
    expect(storage.get("another-app")).toBe("keep me");
  });
});
