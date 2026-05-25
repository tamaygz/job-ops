import { createHash } from "node:crypto";
import { notFound } from "@infra/errors";
import { logger } from "@infra/logger";
import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import * as sourceRepo from "@server/repositories/investigatorSourceRepository";
import * as timelineRepo from "@server/repositories/investigatorTimelineRepository";
import type {
  CreateInvestigatorSourceInput,
  InvestigatorSource,
  ReviewState,
  SourceType,
  UpdateInvestigatorSourceInput,
} from "@shared/types";

const log = logger.child({ service: "sourceService" });

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function computeContentHash(excerpt: string): string {
  return createHash("sha256")
    .update(excerpt.trim().toLowerCase())
    .digest("hex");
}

function deriveSourceHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export type SaveSourceResult = {
  source: InvestigatorSource;
  deduplicated: boolean;
};

export async function saveSource(
  dossierId: string,
  input: CreateInvestigatorSourceInput,
): Promise<SaveSourceResult> {
  const dossier = await dossierRepo.findById(dossierId);
  if (!dossier) {
    throw notFound(`Dossier ${dossierId} not found`);
  }

  const contentHash = computeContentHash(input.capturedExcerpt);
  const existing = await sourceRepo.findByContentHash(dossierId, contentHash);
  if (existing) {
    log.info("Source dedup: returning existing source", {
      dossierId,
      sourceId: existing.id,
      sourceType: existing.sourceType,
    });
    return { source: existing, deduplicated: true };
  }

  const source = await sourceRepo.create({
    dossierId,
    runId: input.runId ?? null,
    sourceType: input.sourceType,
    title: input.title,
    url: input.url ?? null,
    sourceHost: deriveSourceHost(input.url),
    capturedExcerpt: input.capturedExcerpt,
    retrievedAt: input.retrievedAt,
    reviewState: input.reviewState ?? "unreviewed",
    reviewerNote: input.reviewerNote ?? null,
    contentHash,
  });

  await timelineRepo.insertEvent({
    dossierId,
    runId: input.runId ?? null,
    eventType: "source_saved",
    payload: { sourceId: source.id, sourceType: source.sourceType },
    occurredAt: nowSeconds(),
  });

  log.info("Source saved", {
    dossierId,
    sourceId: source.id,
    sourceType: source.sourceType,
  });

  return { source, deduplicated: false };
}

export async function updateSource(
  sourceId: string,
  data: UpdateInvestigatorSourceInput,
): Promise<InvestigatorSource> {
  const existing = await sourceRepo.findById(sourceId);
  if (!existing) {
    throw notFound(`Source ${sourceId} not found`);
  }

  const reviewStateChanged =
    data.reviewState !== undefined && data.reviewState !== existing.reviewState;

  const updated = await sourceRepo.update(sourceId, {
    sourceType: data.sourceType,
    title: data.title,
    url: data.url,
    sourceHost: data.url !== undefined ? deriveSourceHost(data.url) : undefined,
    capturedExcerpt: data.capturedExcerpt,
    retrievedAt: data.retrievedAt,
    reviewState: data.reviewState,
    reviewerNote: data.reviewerNote,
  });

  if (!updated) {
    throw notFound(`Source ${sourceId} not found after update`);
  }

  if (reviewStateChanged) {
    await timelineRepo.insertEvent({
      dossierId: existing.dossierId,
      eventType: "source_reviewed",
      payload: {
        sourceId,
        sourceType: updated.sourceType,
        reviewState: updated.reviewState,
      },
      occurredAt: nowSeconds(),
    });
  }

  log.info("Source updated", {
    sourceId,
    dossierId: existing.dossierId,
    sourceType: updated.sourceType,
  });

  return updated;
}

export async function deleteSource(sourceId: string): Promise<void> {
  const deleted = await sourceRepo.deleteById(sourceId);
  if (!deleted) {
    throw notFound(`Source ${sourceId} not found`);
  }
}

export async function listSources(
  dossierId: string,
  filters?: { reviewState?: ReviewState; sourceType?: SourceType },
): Promise<InvestigatorSource[]> {
  return sourceRepo.findByDossier(dossierId, filters);
}
