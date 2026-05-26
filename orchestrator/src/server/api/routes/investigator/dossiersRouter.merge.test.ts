import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { InvestigatorDossier, InvestigatorSource } from "@shared/types";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startServer, stopServer } from "../test-utils";

vi.mock("@server/services/investigator/runWorker", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@server/services/investigator/runWorker")
    >();
  return { ...actual, scheduleResearchRunWorker: vi.fn() };
});

describe.sequential("Dossier Merge API", () => {
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
    companyName: string,
  ): Promise<InvestigatorDossier> {
    const res = await fetch(dossiersUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: InvestigatorDossier };
    return body.data;
  }

  async function addSource(dossierId: string): Promise<InvestigatorSource> {
    const res = await fetch(dossiersUrl(`/${dossierId}/sources`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceType: "other_web_page",
        title: "Test Source",
        url: "https://example.com/source",
        capturedExcerpt: "Captured text",
        retrievedAt: Math.floor(Date.now() / 1000),
        reviewState: "verified",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: InvestigatorSource };
    return body.data;
  }

  async function seedJob(): Promise<string> {
    const now = new Date().toISOString();
    const jobId = `merge-test-job-${randomUUID()}`;
    const { db, schema } = await import("@server/db");
    await db.insert(schema.jobs).values({
      id: jobId,
      source: "manual",
      title: `Merge Test Job ${jobId}`,
      employer: "Source Co",
      jobUrl: `https://example.com/jobs/${jobId}`,
      createdAt: now,
      updatedAt: now,
      discoveredAt: now,
    });
    return jobId;
  }

  async function merge(
    targetId: string,
    sourceId: string,
    confirm: unknown = true,
  ): Promise<Response> {
    return fetch(dossiersUrl(`/${targetId}/merge`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceDossierId: sourceId, confirm }),
    });
  }

  // ---------------------------------------------------------------------------
  // Success path
  // ---------------------------------------------------------------------------

  it("merges source records into target and archives source dossier", async () => {
    const target = await createDossier("Target Co");
    const source = await createDossier("Source Co");
    const { db, schema } = await import("@server/db");
    const now = new Date().toISOString();
    const nowSec = Math.floor(Date.now() / 1000);

    const sourceRecord = await addSource(source.id);
    const linkedJobId = await seedJob();

    await db.insert(schema.investigatorDossierJobs).values({
      id: randomUUID(),
      tenantId: "tenant_default",
      dossierId: source.id,
      jobId: linkedJobId,
      linkReason: "manual",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.investigatorPeople).values({
      id: randomUUID(),
      tenantId: "tenant_default",
      dossierId: source.id,
      fullName: "Sam Recruiter",
      personType: "recruiter",
      confidenceLabel: "high",
      sourceIds: [],
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.investigatorSalaryObservations).values({
      id: randomUUID(),
      tenantId: "tenant_default",
      dossierId: source.id,
      confidenceLabel: "medium",
      observedAt: nowSec,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.investigatorSummaries).values({
      id: randomUUID(),
      tenantId: "tenant_default",
      dossierId: source.id,
      summaryType: "company_brief",
      title: "Source Summary",
      bodyMarkdown: "Summary body",
      factsJson: [],
      hypothesesJson: [],
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.investigatorTimelineEvents).values({
      id: randomUUID(),
      tenantId: "tenant_default",
      dossierId: source.id,
      runId: null,
      eventType: "source_saved",
      payload: { note: "before-merge" },
      occurredAt: nowSec,
      createdAt: now,
      updatedAt: now,
    });

    const res = await merge(target.id, source.id);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: InvestigatorDossier };
    expect(body.data.id).toBe(target.id);
    expect(body.data.status).toBe("active");

    // Source dossier should now be archived.
    const sourceRes = await fetch(dossiersUrl(`/${source.id}`));
    const sourceBody = (await sourceRes.json()) as {
      data: InvestigatorDossier;
    };
    expect(sourceBody.data.status).toBe("archived");

    const [sourceRow] = await db
      .select({ archivedAt: schema.investigatorDossiers.archivedAt })
      .from(schema.investigatorDossiers)
      .where(eq(schema.investigatorDossiers.id, source.id));
    expect(sourceRow?.archivedAt).toBeTruthy();

    // Source-linked records should now belong to target.
    const sourcesRes = await fetch(dossiersUrl(`/${target.id}/sources`));
    const sourcesBody = (await sourcesRes.json()) as {
      data: InvestigatorSource[];
    };
    expect(sourcesBody.data.some((s) => s.id === sourceRecord.id)).toBe(true);

    const targetDossierRes = await fetch(dossiersUrl(`/${target.id}`));
    const targetDossierBody = (await targetDossierRes.json()) as {
      data: { linkedJobs: Array<{ jobId: string }> };
    };
    expect(
      targetDossierBody.data.linkedJobs.some((j) => j.jobId === linkedJobId),
    ).toBe(true);

    const movedPeople = await db
      .select({ id: schema.investigatorPeople.id })
      .from(schema.investigatorPeople)
      .where(eq(schema.investigatorPeople.dossierId, target.id));
    expect(movedPeople.length).toBeGreaterThan(0);

    const movedSalary = await db
      .select({ id: schema.investigatorSalaryObservations.id })
      .from(schema.investigatorSalaryObservations)
      .where(eq(schema.investigatorSalaryObservations.dossierId, target.id));
    expect(movedSalary.length).toBeGreaterThan(0);

    const movedSummaries = await db
      .select({ id: schema.investigatorSummaries.id })
      .from(schema.investigatorSummaries)
      .where(eq(schema.investigatorSummaries.dossierId, target.id));
    expect(movedSummaries.length).toBeGreaterThan(0);

    const movedTimelineEvents = await db
      .select({
        id: schema.investigatorTimelineEvents.id,
        eventType: schema.investigatorTimelineEvents.eventType,
      })
      .from(schema.investigatorTimelineEvents)
      .where(
        and(
          eq(schema.investigatorTimelineEvents.dossierId, target.id),
          eq(schema.investigatorTimelineEvents.eventType, "source_saved"),
        ),
      );
    expect(movedTimelineEvents.length).toBeGreaterThan(0);
  });

  it("excludes archived dossiers from default list", async () => {
    const target = await createDossier("Archive List Target");
    const source = await createDossier("Archive List Source");
    await merge(target.id, source.id);

    const listRes = await fetch(dossiersUrl());
    const listBody = (await listRes.json()) as { data: unknown[] };
    const ids = (listBody.data as Array<{ id: string }>).map((d) => d.id);
    expect(ids).toContain(target.id);
    expect(ids).not.toContain(source.id);
  });

  it("archived dossier appears when filtering by status=archived", async () => {
    const target = await createDossier("Archived Filter Target");
    const source = await createDossier("Archived Filter Source");
    await merge(target.id, source.id);

    const listRes = await fetch(dossiersUrl("?status=archived"));
    const listBody = (await listRes.json()) as { data: unknown[] };
    const ids = (listBody.data as Array<{ id: string }>).map((d) => d.id);
    expect(ids).toContain(source.id);
  });

  it("writes dossier_merged timeline event on target", async () => {
    const target = await createDossier("Timeline Target Co");
    const source = await createDossier("Timeline Source Co");
    await merge(target.id, source.id);

    const timelineRes = await fetch(dossiersUrl(`/${target.id}/timeline`));
    const timelineBody = (await timelineRes.json()) as {
      data: Array<{ eventType: string; payload: Record<string, unknown> }>;
    };
    const mergeEvent = timelineBody.data.find(
      (e) => e.eventType === "dossier_merged",
    );
    expect(mergeEvent).toBeDefined();
    expect(mergeEvent?.payload.sourceDossierId).toBe(source.id);
    expect(mergeEvent?.payload.sourceCompanyName).toBe("Timeline Source Co");
  });

  // ---------------------------------------------------------------------------
  // Error paths
  // ---------------------------------------------------------------------------

  it("returns 409 when merging a dossier with itself", async () => {
    const dossier = await createDossier("Self Merge Co");
    const res = await merge(dossier.id, dossier.id);
    expect(res.status).toBe(409);
  });

  it("returns 400 when confirm is false", async () => {
    const target = await createDossier("Confirm False Target");
    const source = await createDossier("Confirm False Source");
    const res = await merge(target.id, source.id, false);
    expect(res.status).toBe(400);
  });

  it("returns 400 when confirm is missing", async () => {
    const target = await createDossier("Confirm Missing Target");
    const source = await createDossier("Confirm Missing Source");
    const res = await fetch(dossiersUrl(`/${target.id}/merge`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceDossierId: source.id }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when source dossier does not exist", async () => {
    const target = await createDossier("404 Source Target");
    const res = await merge(target.id, "nonexistent-source-id");
    expect(res.status).toBe(404);
  });

  it("returns 404 when target dossier does not exist", async () => {
    const source = await createDossier("404 Target Source");
    const res = await merge("nonexistent-target-id", source.id);
    expect(res.status).toBe(404);
  });
});
