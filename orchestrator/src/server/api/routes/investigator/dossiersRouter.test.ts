import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startServer, stopServer } from "../test-utils";

describe.sequential("Dossiers API routes", () => {
  let server: Server;
  let baseUrl: string;
  let closeDb: () => void;
  let tempDir: string;

  beforeEach(async () => {
    ({ server, baseUrl, closeDb, tempDir } = await startServer());
  });

  afterEach(async () => {
    await stopServer({ server, closeDb, tempDir });
  });

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function dossiersUrl(path = "") {
    return `${baseUrl}/api/investigator/dossiers${path}`;
  }

  async function createDossier(overrides: Record<string, unknown> = {}) {
    const res = await fetch(dossiersUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: "Acme Corp",
        companyUrl: "https://acme.example.com",
        ...overrides,
      }),
    });
    return res;
  }

  async function seedJob() {
    const { db, schema } = await import("@server/db");
    const now = new Date().toISOString();
    const jobId = randomUUID();
    await db.insert(schema.jobs).values({
      id: jobId,
      source: "manual",
      title: `Staff Engineer ${jobId}`,
      employer: "BetaCorp",
      jobUrl: `https://beta.example.com/jobs/${jobId}`,
      createdAt: now,
      updatedAt: now,
      discoveredAt: now,
    });
    return jobId;
  }

  async function createDossierRecord(overrides: Record<string, unknown> = {}) {
    const res = await createDossier(overrides);
    const body = await res.json();
    expect(res.status).toBe(201);
    return body.data as { id: string; companyName: string };
  }

  // -------------------------------------------------------------------------
  // POST / — create
  // -------------------------------------------------------------------------

  it("creates a dossier and returns 201", async () => {
    const res = await createDossier();
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.data.id).toBeTruthy();
    expect(body.data.companyName).toBe("Acme Corp");
    expect(body.data.status).toBe("active");
    expect(body.data.canonicalCompanyKey).toBe("acme corp");
    expect(body.meta.requestId).toBeTruthy();
  });

  it("returns 400 for missing companyName", async () => {
    const res = await fetch(dossiersUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyUrl: "https://example.com" }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("returns 409 when creating a duplicate dossier", async () => {
    await createDossier();
    const res = await createDossier();
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("CONFLICT");
  });

  // -------------------------------------------------------------------------
  // GET /:dossierId
  // -------------------------------------------------------------------------

  it("fetches a dossier by id", async () => {
    const createRes = await createDossier();
    const created = await createRes.json();
    const id = created.data.id as string;

    const res = await fetch(dossiersUrl(`/${id}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(id);
    expect(body.data.companyName).toBe("Acme Corp");
  });

  it("returns 404 for unknown dossier id", async () => {
    const res = await fetch(dossiersUrl("/does-not-exist-999"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  // -------------------------------------------------------------------------
  // GET / — list with filters
  // -------------------------------------------------------------------------

  it("lists all dossiers", async () => {
    await createDossier({ companyName: "Alpha" });
    await createDossier({ companyName: "Beta" });

    const res = await fetch(dossiersUrl());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
  });

  it("filters dossiers by status", async () => {
    await createDossier({ companyName: "Active Inc", status: "active" });
    await createDossier({ companyName: "Archived Ltd", status: "archived" });

    const res = await fetch(dossiersUrl("?status=active"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(
      body.data.every((d: { status: string }) => d.status === "active"),
    ).toBe(true);
  });

  it("filters dossiers by q (name search)", async () => {
    await createDossier({ companyName: "UniqueXYZ Corp" });
    await createDossier({ companyName: "Generic Ltd" });

    const res = await fetch(dossiersUrl("?q=UniqueXYZ"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.length).toBe(1);
    expect(body.data[0].companyName).toBe("UniqueXYZ Corp");
  });

  it("filters dossiers by tag", async () => {
    await createDossier({ companyName: "Tagged Co", tags: ["priority"] });
    await createDossier({ companyName: "Untagged Co", tags: ["other"] });

    const res = await fetch(dossiersUrl("?tag=priority"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].companyName).toBe("Tagged Co");
  });

  it("filters dossiers by linkedJobId", async () => {
    const linkedJobId = await seedJob();
    const otherJobId = await seedJob();
    const linkedDossier = await createDossierRecord({ companyName: "Linked Co" });
    const otherDossier = await createDossierRecord({ companyName: "Other Co" });

    await fetch(dossiersUrl(`/${linkedDossier.id}/jobs`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: linkedJobId }),
    });
    await fetch(dossiersUrl(`/${otherDossier.id}/jobs`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: otherJobId }),
    });

    const res = await fetch(dossiersUrl(`?linkedJobId=${linkedJobId}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].companyName).toBe("Linked Co");
  });

  it("filters dossiers by hasPeople", async () => {
    const withPeople = await createDossierRecord({ companyName: "People Co" });
    await createDossierRecord({ companyName: "No People Co" });

    const { db, schema } = await import("@server/db");
    const now = new Date().toISOString();
    await db.insert(schema.investigatorPeople).values({
      id: randomUUID(),
      tenantId: "tenant_default",
      dossierId: withPeople.id,
      fullName: "Pat Recruiter",
      personType: "recruiter",
      confidenceLabel: "high",
      sourceIds: [],
      createdAt: now,
      updatedAt: now,
    });

    const res = await fetch(dossiersUrl("?hasPeople=true"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].companyName).toBe("People Co");
  });

  it("filters dossiers by stale research state", async () => {
    const freshDossier = await createDossierRecord({ companyName: "Fresh Co" });
    await createDossierRecord({ companyName: "Stale Co" });

    const { db, schema } = await import("@server/db");
    const nowSeconds = Math.floor(Date.now() / 1000);
    await db
      .update(schema.investigatorDossiers)
      .set({ lastResearchedAt: nowSeconds })
      .where(eq(schema.investigatorDossiers.id, freshDossier.id));

    const res = await fetch(dossiersUrl("?stale=true"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].companyName).toBe("Stale Co");
  });

  // -------------------------------------------------------------------------
  // PATCH /:dossierId
  // -------------------------------------------------------------------------

  it("patches a dossier status", async () => {
    const createRes = await createDossier();
    const created = await createRes.json();
    const id = created.data.id as string;

    const res = await fetch(dossiersUrl(`/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("archived");
  });

  it("patches a dossier company name and recomputes canonicalCompanyKey", async () => {
    const createRes = await createDossier();
    const created = await createRes.json();
    const id = created.data.id as string;

    const res = await fetch(dossiersUrl(`/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: "Beta, LLC" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.companyName).toBe("Beta, LLC");
    expect(body.data.canonicalCompanyKey).toBe("beta llc");
  });

  it("returns 400 for invalid patch payload", async () => {
    const createRes = await createDossier();
    const created = await createRes.json();
    const id = created.data.id as string;

    const res = await fetch(dossiersUrl(`/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "not-a-valid-status" }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("returns 404 when patching unknown dossier", async () => {
    const res = await fetch(dossiersUrl("/ghost-999"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  // -------------------------------------------------------------------------
  // POST /:dossierId/jobs — link job
  // -------------------------------------------------------------------------

  it("links a job to a dossier", async () => {
    const jobId = await seedJob();
    const createRes = await createDossier();
    const created = await createRes.json();
    const dossierId = created.data.id as string;

    const res = await fetch(dossiersUrl(`/${dossierId}/jobs`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, linkReason: "manual" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.linked).toBe(true);
  });

  it("returns 400 when linking with missing jobId", async () => {
    const createRes = await createDossier();
    const created = await createRes.json();
    const dossierId = created.data.id as string;

    const res = await fetch(dossiersUrl(`/${dossierId}/jobs`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkReason: "manual" }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  // -------------------------------------------------------------------------
  // DELETE /:dossierId/jobs/:jobId — unlink job
  // -------------------------------------------------------------------------

  it("unlinks a job from a dossier and returns 204", async () => {
    const jobId = await seedJob();
    const createRes = await createDossier();
    const created = await createRes.json();
    const dossierId = created.data.id as string;

    await fetch(dossiersUrl(`/${dossierId}/jobs`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });

    const res = await fetch(dossiersUrl(`/${dossierId}/jobs/${jobId}`), {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
  });

  // -------------------------------------------------------------------------
  // POST /from-job
  // -------------------------------------------------------------------------

  it("creates a dossier from a job reference", async () => {
    const jobId = await seedJob();

    const res = await fetch(dossiersUrl("/from-job"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.data.companyName).toBe("BetaCorp");
    expect(body.data.createdFromJobId).toBe(jobId);
  });

  it("returns 404 when creating from-job with unknown jobId", async () => {
    const res = await fetch(dossiersUrl("/from-job"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: "does-not-exist-job" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
