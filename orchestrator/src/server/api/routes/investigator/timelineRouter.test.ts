import type { Server } from "node:http";
import type { InvestigatorTimelineEvent } from "@shared/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startServer, stopServer } from "../test-utils";

// Prevent the in-process run worker from auto-draining so we can assert
// timeline events from startRun without the run completing asynchronously.
vi.mock("@server/services/investigator/runWorker", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@server/services/investigator/runWorker")
    >();
  return { ...actual, scheduleResearchRunWorker: vi.fn() };
});

describe.sequential("Timeline API routes", () => {
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
    companyName = "Timeline Test Co",
  ): Promise<string> {
    const res = await fetch(dossiersUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName }),
    });
    const json = (await res.json()) as { data: { id: string } };
    return json.data.id;
  }

  async function startRun(dossierId: string): Promise<string> {
    const res = await fetch(dossiersUrl(`/${dossierId}/runs`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runKind: "company_brief" }),
    });
    const json = (await res.json()) as { data: { id: string } };
    return json.data.id;
  }

  async function getTimeline(
    dossierId: string,
    query = "",
  ): Promise<{ status: number; data: InvestigatorTimelineEvent[] }> {
    const res = await fetch(dossiersUrl(`/${dossierId}/timeline${query}`));
    const json = (await res.json()) as {
      ok: boolean;
      data: InvestigatorTimelineEvent[];
    };
    return { status: res.status, data: json.data };
  }

  // ---------------------------------------------------------------------------
  // GET /:dossierId/timeline
  // ---------------------------------------------------------------------------

  it("returns empty timeline for new dossier (no run)", async () => {
    const dossierId = await createDossier("Empty Timeline Co");
    // dossier_created event is written on creation
    const { status, data } = await getTimeline(dossierId);
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it("lists events after creating dossier and starting a run", async () => {
    const dossierId = await createDossier();
    await startRun(dossierId);

    const { status, data } = await getTimeline(dossierId);
    expect(status).toBe(200);

    // dossier_created + run_started should both be present
    const eventTypes = data.map((e) => e.eventType);
    expect(eventTypes).toContain("dossier_created");
    expect(eventTypes).toContain("run_started");
  });

  it("returns events ordered by occurredAt descending", async () => {
    const dossierId = await createDossier("Order Test Co");
    await startRun(dossierId);

    const { data } = await getTimeline(dossierId);
    for (let i = 1; i < data.length; i++) {
      expect(data[i - 1].occurredAt).toBeGreaterThanOrEqual(data[i].occurredAt);
    }
  });

  it("respects limit query param", async () => {
    const dossierId = await createDossier("Limit Test Co");
    await startRun(dossierId);

    const { status, data } = await getTimeline(dossierId, "?limit=1");
    expect(status).toBe(200);
    expect(data.length).toBeLessThanOrEqual(1);
  });

  it("supports before cursor pagination", async () => {
    const dossierId = await createDossier("Cursor Test Co");
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await startRun(dossierId);

    const firstPage = await getTimeline(dossierId, "?limit=1");
    expect(firstPage.status).toBe(200);
    expect(firstPage.data.length).toBe(1);

    const cursor = firstPage.data[0]?.occurredAt;
    const secondPage = await getTimeline(dossierId, `?before=${cursor}`);
    expect(secondPage.status).toBe(200);
    expect(secondPage.data.every((event) => event.occurredAt < cursor)).toBe(
      true,
    );
  });

  it("returns 400 for invalid limit", async () => {
    const dossierId = await createDossier("Bad Limit Co");
    const res = await fetch(dossiersUrl(`/${dossierId}/timeline?limit=999`));
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown dossier", async () => {
    const res = await fetch(dossiersUrl("/nonexistent-dossier-id/timeline"));
    expect(res.status).toBe(404);
  });

  it("can scope the timeline to a specific run", async () => {
    const dossierId = await createDossier("Scoped Timeline Co");
    const runId = await startRun(dossierId);
    const unscoped = await getTimeline(dossierId);

    const { status, data } = await getTimeline(dossierId, `?runId=${runId}`);
    expect(status).toBe(200);
    expect(unscoped.data.some((event) => event.runId === null)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((event) => event.runId === runId)).toBe(true);
  });

  it("event payloads are records and dossierId matches", async () => {
    const dossierId = await createDossier("Payload Test Co");
    const { data } = await getTimeline(dossierId);
    for (const event of data) {
      expect(event.dossierId).toBe(dossierId);
      expect(typeof event.payload).toBe("object");
    }
  });
});
