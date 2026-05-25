import { conflict, notFound } from "@infra/errors";
import { logger } from "@infra/logger";
import { sanitizeError } from "@infra/sanitize";
import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import * as timelineRepo from "@server/repositories/investigatorTimelineRepository";
import * as jobsRepo from "@server/repositories/jobs";
import type {
  CreateInvestigatorDossierInput,
  InvestigatorDossier,
  InvestigatorDossierDetail,
  InvestigatorDossierListFilters,
  InvestigatorDossierListItem,
  InvestigatorLinkedJob,
  LinkReason,
  UpdateInvestigatorDossierInput,
} from "@shared/types";
import { extractNormalizedHostname } from "./urlUtils";

const log = logger.child({ service: "dossierService" });

export function normalizeCanonicalKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDomain(url: string | null | undefined): string | null {
  return extractNormalizedHostname(url);
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

async function writeTimelineEvent(input: {
  dossierId: string;
  eventType: Parameters<typeof timelineRepo.insert>[0]["eventType"];
  payload: Record<string, unknown>;
  occurredAt?: number;
  runId?: string | null;
}): Promise<void> {
  await timelineRepo.insert(input);
}

export async function createDossier(
  input: CreateInvestigatorDossierInput,
): Promise<InvestigatorDossier> {
  const canonicalKey = normalizeCanonicalKey(input.companyName);

  const existing = await dossierRepo.findByCanonicalKey(canonicalKey);
  if (existing) {
    throw conflict(
      `A dossier for "${input.companyName}" already exists (id: ${existing.id})`,
    );
  }

  const dossier = await dossierRepo.create({
    companyName: input.companyName,
    canonicalCompanyKey: canonicalKey,
    companyUrl: input.companyUrl ?? null,
    normalizedDomain: extractDomain(input.companyUrl),
    status: input.status ?? "active",
    tags: input.tags ?? null,
    createdFromJobId: input.sourceJobId ?? null,
  });

  await writeTimelineEvent({
    dossierId: dossier.id,
    eventType: "dossier_created",
    payload: { companyName: input.companyName, canonicalKey },
    occurredAt: nowSeconds(),
  });

  log.info("Dossier created", {
    dossierId: dossier.id,
    companyName: input.companyName,
  });
  return dossier;
}

export async function createDossierFromJob(
  jobId: string,
): Promise<InvestigatorDossier> {
  const job = await jobsRepo.getJobById(jobId);
  if (!job) throw notFound(`Job ${jobId} not found`);

  const companyName = job.employer;
  const companyUrl = job.employerUrl ?? null;
  const canonicalKey = normalizeCanonicalKey(companyName);
  const normalizedDomain = extractDomain(companyUrl);

  const existing = await dossierRepo.findByCanonicalKey(canonicalKey);
  if (existing) {
    throw conflict(
      `A dossier for "${companyName}" already exists (id: ${existing.id})`,
    );
  }

  const dossier = await dossierRepo.create({
    companyName,
    canonicalCompanyKey: canonicalKey,
    companyUrl,
    normalizedDomain,
    status: "active",
    createdFromJobId: jobId,
  });

  const now = nowSeconds();

  await writeTimelineEvent({
    dossierId: dossier.id,
    eventType: "dossier_created",
    payload: { companyName, canonicalKey, seedJobId: jobId },
    occurredAt: now,
  });

  await dossierRepo.linkJob(dossier.id, jobId, "seeded");

  await writeTimelineEvent({
    dossierId: dossier.id,
    eventType: "job_linked",
    payload: { jobId, linkReason: "seeded" },
    occurredAt: now,
  });

  log.info("Dossier created from job", {
    dossierId: dossier.id,
    jobId,
    companyName,
  });
  return dossier;
}

export async function updateDossier(
  dossierId: string,
  input: UpdateInvestigatorDossierInput,
): Promise<InvestigatorDossier> {
  const existing = await dossierRepo.findById(dossierId);
  if (!existing) throw notFound(`Dossier ${dossierId} not found`);

  const updateData: dossierRepo.DossierUpdateData = {};
  if (input.companyName !== undefined) {
    const canonicalKey = normalizeCanonicalKey(input.companyName);
    if (canonicalKey !== existing.canonicalCompanyKey) {
      const duplicate = await dossierRepo.findByCanonicalKey(canonicalKey);
      if (duplicate && duplicate.id !== dossierId) {
        throw conflict(
          `A dossier for "${input.companyName}" already exists (id: ${duplicate.id})`,
        );
      }
      updateData.canonicalCompanyKey = canonicalKey;
    }
    updateData.companyName = input.companyName;
  }
  if (input.companyUrl !== undefined) {
    updateData.companyUrl = input.companyUrl ?? null;
    updateData.normalizedDomain = extractDomain(input.companyUrl);
  }
  if (input.status !== undefined) {
    updateData.status = input.status;
  }
  if (input.tags !== undefined) {
    updateData.tags = input.tags ?? null;
  }

  const updated = await dossierRepo.update(dossierId, updateData);
  if (!updated) throw notFound(`Dossier ${dossierId} not found after update`);

  if (input.status !== undefined && input.status !== existing.status) {
    await writeTimelineEvent({
      dossierId,
      eventType: "status_changed",
      payload: { from: existing.status, to: input.status },
      occurredAt: nowSeconds(),
    });
  }

  return updated;
}

export async function linkJobToDossier(
  dossierId: string,
  jobId: string,
  reason: LinkReason,
): Promise<void> {
  const existing = await dossierRepo.findById(dossierId);
  if (!existing) throw notFound(`Dossier ${dossierId} not found`);

  const { deduplicated } = await dossierRepo.linkJob(dossierId, jobId, reason);
  if (!deduplicated) {
    await writeTimelineEvent({
      dossierId,
      eventType: "job_linked",
      payload: { jobId, linkReason: reason },
      occurredAt: nowSeconds(),
    });
  }
}

export async function unlinkJobFromDossier(
  dossierId: string,
  jobId: string,
): Promise<void> {
  await dossierRepo.unlinkJob(dossierId, jobId);
}

export async function listDossiers(
  filters: InvestigatorDossierListFilters = {},
): Promise<InvestigatorDossierListItem[]> {
  return dossierRepo.findAll(filters);
}

export async function getDossier(
  dossierId: string,
): Promise<InvestigatorDossierDetail> {
  const dossier = await dossierRepo.findById(dossierId);
  if (!dossier) throw notFound(`Dossier ${dossierId} not found`);
  const linkedJobs = await dossierRepo.listLinkedJobsWithDetails(dossierId);
  return { ...dossier, linkedJobs };
}

export async function listLinkedJobsForDossier(
  dossierId: string,
): Promise<InvestigatorLinkedJob[]> {
  const dossier = await dossierRepo.findById(dossierId);
  if (!dossier) throw notFound(`Dossier ${dossierId} not found`);
  return dossierRepo.listLinkedJobsWithDetails(dossierId);
}

/**
 * Ensure a dossier exists for each company in the given list.
 * If a dossier already exists (by canonical key), it is skipped.
 * Concurrent creates that hit the UNIQUE constraint are treated as skips rather
 * than errors, making this safe to call in parallel or on retry.
 * Returns the count of newly created dossiers.
 */
export async function ensureDossiersForCompanies(
  companies: Array<{
    companyName: string;
    companyUrl?: string | null;
  }>,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  const uniqueByKey = new Map<
    string,
    { companyName: string; companyUrl?: string | null }
  >();
  for (const company of companies) {
    const canonicalKey = normalizeCanonicalKey(company.companyName);
    if (!canonicalKey) continue;
    if (!uniqueByKey.has(canonicalKey)) {
      uniqueByKey.set(canonicalKey, company);
    }
  }

  for (const [canonicalKey, company] of uniqueByKey) {
    const existing = await dossierRepo.findByCanonicalKey(canonicalKey);
    if (existing) {
      skipped++;
      continue;
    }

    try {
      const dossier = await dossierRepo.create({
        companyName: company.companyName,
        canonicalCompanyKey: canonicalKey,
        companyUrl: company.companyUrl ?? null,
        normalizedDomain: extractDomain(company.companyUrl),
        status: "watchlist",
      });

      created++;

      try {
        await writeTimelineEvent({
          dossierId: dossier.id,
          eventType: "dossier_created",
          payload: {
            companyName: company.companyName,
            canonicalKey,
            source: "watchlist",
          },
          occurredAt: nowSeconds(),
        });
      } catch (timelineErr) {
        log.warn("Failed to write dossier_created timeline event", {
          dossierId: dossier.id,
          error: sanitizeError(timelineErr),
        });
      }
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.toLowerCase().includes("unique constraint failed")
      ) {
        // A concurrent save created the same dossier between our pre-check and
        // the insert — treat this as a skip rather than failing the whole save.
        skipped++;
      } else {
        throw err;
      }
    }
  }

  log.info("Ensured dossiers for watchlist companies", { created, skipped });
  return { created, skipped };
}
