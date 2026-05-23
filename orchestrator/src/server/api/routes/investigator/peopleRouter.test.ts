import type { Server } from "node:http";
import type { InvestigatorPerson } from "@shared/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startServer, stopServer } from "../test-utils";

describe.sequential("People API routes", () => {
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

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function dossiersUrl(path = "") {
    return `${baseUrl}/api/investigator/dossiers${path}`;
  }

  async function createDossier(
    companyName = "People Test Co",
  ): Promise<string> {
    const res = await fetch(dossiersUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName }),
    });
    const json = (await res.json()) as { data: { id: string } };
    return json.data.id;
  }

  function defaultPersonPayload(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      fullName: "Jane Recruiter",
      personType: "recruiter",
      confidenceLabel: "high",
      profileUrl: "https://linkedin.com/in/jane-recruiter",
      ...overrides,
    };
  }

  async function createPerson(
    dossierId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<InvestigatorPerson> {
    const res = await fetch(dossiersUrl(`/${dossierId}/people`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(defaultPersonPayload(overrides)),
    });
    const json = (await res.json()) as { data: InvestigatorPerson };
    return json.data;
  }

  // ---------------------------------------------------------------------------
  // POST /:dossierId/people — create
  // ---------------------------------------------------------------------------

  it("creates a person and returns 201", async () => {
    const dossierId = await createDossier();
    const res = await fetch(dossiersUrl(`/${dossierId}/people`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(defaultPersonPayload()),
    });
    const body = (await res.json()) as {
      ok: boolean;
      data: InvestigatorPerson;
    };
    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.data.fullName).toBe("Jane Recruiter");
    expect(body.data.personType).toBe("recruiter");
    expect(body.data.confidenceLabel).toBe("high");
    expect(body.data.dossierId).toBe(dossierId);
  });

  it("returns 400 for missing required fields", async () => {
    const dossierId = await createDossier();
    const res = await fetch(dossiersUrl(`/${dossierId}/people`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Missing Fields Person" }),
    });
    const body = (await res.json()) as { ok: boolean };
    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("returns 400 for invalid profileUrl", async () => {
    const dossierId = await createDossier();
    const res = await fetch(dossiersUrl(`/${dossierId}/people`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(defaultPersonPayload({ profileUrl: "not-a-url" })),
    });
    expect(res.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // GET /:dossierId/people — list
  // ---------------------------------------------------------------------------

  it("lists people for a dossier", async () => {
    const dossierId = await createDossier();
    await createPerson(dossierId, {
      fullName: "Alice Hiring",
      personType: "hiring_manager",
      confidenceLabel: "medium",
    });
    await createPerson(dossierId, {
      fullName: "Bob Exec",
      personType: "executive",
      confidenceLabel: "low",
    });
    const res = await fetch(dossiersUrl(`/${dossierId}/people`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: InvestigatorPerson[] };
    expect(body.data.length).toBe(2);
  });

  it("returns empty array for dossier with no people", async () => {
    const dossierId = await createDossier();
    const res = await fetch(dossiersUrl(`/${dossierId}/people`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: InvestigatorPerson[] };
    expect(body.data).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // PATCH /:dossierId/people/:personId — update
  // ---------------------------------------------------------------------------

  it("patches a person and returns 200", async () => {
    const dossierId = await createDossier();
    const person = await createPerson(dossierId);
    const res = await fetch(dossiersUrl(`/${dossierId}/people/${person.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notes: "Seemed friendly",
        confidenceLabel: "medium",
      }),
    });
    const body = (await res.json()) as {
      ok: boolean;
      data: InvestigatorPerson;
    };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.notes).toBe("Seemed friendly");
    expect(body.data.confidenceLabel).toBe("medium");
  });

  it("returns 400 for invalid patch body", async () => {
    const dossierId = await createDossier();
    const person = await createPerson(dossierId);
    const res = await fetch(dossiersUrl(`/${dossierId}/people/${person.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confidenceLabel: "not-a-valid-label" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when patching unknown person", async () => {
    const dossierId = await createDossier();
    const res = await fetch(dossiersUrl(`/${dossierId}/people/unknown-id`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "x" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when patching person belonging to different dossier", async () => {
    const d1 = await createDossier("Patch Cross Co A");
    const d2 = await createDossier("Patch Cross Co B");
    const person = await createPerson(d1);
    const res = await fetch(dossiersUrl(`/${d2}/people/${person.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "cross tenant attempt" }),
    });
    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // DELETE /:dossierId/people/:personId — delete
  // ---------------------------------------------------------------------------

  it("deletes a person and returns 204", async () => {
    const dossierId = await createDossier();
    const person = await createPerson(dossierId);
    const delRes = await fetch(
      dossiersUrl(`/${dossierId}/people/${person.id}`),
      { method: "DELETE" },
    );
    expect(delRes.status).toBe(204);
    const listRes = await fetch(dossiersUrl(`/${dossierId}/people`));
    const body = (await listRes.json()) as { data: InvestigatorPerson[] };
    expect(body.data.length).toBe(0);
  });

  it("returns 404 when deleting unknown person", async () => {
    const dossierId = await createDossier();
    const res = await fetch(dossiersUrl(`/${dossierId}/people/unknown-id`), {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting person from wrong dossier (cross-tenant isolation)", async () => {
    const d1 = await createDossier("Delete Cross Co A");
    const d2 = await createDossier("Delete Cross Co B");
    const person = await createPerson(d1);
    const res = await fetch(dossiersUrl(`/${d2}/people/${person.id}`), {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});
