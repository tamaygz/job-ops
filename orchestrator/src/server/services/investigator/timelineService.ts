import { notFound } from "@infra/errors";
import { sanitizeUnknown } from "@infra/sanitize";
import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import * as timelineRepo from "@server/repositories/investigatorTimelineRepository";
import type {
  InvestigatorTimelineEvent,
  TimelineEventType,
} from "@shared/types";

export async function writeEvent(
  dossierId: string,
  eventType: TimelineEventType,
  payload: Record<string, unknown>,
  opts?: { runId?: string | null; occurredAt?: number },
): Promise<void> {
  const dossier = await dossierRepo.findById(dossierId);
  if (!dossier) {
    throw notFound("Dossier not found");
  }

  const sanitized = sanitizeUnknown(payload) as Record<string, unknown>;

  await timelineRepo.insert({
    dossierId,
    runId: opts?.runId ?? null,
    eventType,
    payload: sanitized,
    occurredAt: opts?.occurredAt ?? Math.floor(Date.now() / 1000),
  });
}

export async function listEvents(
  dossierId: string,
  opts?: {
    limit?: number;
    before?: number;
    eventType?: TimelineEventType;
    runId?: string;
  },
): Promise<InvestigatorTimelineEvent[]> {
  const dossier = await dossierRepo.findById(dossierId);
  if (!dossier) {
    throw notFound("Dossier not found");
  }
  return timelineRepo.findByDossier(dossierId, opts);
}
