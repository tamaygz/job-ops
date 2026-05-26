import { badRequest, notFound } from "@infra/errors";
import { sanitizeUnknown } from "@infra/sanitize";
import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import { timelineRepository } from "@server/repositories/investigatorTimelineRepository";
import {
  type InvestigatorTimelineEvent,
  TimelineEventType,
  type TimelineEventType as TimelineEventTypeName,
} from "@shared/types";

function assertTimelineEventType(
  eventType: string,
): asserts eventType is TimelineEventTypeName {
  if (
    !Object.values(TimelineEventType).includes(
      eventType as TimelineEventTypeName,
    )
  ) {
    throw badRequest("Invalid timeline event type", {
      eventType,
      allowedValues: Object.values(TimelineEventType),
    });
  }
}

export async function writeEvent(
  dossierId: string,
  eventType: TimelineEventTypeName | string,
  payload: Record<string, unknown>,
  opts?: { runId?: string | null; occurredAt?: number },
): Promise<void> {
  const dossier = await dossierRepo.findById(dossierId);
  if (!dossier) {
    throw notFound("Dossier not found");
  }

  const sanitized = sanitizeUnknown(payload) as Record<string, unknown>;
  assertTimelineEventType(eventType);

  await timelineRepository.insert({
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
    eventType?: TimelineEventTypeName;
    runId?: string;
  },
): Promise<InvestigatorTimelineEvent[]> {
  const dossier = await dossierRepo.findById(dossierId);
  if (!dossier) {
    throw notFound("Dossier not found");
  }
  return timelineRepository.findByDossier(dossierId, opts);
}
