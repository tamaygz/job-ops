import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { startServer, stopServer } from "@server/api/routes/test-utils";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const TENANT_ID = "tenant_default";

/**
 * Integration tests for runWorker.
 * Uses startServer/stopServer to obtain a real migrated SQLite DB without
 * starting an HTTP listener that the tests actually talk to.
 */
describe.sequential("runWorker integration: enqueue -> drain -> completed", () => {
  let server: Server;
  let closeDb: () => void;
  let tempDir: string;

  beforeEach(async () => {
    ({ server, closeDb, tempDir } = await startServer());
  });

  afterEach(async () => {
    await stopServer({ server, closeDb, tempDir });
  });

  it("transitions run status from queued to completed when queue is drained", async () => {
    // Dynamic imports after startServer() so they pick up the fresh DATA_DIR
    const { db, schema } = await import("@server/db/index");
    const { getJobQueue } = await import("@server/infra/job-queue-registry");
    const { drainResearchRunQueue } = await import(
      "@server/services/investigator/runWorker"
    );

    const dossierId = randomUUID();
    const runId = randomUUID();

    await db.insert(schema.investigatorDossiers).values({
      id: dossierId,
      tenantId: TENANT_ID,
      companyName: "INV006 Worker Test Corp",
      canonicalCompanyKey: "inv006 worker test corp",
      status: "active",
      tags: [],
    });

    await db.insert(schema.investigatorResearchRuns).values({
      id: runId,
      tenantId: TENANT_ID,
      dossierId,
      runKind: "company_brief",
      status: "queued",
      initiatedBy: "user",
    });

    await getJobQueue().enqueue("investigator_research_run", {
      tenantId: TENANT_ID,
      dossierId,
      runId,
      runKind: "company_brief",
    });

    await drainResearchRunQueue();

    const [row] = await db
      .select()
      .from(schema.investigatorResearchRuns)
      .where(eq(schema.investigatorResearchRuns.id, runId))
      .limit(1);

    expect(row?.status).toBe("completed");
    expect(row?.completedAt).toBeTruthy();
    expect(row?.startedAt).toBeTruthy();
    expect(row?.errorCode).toBeNull();
    expect(row?.errorMessage).toBeNull();
  });

  it("skips run that is not in queued state (idempotency guard)", async () => {
    const { db, schema } = await import("@server/db/index");
    const { getJobQueue } = await import("@server/infra/job-queue-registry");
    const { drainResearchRunQueue } = await import(
      "@server/services/investigator/runWorker"
    );

    const dossierId = randomUUID();
    const runId = randomUUID();

    await db.insert(schema.investigatorDossiers).values({
      id: dossierId,
      tenantId: TENANT_ID,
      companyName: "INV006 Worker Test Corp",
      canonicalCompanyKey: "inv006 worker test corp",
      status: "active",
      tags: [],
    });

    // Insert as already running — simulates duplicate delivery
    await db.insert(schema.investigatorResearchRuns).values({
      id: runId,
      tenantId: TENANT_ID,
      dossierId,
      runKind: "people_scan",
      status: "running",
      initiatedBy: "user",
    });

    await getJobQueue().enqueue("investigator_research_run", {
      tenantId: TENANT_ID,
      dossierId,
      runId,
      runKind: "people_scan",
    });

    await drainResearchRunQueue();

    const [row] = await db
      .select()
      .from(schema.investigatorResearchRuns)
      .where(eq(schema.investigatorResearchRuns.id, runId))
      .limit(1);

    // Status must remain unchanged
    expect(row?.status).toBe("running");
  });
});
