import { conflict, notFound } from "@infra/errors";
import { logger } from "@infra/logger";
import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import * as timelineRepo from "@server/repositories/investigatorTimelineRepository";
import * as jobsRepo from "@server/repositories/jobs";
import type {
  CreateInvestigatorDossierInput,
  InvestigatorDossier,
  InvestigatorDossierListFilters,
  InvestigatorDossierListItem,
  LinkReason,
  UpdateInvestigatorDossierInput,
} from "@shared/types";

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
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
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

  await timelineRepo.insertEvent({
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

  await timelineRepo.insertEvent({
    dossierId: dossier.id,
    eventType: "dossier_created",
    payload: { companyName, canonicalKey, seedJobId: jobId },
    occurredAt: now,
  });

  await dossierRepo.linkJob(dossier.id, jobId, "seeded");

  await timelineRepo.insertEvent({
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
    await timelineRepo.insertEvent({
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
    await timelineRepo.insertEvent({
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
): Promise<InvestigatorDossier> {
  const dossier = await dossierRepo.findById(dossierId);
  if (!dossier) throw notFound(`Dossier ${dossierId} not found`);
  return dossier;
}
