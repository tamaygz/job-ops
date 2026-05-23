import { randomUUID } from "node:crypto";
import type {
  InvestigatorStatement,
  InvestigatorSummary,
  SummaryReviewState,
  SummaryType,
} from "@shared/types";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { getActiveTenantId } from "../tenancy/context";

const { investigatorSummaries } = schema;

export type SummaryCreateData = {
  dossierId: string;
  runId?: string | null;
  summaryType: SummaryType;
  title: string;
  bodyMarkdown: string;
  factsJson: InvestigatorStatement[];
  hypothesesJson: InvestigatorStatement[];
  version: number;
  reviewState?: SummaryReviewState;
};

export type SummaryUpdateData = {
  bodyMarkdown?: string;
  reviewState?: SummaryReviewState;
  version?: number;
};

function mapRow(
  row: typeof investigatorSummaries.$inferSelect,
): InvestigatorSummary {
  return {
    id: row.id,
    tenantId: row.tenantId,
    dossierId: row.dossierId,
    runId: row.runId ?? null,
    summaryType: row.summaryType as SummaryType,
    title: row.title,
    bodyMarkdown: row.bodyMarkdown,
    factsJson: (row.factsJson as InvestigatorStatement[]) ?? [],
    hypothesesJson: (row.hypothesesJson as InvestigatorStatement[]) ?? [],
    reviewState: row.reviewState as SummaryReviewState,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findByDossier(
  dossierId: string,
): Promise<InvestigatorSummary[]> {
  const tenantId = getActiveTenantId();
  const rows = await db
    .select()
    .from(investigatorSummaries)
    .where(
      and(
        eq(investigatorSummaries.tenantId, tenantId),
        eq(investigatorSummaries.dossierId, dossierId),
      ),
    )
    .orderBy(
      investigatorSummaries.summaryType,
      desc(investigatorSummaries.version),
    );
  return rows.map(mapRow);
}

export async function findLatest(
  dossierId: string,
  summaryType: SummaryType,
): Promise<InvestigatorSummary | null> {
  const tenantId = getActiveTenantId();
  const [row] = await db
    .select()
    .from(investigatorSummaries)
    .where(
      and(
        eq(investigatorSummaries.tenantId, tenantId),
        eq(investigatorSummaries.dossierId, dossierId),
        eq(investigatorSummaries.summaryType, summaryType),
      ),
    )
    .orderBy(desc(investigatorSummaries.version))
    .limit(1);
  return row ? mapRow(row) : null;
}

export async function findById(
  summaryId: string,
): Promise<InvestigatorSummary | null> {
  const tenantId = getActiveTenantId();
  const [row] = await db
    .select()
    .from(investigatorSummaries)
    .where(
      and(
        eq(investigatorSummaries.tenantId, tenantId),
        eq(investigatorSummaries.id, summaryId),
      ),
    );
  return row ? mapRow(row) : null;
}

export async function create(
  data: SummaryCreateData,
): Promise<InvestigatorSummary> {
  const tenantId = getActiveTenantId();
  const id = randomUUID();
  const now = new Date().toISOString();

  const [row] = await db
    .insert(investigatorSummaries)
    .values({
      id,
      tenantId,
      dossierId: data.dossierId,
      runId: data.runId ?? null,
      summaryType: data.summaryType,
      title: data.title,
      bodyMarkdown: data.bodyMarkdown,
      factsJson: data.factsJson,
      hypothesesJson: data.hypothesesJson,
      version: data.version,
      reviewState: data.reviewState ?? "draft",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return mapRow(row);
}

export async function update(
  summaryId: string,
  data: SummaryUpdateData,
): Promise<InvestigatorSummary | null> {
  const tenantId = getActiveTenantId();
  const now = new Date().toISOString();

  const setValues: Partial<typeof investigatorSummaries.$inferInsert> = {
    updatedAt: now,
  };
  if (data.bodyMarkdown !== undefined)
    setValues.bodyMarkdown = data.bodyMarkdown;
  if (data.reviewState !== undefined) setValues.reviewState = data.reviewState;
  if (data.version !== undefined) setValues.version = data.version;

  const rows = await db
    .update(investigatorSummaries)
    .set(setValues)
    .where(
      and(
        eq(investigatorSummaries.tenantId, tenantId),
        eq(investigatorSummaries.id, summaryId),
      ),
    )
    .returning();
  return rows[0] ? mapRow(rows[0]) : null;
}
