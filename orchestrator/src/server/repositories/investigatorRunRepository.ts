import { randomUUID } from "node:crypto";
import type { InvestigatorResearchRun, RunStatus } from "@shared/types";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "../db/index";
import { getActiveTenantId } from "../tenancy/context";

const { investigatorResearchRuns } = schema;

type RunCreateData = {
  dossierId: string;
  runKind: "company_brief" | "people_scan" | "dossier_refresh";
  initiatedBy?: "user" | "system";
  seedContext?: Record<string, unknown> | null;
};

export type RunUpdateExtra = {
  startedAt?: number;
  completedAt?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
};

function mapRowToRun(
  row: typeof investigatorResearchRuns.$inferSelect,
): InvestigatorResearchRun {
  return {
    id: row.id,
    tenantId: row.tenantId,
    dossierId: row.dossierId,
    runKind: row.runKind as InvestigatorResearchRun["runKind"],
    status: row.status as InvestigatorResearchRun["status"],
    initiatedBy: row.initiatedBy as "user" | "system",
    seedContext: (row.seedContext as Record<string, unknown> | null) ?? null,
    startedAt: row.startedAt ?? null,
    completedAt: row.completedAt ?? null,
    errorCode: row.errorCode ?? null,
    errorMessage: row.errorMessage ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function create(
  data: RunCreateData,
): Promise<InvestigatorResearchRun> {
  const tenantId = getActiveTenantId();
  const id = randomUUID();

  const [row] = await db
    .insert(investigatorResearchRuns)
    .values({
      id,
      tenantId,
      dossierId: data.dossierId,
      runKind: data.runKind,
      status: "queued",
      initiatedBy: data.initiatedBy ?? "user",
      seedContext: data.seedContext ?? null,
    })
    .returning();

  return mapRowToRun(row);
}

export async function findByDossier(
  dossierId: string,
): Promise<InvestigatorResearchRun[]> {
  const tenantId = getActiveTenantId();
  const rows = await db
    .select()
    .from(investigatorResearchRuns)
    .where(
      and(
        eq(investigatorResearchRuns.tenantId, tenantId),
        eq(investigatorResearchRuns.dossierId, dossierId),
      ),
    )
    .orderBy(desc(investigatorResearchRuns.createdAt));

  return rows.map(mapRowToRun);
}

export async function findById(
  runId: string,
): Promise<InvestigatorResearchRun | null> {
  const tenantId = getActiveTenantId();
  const [row] = await db
    .select()
    .from(investigatorResearchRuns)
    .where(
      and(
        eq(investigatorResearchRuns.tenantId, tenantId),
        eq(investigatorResearchRuns.id, runId),
      ),
    )
    .limit(1);

  return row ? mapRowToRun(row) : null;
}

export async function findActiveForDossierAndKind(
  dossierId: string,
  runKind: "company_brief" | "people_scan" | "dossier_refresh",
): Promise<InvestigatorResearchRun | null> {
  const tenantId = getActiveTenantId();
  const [row] = await db
    .select()
    .from(investigatorResearchRuns)
    .where(
      and(
        eq(investigatorResearchRuns.tenantId, tenantId),
        eq(investigatorResearchRuns.dossierId, dossierId),
        eq(investigatorResearchRuns.runKind, runKind),
        inArray(investigatorResearchRuns.status, ["queued", "running"]),
      ),
    )
    .limit(1);

  return row ? mapRowToRun(row) : null;
}

export async function updateStatus(
  runId: string,
  status: RunStatus,
  extra: RunUpdateExtra = {},
): Promise<InvestigatorResearchRun | null> {
  const tenantId = getActiveTenantId();
  const now = new Date().toISOString();

  const setValues: Partial<typeof investigatorResearchRuns.$inferInsert> = {
    status,
    updatedAt: now,
  };
  if (extra.startedAt !== undefined) setValues.startedAt = extra.startedAt;
  if (extra.completedAt !== undefined)
    setValues.completedAt = extra.completedAt;
  if (extra.errorCode !== undefined) setValues.errorCode = extra.errorCode;
  if (extra.errorMessage !== undefined)
    setValues.errorMessage = extra.errorMessage;

  const rows = await db
    .update(investigatorResearchRuns)
    .set(setValues)
    .where(
      and(
        eq(investigatorResearchRuns.tenantId, tenantId),
        eq(investigatorResearchRuns.id, runId),
      ),
    )
    .returning();

  return rows[0] ? mapRowToRun(rows[0]) : null;
}
