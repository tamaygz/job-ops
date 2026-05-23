import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startServer, stopServer } from "../test-utils";

vi.mock("@server/services/investigator/runWorker", () => ({
  scheduleResearchRunWorker: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

const AUTH_ENV = {
  BASIC_AUTH_USER: "admin",
  BASIC_AUTH_PASSWORD: "secret",
  JWT_SECRET: "an-explicit-jwt-secret-with-at-least-32-chars",
  JOBOPS_TEST_AUTH_BYPASS: "0",
};

async function login(
  baseUrl: string,
  username: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json();
  expect(res.status).toBe(200);
  return body.data.token as string;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function createWorkspaceUser(
  baseUrl: string,
  adminToken: string,
  username: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/workspaces/users`, {
    method: "POST",
    headers: authHeaders(adminToken),
    body: JSON.stringify({
      username,
      displayName: username,
      password,
    }),
  });
  expect(res.status).toBe(201);
}

async function createDossier(
  baseUrl: string,
  token: string,
): Promise<{ id: string }> {
  const res = await fetch(`${baseUrl}/api/investigator/dossiers`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      companyName: "Isolated Corp",
      companyUrl: "https://isolated.example.com",
    }),
  });
  const body = await res.json();
  expect(res.status).toBe(201);
  return body.data as { id: string };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.sequential("Investigator tenant isolation", () => {
  let server: Server;
  let baseUrl: string;
  let closeDb: () => void;
  let tempDir: string;

  beforeEach(async () => {
    ({ server, baseUrl, closeDb, tempDir } = await startServer({
      env: AUTH_ENV,
    }));
  });

  afterEach(async () => {
    await stopServer({ server, closeDb, tempDir });
  });

  it("Tenant B cannot see Tenant A's dossier in the list", async () => {
    const adminToken = await login(baseUrl, "admin", "secret");
    await createWorkspaceUser(baseUrl, adminToken, "bob", "bob-secret-123");
    const bobToken = await login(baseUrl, "bob", "bob-secret-123");

    await createDossier(baseUrl, adminToken);

    const listRes = await fetch(`${baseUrl}/api/investigator/dossiers`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const listBody = await listRes.json();

    expect(listRes.status).toBe(200);
    expect(listBody.data).toEqual([]);
  });

  it("Tenant B GET dossier by id returns 404 NOT_FOUND", async () => {
    const adminToken = await login(baseUrl, "admin", "secret");
    await createWorkspaceUser(baseUrl, adminToken, "bob", "bob-secret-123");
    const bobToken = await login(baseUrl, "bob", "bob-secret-123");

    const { id: dossierId } = await createDossier(baseUrl, adminToken);

    const res = await fetch(
      `${baseUrl}/api/investigator/dossiers/${dossierId}`,
      { headers: { Authorization: `Bearer ${bobToken}` } },
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.meta.requestId).toBeTruthy();
  });

  it("Tenant B PATCH dossier returns 404", async () => {
    const adminToken = await login(baseUrl, "admin", "secret");
    await createWorkspaceUser(baseUrl, adminToken, "bob", "bob-secret-123");
    const bobToken = await login(baseUrl, "bob", "bob-secret-123");

    const { id: dossierId } = await createDossier(baseUrl, adminToken);

    const res = await fetch(
      `${baseUrl}/api/investigator/dossiers/${dossierId}`,
      {
        method: "PATCH",
        headers: authHeaders(bobToken),
        body: JSON.stringify({ status: "active" }),
      },
    );

    expect(res.status).toBe(404);
  });

  it("Tenant B POST run returns 404 (dossier not found for their tenant)", async () => {
    const adminToken = await login(baseUrl, "admin", "secret");
    await createWorkspaceUser(baseUrl, adminToken, "bob", "bob-secret-123");
    const bobToken = await login(baseUrl, "bob", "bob-secret-123");

    const { id: dossierId } = await createDossier(baseUrl, adminToken);

    const res = await fetch(
      `${baseUrl}/api/investigator/dossiers/${dossierId}/runs`,
      {
        method: "POST",
        headers: authHeaders(bobToken),
        body: JSON.stringify({ runKind: "company_brief" }),
      },
    );

    expect(res.status).toBe(404);
  });

  it("Tenant B GET runs returns empty — no data leakage across tenants", async () => {
    const adminToken = await login(baseUrl, "admin", "secret");
    await createWorkspaceUser(baseUrl, adminToken, "bob", "bob-secret-123");
    const bobToken = await login(baseUrl, "bob", "bob-secret-123");

    const { id: dossierId } = await createDossier(baseUrl, adminToken);

    const res = await fetch(
      `${baseUrl}/api/investigator/dossiers/${dossierId}/runs`,
      { headers: { Authorization: `Bearer ${bobToken}` } },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it("Tenant B GET sources returns empty — no data leakage across tenants", async () => {
    const adminToken = await login(baseUrl, "admin", "secret");
    await createWorkspaceUser(baseUrl, adminToken, "bob", "bob-secret-123");
    const bobToken = await login(baseUrl, "bob", "bob-secret-123");

    const { id: dossierId } = await createDossier(baseUrl, adminToken);

    const res = await fetch(
      `${baseUrl}/api/investigator/dossiers/${dossierId}/sources`,
      { headers: { Authorization: `Bearer ${bobToken}` } },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it("Tenant B GET people returns empty — no data leakage across tenants", async () => {
    const adminToken = await login(baseUrl, "admin", "secret");
    await createWorkspaceUser(baseUrl, adminToken, "bob", "bob-secret-123");
    const bobToken = await login(baseUrl, "bob", "bob-secret-123");

    const { id: dossierId } = await createDossier(baseUrl, adminToken);

    const res = await fetch(
      `${baseUrl}/api/investigator/dossiers/${dossierId}/people`,
      { headers: { Authorization: `Bearer ${bobToken}` } },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it("Tenant B GET salary-observations returns empty — no data leakage across tenants", async () => {
    const adminToken = await login(baseUrl, "admin", "secret");
    await createWorkspaceUser(baseUrl, adminToken, "bob", "bob-secret-123");
    const bobToken = await login(baseUrl, "bob", "bob-secret-123");

    const { id: dossierId } = await createDossier(baseUrl, adminToken);

    const res = await fetch(
      `${baseUrl}/api/investigator/dossiers/${dossierId}/salary-observations`,
      { headers: { Authorization: `Bearer ${bobToken}` } },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it("Tenant B GET summaries returns 404 (service validates dossier ownership)", async () => {
    const adminToken = await login(baseUrl, "admin", "secret");
    await createWorkspaceUser(baseUrl, adminToken, "bob", "bob-secret-123");
    const bobToken = await login(baseUrl, "bob", "bob-secret-123");

    const { id: dossierId } = await createDossier(baseUrl, adminToken);

    const res = await fetch(
      `${baseUrl}/api/investigator/dossiers/${dossierId}/summaries`,
      { headers: { Authorization: `Bearer ${bobToken}` } },
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
  });

  it("Tenant B GET timeline returns 404 (service validates dossier ownership)", async () => {
    const adminToken = await login(baseUrl, "admin", "secret");
    await createWorkspaceUser(baseUrl, adminToken, "bob", "bob-secret-123");
    const bobToken = await login(baseUrl, "bob", "bob-secret-123");

    const { id: dossierId } = await createDossier(baseUrl, adminToken);

    const res = await fetch(
      `${baseUrl}/api/investigator/dossiers/${dossierId}/timeline`,
      { headers: { Authorization: `Bearer ${bobToken}` } },
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
  });
});
