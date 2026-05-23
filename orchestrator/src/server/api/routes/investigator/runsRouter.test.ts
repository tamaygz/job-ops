import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startServer, stopServer } from "../test-utils";

// Prevent the in-process worker from auto-draining on startRun() so that
// integration tests can assert on "queued" / active-run state before the
// worker would otherwise transition the run to a terminal status.
vi.mock("@server/services/investigator/runWorker", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@server/services/investigator/runWorker")
    >();
  return { ...actual, scheduleResearchRunWorker: vi.fn() };
});

describe.sequential("Runs API routes", () => {
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

  async function createDossier(overrides: Record<string, unknown> = {}) {
    const res = await fetch(dossiersUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: "Acme Corp", ...overrides }),
    });
    return res.json() as Promise<{ data: { id: string } }>;
  }

  async function startRun(
    dossierId: string,
    body: Record<string, unknown> = { runKind: "company_brief" },
  ) {
    return fetch(dossiersUrl(`/${dossierId}/runs`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // ---------------------------------------------------------------------------
  // POST /:dossierId/runs — start run
  // ---------------------------------------------------------------------------

  it("starts a run and returns 201 with status queued", async () => {
    const { data: dossier } = await createDossier();

    const res = await startRun(dossier.id);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("queued");
    expect(body.data.dossierId).toBe(dossier.id);
    expect(body.data.runKind).toBe("company_brief");
  });

  it("returns 400 for invalid run payload", async () => {
    const { data: dossier } = await createDossier();

    const res = await startRun(dossier.id, { runKind: "not_a_valid_kind" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("returns 400 for missing runKind", async () => {
    const { data: dossier } = await createDossier();

    const res = await startRun(dossier.id, {});
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("returns 404 when starting a run for unknown dossier", async () => {
    const res = await startRun("does-not-exist-999");
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 when a run of the same kind is already active", async () => {
    const { data: dossier } = await createDossier();

    // First run stays queued because the worker is not running in tests
    await startRun(dossier.id);

    const res = await startRun(dossier.id);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
  });

  // ---------------------------------------------------------------------------
  // GET /:dossierId/runs — list runs
  // ---------------------------------------------------------------------------

  it("returns empty list when no runs exist", async () => {
    const { data: dossier } = await createDossier();

    const res = await fetch(dossiersUrl(`/${dossier.id}/runs`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(0);
  });

  it("lists runs for a dossier", async () => {
    const { data: dossier } = await createDossier();

    await startRun(dossier.id);

    const res = await fetch(dossiersUrl(`/${dossier.id}/runs`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.length).toBe(1);
    expect(body.data[0].dossierId).toBe(dossier.id);
  });

  // ---------------------------------------------------------------------------
  // GET /:dossierId/runs/:runId — run detail
  // ---------------------------------------------------------------------------

  it("returns run detail by id", async () => {
    const { data: dossier } = await createDossier();
    const runRes = await (await startRun(dossier.id)).json();
    const runId = runRes.data.id as string;

    const res = await fetch(dossiersUrl(`/${dossier.id}/runs/${runId}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(runId);
    expect(body.data.dossierId).toBe(dossier.id);
  });

  it("returns 404 for unknown run id", async () => {
    const { data: dossier } = await createDossier();

    const res = await fetch(dossiersUrl(`/${dossier.id}/runs/does-not-exist`));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when run belongs to a different dossier", async () => {
    const { data: dossierA } = await createDossier({ companyName: "Alpha" });
    const { data: dossierB } = await createDossier({ companyName: "Beta" });

    const runRes = await (await startRun(dossierA.id)).json();
    const runId = runRes.data.id as string;

    // Attempt to fetch dossier A run via dossier B path — must return 404
    const res = await fetch(dossiersUrl(`/${dossierB.id}/runs/${runId}`));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  // ---------------------------------------------------------------------------
  // POST /:dossierId/runs/:runId/cancel
  // ---------------------------------------------------------------------------

  it("cancels a queued run and returns updated status", async () => {
    const { data: dossier } = await createDossier();
    const runRes = await (await startRun(dossier.id)).json();
    const runId = runRes.data.id as string;

    const res = await fetch(
      dossiersUrl(`/${dossier.id}/runs/${runId}/cancel`),
      { method: "POST" },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("cancelled");
  });

  it("returns 409 when cancelling an already-terminal run", async () => {
    const { data: dossier } = await createDossier();
    const runRes = await (await startRun(dossier.id)).json();
    const runId = runRes.data.id as string;

    // Cancel once
    await fetch(dossiersUrl(`/${dossier.id}/runs/${runId}/cancel`), {
      method: "POST",
    });

    // Cancel again — run is now terminal
    const res = await fetch(
      dossiersUrl(`/${dossier.id}/runs/${runId}/cancel`),
      { method: "POST" },
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
  });
});
