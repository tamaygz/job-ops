import { randomUUID } from "node:crypto";
import type {
  InvestigatorDossier,
  InvestigatorDossierListFilters,
  InvestigatorDossierListItem,
  InvestigatorLinkedJob,
  LinkReason,
} from "@shared/types";
import { and, asc, desc, eq, like, ne, sql } from "drizzle-orm";
import { db, schema } from "../db/index";
import { getActiveTenantId } from "../tenancy/context";

const { investigatorDossiers, investigatorDossierJobs, jobs } = schema;

export type DossierUpdateData = {
  companyName?: string;
  companyUrl?: string | null;
  normalizedDomain?: string | null;
  status?: "active" | "watchlist" | "interviewing" | "archived" | "declined";
  tags?: string[] | null;
  lastResearchedAt?: number | null;
};

type DossierCreateData = {
  companyName: string;
  canonicalCompanyKey: string;
  companyUrl?: string | null;
  normalizedDomain?: string | null;
  status?: "active" | "watchlist" | "interviewing" | "archived" | "declined";
  tags?: string[] | null;
  createdFromJobId?: string | null;
};

function mapRowToDossier(
  row: typeof investigatorDossiers.$inferSelect,
): InvestigatorDossier {
  const tags = row.tags;
  return {
    id: row.id,
    tenantId: row.tenantId,
    companyName: row.companyName,
    canonicalCompanyKey: row.canonicalCompanyKey,
    companyUrl: row.companyUrl ?? null,
    normalizedDomain: row.normalizedDomain ?? null,
    status: row.status as InvestigatorDossier["status"],
    tags: Array.isArray(tags) ? (tags as string[]) : [],
    lastResearchedAt: row.lastResearchedAt ?? null,
    createdFromJobId: row.createdFromJobId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findAll(
  filters: InvestigatorDossierListFilters = {},
): Promise<InvestigatorDossierListItem[]> {
  const tenantId = getActiveTenantId();
  const conditions = [eq(investigatorDossiers.tenantId, tenantId)];

  if (filters.q) {
    conditions.push(like(investigatorDossiers.companyName, `%${filters.q}%`));
  }
  if (filters.status) {
    conditions.push(eq(investigatorDossiers.status, filters.status));
  } else {
    // By default, exclude archived dossiers from the list.
    conditions.push(ne(investigatorDossiers.status, "archived"));
  }
  if (filters.tag) {
    const tagPattern = `%"${filters.tag}"%`;
    conditions.push(sql`${investigatorDossiers.tags} LIKE ${tagPattern}`);
  }
  if (filters.linkedJobId) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM investigator_dossier_jobs idj
        WHERE idj.dossier_id = ${investigatorDossiers.id}
          AND idj.tenant_id = ${investigatorDossiers.tenantId}
          AND idj.job_id = ${filters.linkedJobId}
      )`,
    );
  }
  if (filters.hasPeople) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM investigator_people ip
        WHERE ip.dossier_id = ${investigatorDossiers.id}
          AND ip.tenant_id = ${investigatorDossiers.tenantId}
      )`,
    );
  }
  if (filters.stale) {
    const thirtyDaysAgoSeconds =
      Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    conditions.push(
      sql`(${investigatorDossiers.lastResearchedAt} IS NULL
        OR ${investigatorDossiers.lastResearchedAt} < ${thirtyDaysAgoSeconds})`,
    );
  }

  const orderByClause =
    filters.sort === "companyName"
      ? asc(investigatorDossiers.companyName)
      : filters.sort === "lastResearchedAt"
        ? desc(investigatorDossiers.lastResearchedAt)
        : filters.sort === "createdAt"
          ? desc(investigatorDossiers.createdAt)
          : desc(investigatorDossiers.updatedAt);

  const rows = await db
    .select({
      id: investigatorDossiers.id,
      tenantId: investigatorDossiers.tenantId,
      companyName: investigatorDossiers.companyName,
      status: investigatorDossiers.status,
      tags: investigatorDossiers.tags,
      lastResearchedAt: investigatorDossiers.lastResearchedAt,
      createdAt: investigatorDossiers.createdAt,
      linkedJobCount: sql<number>`(
        SELECT COUNT(*) FROM investigator_dossier_jobs ijj
        WHERE ijj.dossier_id = ${investigatorDossiers.id}
          AND ijj.tenant_id = ${investigatorDossiers.tenantId}
      )`,
    })
    .from(investigatorDossiers)
    .where(and(...conditions))
    .orderBy(orderByClause);

  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenantId,
    companyName: row.companyName,
    status: row.status as InvestigatorDossierListItem["status"],
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    lastResearchedAt: row.lastResearchedAt ?? null,
    linkedJobCount: Number(row.linkedJobCount),
    createdAt: row.createdAt,
  }));
}

export async function findById(
  dossierId: string,
): Promise<InvestigatorDossier | null> {
  const tenantId = getActiveTenantId();
  const [row] = await db
    .select()
    .from(investigatorDossiers)
    .where(
      and(
        eq(investigatorDossiers.tenantId, tenantId),
        eq(investigatorDossiers.id, dossierId),
      ),
    );
  return row ? mapRowToDossier(row) : null;
}

export async function findByCanonicalKey(
  key: string,
): Promise<InvestigatorDossier | null> {
  const tenantId = getActiveTenantId();
  const [row] = await db
    .select()
    .from(investigatorDossiers)
    .where(
      and(
        eq(investigatorDossiers.tenantId, tenantId),
        eq(investigatorDossiers.canonicalCompanyKey, key),
      ),
    );
  return row ? mapRowToDossier(row) : null;
}

export async function create(
  data: DossierCreateData,
): Promise<InvestigatorDossier> {
  const tenantId = getActiveTenantId();
  const id = randomUUID();
  const now = new Date().toISOString();

  await db.insert(investigatorDossiers).values({
    id,
    tenantId,
    companyName: data.companyName,
    canonicalCompanyKey: data.canonicalCompanyKey,
    companyUrl: data.companyUrl ?? null,
    normalizedDomain: data.normalizedDomain ?? null,
    status: data.status ?? "active",
    tags: data.tags ?? null,
    createdFromJobId: data.createdFromJobId ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const created = await findById(id);
  if (!created) throw new Error(`Failed to retrieve created dossier ${id}`);
  return created;
}

export async function update(
  dossierId: string,
  data: DossierUpdateData,
): Promise<InvestigatorDossier | null> {
  const tenantId = getActiveTenantId();
  const now = new Date().toISOString();

  const setValues: Partial<typeof investigatorDossiers.$inferInsert> = {
    updatedAt: now,
  };
  if (data.companyName !== undefined) setValues.companyName = data.companyName;
  if (data.companyUrl !== undefined)
    setValues.companyUrl = data.companyUrl ?? null;
  if (data.normalizedDomain !== undefined)
    setValues.normalizedDomain = data.normalizedDomain ?? null;
  if (data.status !== undefined) setValues.status = data.status;
  if (data.tags !== undefined) setValues.tags = data.tags ?? null;
  if (data.lastResearchedAt !== undefined)
    setValues.lastResearchedAt = data.lastResearchedAt ?? null;

  await db
    .update(investigatorDossiers)
    .set(setValues)
    .where(
      and(
        eq(investigatorDossiers.tenantId, tenantId),
        eq(investigatorDossiers.id, dossierId),
      ),
    );

  return findById(dossierId);
}

export async function linkJob(
  dossierId: string,
  jobId: string,
  linkReason: LinkReason,
): Promise<{ deduplicated: boolean }> {
  const tenantId = getActiveTenantId();
  const [inserted] = await db
    .insert(investigatorDossierJobs)
    .values({
      id: randomUUID(),
      tenantId,
      dossierId,
      jobId,
      linkReason,
    })
    .onConflictDoNothing()
    .returning({ id: investigatorDossierJobs.id });
  return { deduplicated: !inserted };
}

export async function unlinkJob(
  dossierId: string,
  jobId: string,
): Promise<void> {
  const tenantId = getActiveTenantId();
  await db
    .delete(investigatorDossierJobs)
    .where(
      and(
        eq(investigatorDossierJobs.tenantId, tenantId),
        eq(investigatorDossierJobs.dossierId, dossierId),
        eq(investigatorDossierJobs.jobId, jobId),
      ),
    );
}

export async function listLinkedJobs(
  dossierId: string,
): Promise<Array<{ jobId: string; linkReason: LinkReason }>> {
  const tenantId = getActiveTenantId();
  const rows = await db
    .select({
      jobId: investigatorDossierJobs.jobId,
      linkReason: investigatorDossierJobs.linkReason,
    })
    .from(investigatorDossierJobs)
    .where(
      and(
        eq(investigatorDossierJobs.tenantId, tenantId),
        eq(investigatorDossierJobs.dossierId, dossierId),
      ),
    );
  return rows.map((r) => ({
    jobId: r.jobId,
    linkReason: r.linkReason as LinkReason,
  }));
}

export async function listLinkedJobsWithDetails(
  dossierId: string,
): Promise<InvestigatorLinkedJob[]> {
  const tenantId = getActiveTenantId();
  const rows = await db
    .select({
      jobId: investigatorDossierJobs.jobId,
      linkReason: investigatorDossierJobs.linkReason,
      title: jobs.title,
      employer: jobs.employer,
    })
    .from(investigatorDossierJobs)
    .innerJoin(jobs, eq(jobs.id, investigatorDossierJobs.jobId))
    .where(
      and(
        eq(investigatorDossierJobs.tenantId, tenantId),
        eq(investigatorDossierJobs.dossierId, dossierId),
      ),
    );
  return rows.map((r) => ({
    jobId: r.jobId,
    linkReason: r.linkReason as LinkReason,
    title: r.title,
    employer: r.employer,
  }));
}
