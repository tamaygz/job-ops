import { randomUUID } from "node:crypto";
import type { TimelineEventType } from "@shared/types";
import { db, schema } from "../db/index";
import { getActiveTenantId } from "../tenancy/context";

const { investigatorTimelineEvents } = schema;

export async function insertEvent(data: {
  dossierId: string;
  runId?: string | null;
  eventType: TimelineEventType;
  payload: Record<string, unknown>;
  occurredAt: number;
}): Promise<void> {
  const tenantId = getActiveTenantId();
  await db.insert(investigatorTimelineEvents).values({
    id: randomUUID(),
    tenantId,
    dossierId: data.dossierId,
    runId: data.runId ?? null,
    eventType: data.eventType,
    payload: data.payload,
    occurredAt: data.occurredAt,
  });
}
