import type { Server } from "node:http";
import type { InvestigatorSalaryObservation } from "@shared/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startServer, stopServer } from "../test-utils";

describe.sequential("Salary Observations API routes", () => {
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
    companyName = "Salary Test Co",
  ): Promise<string> {
    const res = await fetch(dossiersUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName }),
    });
    const json = (await res.json()) as { data: { id: string } };
    return json.data.id;
  }

  function defaultObsPayload(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      roleScope: "Senior Engineer",
      geoScope: "Remote, USA",
      currency: "USD",
      payInterval: "annual",
      minAmount: 120000,
      maxAmount: 160000,
      confidenceLabel: "high",
      notes: "From job posting",
      ...overrides,
    };
  }

  async function createObs(
    dossierId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<InvestigatorSalaryObservation> {
    const res = await fetch(dossiersUrl(`/${dossierId}/salary-observations`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(defaultObsPayload(overrides)),
    });
    const json = (await res.json()) as { data: InvestigatorSalaryObservation };
    return json.data;
  }

  // ---------------------------------------------------------------------------
  // POST — create
  // ---------------------------------------------------------------------------

  it("creates a salary observation and returns 201", async () => {
    const dossierId = await createDossier();
    const res = await fetch(dossiersUrl(`/${dossierId}/salary-observations`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(defaultObsPayload()),
    });
    const body = (await res.json()) as {
      ok: boolean;
      data: InvestigatorSalaryObservation;
    };
    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.data.dossierId).toBe(dossierId);
    expect(body.data.minAmount).toBe(120000);
    expect(body.data.maxAmount).toBe(160000);
    expect(body.data.currency).toBe("USD");
  });

  it("returns 400 for missing required fields", async () => {
    const dossierId = await createDossier("Missing Fields Co");
    const res = await fetch(dossiersUrl(`/${dossierId}/salary-observations`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when minAmount exceeds maxAmount", async () => {
    const dossierId = await createDossier("Amount Range Co");
    const res = await fetch(dossiersUrl(`/${dossierId}/salary-observations`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        defaultObsPayload({ minAmount: 200000, maxAmount: 100000 }),
      ),
    });
    expect(res.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // GET — list
  // ---------------------------------------------------------------------------

  it("lists salary observations for a dossier", async () => {
    const dossierId = await createDossier("List Obs Co");
    await createObs(dossierId);
    await createObs(dossierId, { roleScope: "Staff Engineer" });

    const res = await fetch(dossiersUrl(`/${dossierId}/salary-observations`));
    const body = (await res.json()) as {
      ok: boolean;
      data: InvestigatorSalaryObservation[];
    };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(2);
  });

  it("returns empty array for dossier with no observations", async () => {
    const dossierId = await createDossier("Empty Obs Co");
    const res = await fetch(dossiersUrl(`/${dossierId}/salary-observations`));
    const body = (await res.json()) as {
      ok: boolean;
      data: InvestigatorSalaryObservation[];
    };
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // PATCH — update
  // ---------------------------------------------------------------------------

  it("patches a salary observation and returns 200", async () => {
    const dossierId = await createDossier("Patch Obs Co");
    const obs = await createObs(dossierId);

    const res = await fetch(
      dossiersUrl(`/${dossierId}/salary-observations/${obs.id}`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Updated note", maxAmount: 170000 }),
      },
    );
    const body = (await res.json()) as {
      ok: boolean;
      data: InvestigatorSalaryObservation;
    };
    expect(res.status).toBe(200);
    expect(body.data.notes).toBe("Updated note");
    expect(body.data.maxAmount).toBe(170000);
  });

  it("returns 400 for invalid patch body", async () => {
    const dossierId = await createDossier("Patch Invalid Co");
    const obs = await createObs(dossierId);

    const res = await fetch(
      dossiersUrl(`/${dossierId}/salary-observations/${obs.id}`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payInterval: "weekly" }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when patching unknown observation", async () => {
    const dossierId = await createDossier("Patch Unknown Co");
    const res = await fetch(
      dossiersUrl(`/${dossierId}/salary-observations/nonexistent-id`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "nope" }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when patching observation from wrong dossier", async () => {
    const dossierA = await createDossier("Patch Cross Co A");
    const dossierB = await createDossier("Patch Cross Co B");
    const obs = await createObs(dossierA);

    const res = await fetch(
      dossiersUrl(`/${dossierB}/salary-observations/${obs.id}`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "cross dossier" }),
      },
    );
    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  it("deletes a salary observation and returns 204", async () => {
    const dossierId = await createDossier("Delete Obs Co");
    const obs = await createObs(dossierId);

    const res = await fetch(
      dossiersUrl(`/${dossierId}/salary-observations/${obs.id}`),
      { method: "DELETE" },
    );
    expect(res.status).toBe(204);

    const listRes = await fetch(
      dossiersUrl(`/${dossierId}/salary-observations`),
    );
    const listBody = (await listRes.json()) as {
      data: InvestigatorSalaryObservation[];
    };
    expect(listBody.data).toHaveLength(0);
  });

  it("returns 404 when deleting unknown observation", async () => {
    const dossierId = await createDossier("Delete Unknown Co");
    const res = await fetch(
      dossiersUrl(`/${dossierId}/salary-observations/nonexistent-id`),
      { method: "DELETE" },
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting observation from wrong dossier", async () => {
    const dossierA = await createDossier("Delete Cross Co A");
    const dossierB = await createDossier("Delete Cross Co B");
    const obs = await createObs(dossierA);

    const res = await fetch(
      dossiersUrl(`/${dossierB}/salary-observations/${obs.id}`),
      { method: "DELETE" },
    );
    expect(res.status).toBe(404);
  });
});
