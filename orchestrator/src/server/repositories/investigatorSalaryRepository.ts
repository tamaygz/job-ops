import { randomUUID } from "node:crypto";
import type {
  ConfidenceLabel,
  InvestigatorSalaryObservation,
  PayInterval,
} from "@shared/types";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { getActiveTenantId } from "../tenancy/context";

const { investigatorSalaryObservations } = schema;

export type SalaryCreateData = {
  dossierId: string;
  runId?: string | null;
  roleScope?: string | null;
  geoScope?: string | null;
  currency?: string | null;
  payInterval?: PayInterval | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  equityText?: string | null;
  bonusText?: string | null;
  confidenceLabel: ConfidenceLabel;
  sourceId?: string | null;
  observedAt?: number | null;
  notes?: string | null;
};

export type SalaryUpdateData = {
  roleScope?: string | null;
  geoScope?: string | null;
  currency?: string | null;
  payInterval?: PayInterval | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  equityText?: string | null;
  bonusText?: string | null;
  confidenceLabel?: ConfidenceLabel;
  sourceId?: string | null;
  observedAt?: number | null;
  notes?: string | null;
};

function mapRowToObs(
  row: typeof investigatorSalaryObservations.$inferSelect,
): InvestigatorSalaryObservation {
  return {
    id: row.id,
    tenantId: row.tenantId,
    dossierId: row.dossierId,
    runId: row.runId ?? null,
    roleScope: row.roleScope ?? null,
    geoScope: row.geoScope ?? null,
    currency: row.currency ?? null,
    payInterval: (row.payInterval ?? null) as PayInterval | null,
    minAmount: row.minAmount ?? null,
    maxAmount: row.maxAmount ?? null,
    equityText: row.equityText ?? null,
    bonusText: row.bonusText ?? null,
    confidenceLabel:
      row.confidenceLabel as InvestigatorSalaryObservation["confidenceLabel"],
    sourceId: row.sourceId ?? null,
    observedAt: row.observedAt ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findByDossier(
  dossierId: string,
): Promise<InvestigatorSalaryObservation[]> {
  const tenantId = getActiveTenantId();
  const rows = await db
    .select()
    .from(investigatorSalaryObservations)
    .where(
      and(
        eq(investigatorSalaryObservations.tenantId, tenantId),
        eq(investigatorSalaryObservations.dossierId, dossierId),
      ),
    )
    .orderBy(desc(investigatorSalaryObservations.observedAt));
  return rows.map(mapRowToObs);
}

export async function findById(
  observationId: string,
): Promise<InvestigatorSalaryObservation | null> {
  const tenantId = getActiveTenantId();
  const [row] = await db
    .select()
    .from(investigatorSalaryObservations)
    .where(
      and(
        eq(investigatorSalaryObservations.tenantId, tenantId),
        eq(investigatorSalaryObservations.id, observationId),
      ),
    )
    .limit(1);
  return row ? mapRowToObs(row) : null;
}

export async function create(
  data: SalaryCreateData,
): Promise<InvestigatorSalaryObservation> {
  const tenantId = getActiveTenantId();
  const id = randomUUID();
  const now = new Date().toISOString();

  const [row] = await db
    .insert(investigatorSalaryObservations)
    .values({
      id,
      tenantId,
      dossierId: data.dossierId,
      runId: data.runId ?? null,
      roleScope: data.roleScope ?? null,
      geoScope: data.geoScope ?? null,
      currency: data.currency ?? "USD",
      payInterval: data.payInterval ?? null,
      minAmount: data.minAmount ?? null,
      maxAmount: data.maxAmount ?? null,
      equityText: data.equityText ?? null,
      bonusText: data.bonusText ?? null,
      confidenceLabel: data.confidenceLabel,
      sourceId: data.sourceId ?? null,
      observedAt: data.observedAt ?? Math.floor(Date.now() / 1000),
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return mapRowToObs(row);
}

export async function update(
  observationId: string,
  data: SalaryUpdateData,
): Promise<InvestigatorSalaryObservation | null> {
  const tenantId = getActiveTenantId();
  const now = new Date().toISOString();

  const setValues: Partial<typeof investigatorSalaryObservations.$inferInsert> =
    { updatedAt: now };
  if ("roleScope" in data) setValues.roleScope = data.roleScope ?? null;
  if ("geoScope" in data) setValues.geoScope = data.geoScope ?? null;
  if ("currency" in data) setValues.currency = data.currency ?? null;
  if ("payInterval" in data) setValues.payInterval = data.payInterval ?? null;
  if ("minAmount" in data) setValues.minAmount = data.minAmount ?? null;
  if ("maxAmount" in data) setValues.maxAmount = data.maxAmount ?? null;
  if ("equityText" in data) setValues.equityText = data.equityText ?? null;
  if ("bonusText" in data) setValues.bonusText = data.bonusText ?? null;
  if (data.confidenceLabel !== undefined)
    setValues.confidenceLabel = data.confidenceLabel;
  if ("sourceId" in data) setValues.sourceId = data.sourceId ?? null;
  if ("observedAt" in data) setValues.observedAt = data.observedAt ?? null;
  if ("notes" in data) setValues.notes = data.notes ?? null;

  const rows = await db
    .update(investigatorSalaryObservations)
    .set(setValues)
    .where(
      and(
        eq(investigatorSalaryObservations.tenantId, tenantId),
        eq(investigatorSalaryObservations.id, observationId),
      ),
    )
    .returning();
  return rows[0] ? mapRowToObs(rows[0]) : null;
}

export async function deleteById(observationId: string): Promise<boolean> {
  const tenantId = getActiveTenantId();
  const rows = await db
    .delete(investigatorSalaryObservations)
    .where(
      and(
        eq(investigatorSalaryObservations.tenantId, tenantId),
        eq(investigatorSalaryObservations.id, observationId),
      ),
    )
    .returning({ id: investigatorSalaryObservations.id });
  return rows.length > 0;
}
