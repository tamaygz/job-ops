import { randomUUID } from "node:crypto";
import type {
  InvestigatorTimelineEvent,
  TimelineEventType,
} from "@shared/types";
import { and, desc, eq, lt } from "drizzle-orm";
import { db, schema } from "../db/index";
import { getActiveTenantId } from "../tenancy/context";

const { investigatorTimelineEvents } = schema;

export type TimelineQueryOpts = {
  limit?: number;
  before?: number;
  eventType?: TimelineEventType;
  runId?: string;
};

function mapRow(
  row: typeof investigatorTimelineEvents.$inferSelect,
): InvestigatorTimelineEvent {
  return {
    id: row.id,
    tenantId: row.tenantId,
    dossierId: row.dossierId,
    runId: row.runId ?? null,
    eventType: row.eventType as TimelineEventType,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function insert(data: {
  dossierId: string;
  runId?: string | null;
  eventType: TimelineEventType;
  payload: Record<string, unknown>;
  occurredAt?: number;
}): Promise<void> {
  const tenantId = getActiveTenantId();
  await db.insert(investigatorTimelineEvents).values({
    id: randomUUID(),
    tenantId,
    dossierId: data.dossierId,
    runId: data.runId ?? null,
    eventType: data.eventType,
    payload: data.payload,
    occurredAt: data.occurredAt ?? Math.floor(Date.now() / 1000),
  });
}

/** Backwards-compatible alias used by existing services. */
export async function insertEvent(data: {
  dossierId: string;
  runId?: string | null;
  eventType: TimelineEventType;
  payload: Record<string, unknown>;
  occurredAt: number;
}): Promise<void> {
  return insert(data);
}

export async function findByDossier(
  dossierId: string,
  opts: TimelineQueryOpts = {},
): Promise<InvestigatorTimelineEvent[]> {
  const tenantId = getActiveTenantId();
  const limit = opts.limit == null ? undefined : Math.min(opts.limit, 200);

  const conditions = [
    eq(investigatorTimelineEvents.tenantId, tenantId),
    eq(investigatorTimelineEvents.dossierId, dossierId),
  ];

  if (opts.before != null) {
    conditions.push(lt(investigatorTimelineEvents.occurredAt, opts.before));
  }

  if (opts.eventType != null) {
    conditions.push(eq(investigatorTimelineEvents.eventType, opts.eventType));
  }

  if (opts.runId != null) {
    conditions.push(eq(investigatorTimelineEvents.runId, opts.runId));
  }

  const query = db
    .select()
    .from(investigatorTimelineEvents)
    .where(and(...conditions))
    .orderBy(desc(investigatorTimelineEvents.occurredAt));

  const rows = limit == null ? await query : await query.limit(limit);

  return rows.map(mapRow);
}
