import { randomUUID } from "node:crypto";
import type {
  InvestigatorSource,
  ReviewState,
  SourceType,
} from "@shared/types";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { getActiveTenantId } from "../tenancy/context";

const { investigatorSources } = schema;

export type SourceFindByDossierOpts = {
  runId?: string;
  reviewState?: ReviewState;
  sourceType?: SourceType;
};

export type SourceCreateData = {
  dossierId: string;
  runId?: string | null;
  sourceType: SourceType;
  title: string;
  url?: string | null;
  sourceHost?: string | null;
  capturedExcerpt: string;
  retrievedAt: number;
  reviewState?: ReviewState;
  reviewerNote?: string | null;
  contentHash?: string | null;
};

export type SourceUpdateData = {
  sourceType?: SourceType;
  title?: string;
  url?: string | null;
  sourceHost?: string | null;
  capturedExcerpt?: string;
  retrievedAt?: number;
  reviewState?: ReviewState;
  reviewerNote?: string | null;
  contentHash?: string | null;
};

function mapRowToSource(
  row: typeof investigatorSources.$inferSelect,
): InvestigatorSource {
  return {
    id: row.id,
    tenantId: row.tenantId,
    dossierId: row.dossierId,
    runId: row.runId ?? null,
    sourceType: row.sourceType as InvestigatorSource["sourceType"],
    title: row.title,
    url: row.url ?? null,
    sourceHost: row.sourceHost ?? null,
    capturedExcerpt: row.capturedExcerpt,
    retrievedAt: row.retrievedAt,
    reviewState: row.reviewState as InvestigatorSource["reviewState"],
    reviewerNote: row.reviewerNote ?? null,
    contentHash: row.contentHash ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findByDossier(
  dossierId: string,
  opts?: SourceFindByDossierOpts,
): Promise<InvestigatorSource[]> {
  const tenantId = getActiveTenantId();
  const conditions = [
    eq(investigatorSources.tenantId, tenantId),
    eq(investigatorSources.dossierId, dossierId),
  ];
  if (opts?.runId) {
    conditions.push(eq(investigatorSources.runId, opts.runId));
  }
  if (opts?.reviewState) {
    conditions.push(eq(investigatorSources.reviewState, opts.reviewState));
  }
  if (opts?.sourceType) {
    conditions.push(eq(investigatorSources.sourceType, opts.sourceType));
  }

  const rows = await db
    .select()
    .from(investigatorSources)
    .where(and(...conditions))
    .orderBy(desc(investigatorSources.createdAt));
  return rows.map(mapRowToSource);
}

export async function findById(
  sourceId: string,
): Promise<InvestigatorSource | null> {
  const tenantId = getActiveTenantId();
  const [row] = await db
    .select()
    .from(investigatorSources)
    .where(
      and(
        eq(investigatorSources.tenantId, tenantId),
        eq(investigatorSources.id, sourceId),
      ),
    )
    .limit(1);
  return row ? mapRowToSource(row) : null;
}

export async function findByContentHash(
  dossierId: string,
  contentHash: string,
): Promise<InvestigatorSource | null> {
  const tenantId = getActiveTenantId();
  const [row] = await db
    .select()
    .from(investigatorSources)
    .where(
      and(
        eq(investigatorSources.tenantId, tenantId),
        eq(investigatorSources.dossierId, dossierId),
        eq(investigatorSources.contentHash, contentHash),
      ),
    )
    .limit(1);
  return row ? mapRowToSource(row) : null;
}

export async function create(
  data: SourceCreateData,
): Promise<InvestigatorSource> {
  const tenantId = getActiveTenantId();
  const id = randomUUID();
  const now = new Date().toISOString();

  const [row] = await db
    .insert(investigatorSources)
    .values({
      id,
      tenantId,
      dossierId: data.dossierId,
      runId: data.runId ?? null,
      sourceType: data.sourceType,
      title: data.title,
      url: data.url ?? null,
      sourceHost: data.sourceHost ?? null,
      capturedExcerpt: data.capturedExcerpt,
      retrievedAt: data.retrievedAt,
      reviewState: data.reviewState ?? "unreviewed",
      reviewerNote: data.reviewerNote ?? null,
      contentHash: data.contentHash ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return mapRowToSource(row);
}

export async function update(
  sourceId: string,
  data: SourceUpdateData,
): Promise<InvestigatorSource | null> {
  const tenantId = getActiveTenantId();
  const now = new Date().toISOString();

  const setValues: Partial<typeof investigatorSources.$inferInsert> = {
    updatedAt: now,
  };
  if (data.sourceType !== undefined) setValues.sourceType = data.sourceType;
  if (data.title !== undefined) setValues.title = data.title;
  if (data.url !== undefined) setValues.url = data.url ?? null;
  if (data.sourceHost !== undefined)
    setValues.sourceHost = data.sourceHost ?? null;
  if (data.capturedExcerpt !== undefined)
    setValues.capturedExcerpt = data.capturedExcerpt;
  if (data.retrievedAt !== undefined) setValues.retrievedAt = data.retrievedAt;
  if (data.reviewState !== undefined) setValues.reviewState = data.reviewState;
  if (data.reviewerNote !== undefined)
    setValues.reviewerNote = data.reviewerNote ?? null;
  if (data.contentHash !== undefined)
    setValues.contentHash = data.contentHash ?? null;

  const rows = await db
    .update(investigatorSources)
    .set(setValues)
    .where(
      and(
        eq(investigatorSources.tenantId, tenantId),
        eq(investigatorSources.id, sourceId),
      ),
    )
    .returning();
  return rows[0] ? mapRowToSource(rows[0]) : null;
}

export async function deleteById(sourceId: string): Promise<boolean> {
  const tenantId = getActiveTenantId();
  const rows = await db
    .delete(investigatorSources)
    .where(
      and(
        eq(investigatorSources.tenantId, tenantId),
        eq(investigatorSources.id, sourceId),
      ),
    )
    .returning({ id: investigatorSources.id });
  return rows.length > 0;
}
