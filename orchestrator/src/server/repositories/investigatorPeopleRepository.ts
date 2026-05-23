import { randomUUID } from "node:crypto";
import type {
  ConfidenceLabel,
  InvestigatorPerson,
  PersonType,
} from "@shared/types";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { getActiveTenantId } from "../tenancy/context";

const { investigatorPeople } = schema;

export type PersonCreateData = {
  dossierId: string;
  runId?: string | null;
  fullName: string;
  personType: PersonType;
  title?: string | null;
  profileUrl?: string | null;
  roleContext?: string | null;
  notes?: string | null;
  confidenceLabel: ConfidenceLabel;
  sourceIds?: string[];
};

export type PersonUpdateData = {
  fullName?: string;
  personType?: PersonType;
  title?: string | null;
  profileUrl?: string | null;
  roleContext?: string | null;
  notes?: string | null;
  confidenceLabel?: ConfidenceLabel;
  sourceIds?: string[];
};

function mapRowToPerson(
  row: typeof investigatorPeople.$inferSelect,
): InvestigatorPerson {
  return {
    id: row.id,
    tenantId: row.tenantId,
    dossierId: row.dossierId,
    runId: row.runId ?? null,
    fullName: row.fullName,
    personType: row.personType as InvestigatorPerson["personType"],
    title: row.title ?? null,
    profileUrl: row.profileUrl ?? null,
    roleContext: row.roleContext ?? null,
    notes: row.notes ?? null,
    confidenceLabel:
      row.confidenceLabel as InvestigatorPerson["confidenceLabel"],
    sourceIds: (row.sourceIds as string[]) ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findByDossier(
  dossierId: string,
): Promise<InvestigatorPerson[]> {
  const tenantId = getActiveTenantId();
  const rows = await db
    .select()
    .from(investigatorPeople)
    .where(
      and(
        eq(investigatorPeople.tenantId, tenantId),
        eq(investigatorPeople.dossierId, dossierId),
      ),
    )
    .orderBy(
      asc(investigatorPeople.personType),
      asc(investigatorPeople.fullName),
    );
  return rows.map(mapRowToPerson);
}

export async function findById(
  personId: string,
): Promise<InvestigatorPerson | null> {
  const tenantId = getActiveTenantId();
  const [row] = await db
    .select()
    .from(investigatorPeople)
    .where(
      and(
        eq(investigatorPeople.tenantId, tenantId),
        eq(investigatorPeople.id, personId),
      ),
    )
    .limit(1);
  return row ? mapRowToPerson(row) : null;
}

export async function create(
  data: PersonCreateData,
): Promise<InvestigatorPerson> {
  const tenantId = getActiveTenantId();
  const id = randomUUID();
  const now = new Date().toISOString();

  const [row] = await db
    .insert(investigatorPeople)
    .values({
      id,
      tenantId,
      dossierId: data.dossierId,
      runId: data.runId ?? null,
      fullName: data.fullName,
      personType: data.personType,
      title: data.title ?? null,
      profileUrl: data.profileUrl ?? null,
      roleContext: data.roleContext ?? null,
      notes: data.notes ?? null,
      confidenceLabel: data.confidenceLabel,
      sourceIds: data.sourceIds ?? [],
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return mapRowToPerson(row);
}

export async function update(
  personId: string,
  data: PersonUpdateData,
): Promise<InvestigatorPerson | null> {
  const tenantId = getActiveTenantId();
  const now = new Date().toISOString();

  const setValues: Partial<typeof investigatorPeople.$inferInsert> = {
    updatedAt: now,
  };
  if (data.fullName !== undefined) setValues.fullName = data.fullName;
  if (data.personType !== undefined) setValues.personType = data.personType;
  if (data.title !== undefined) setValues.title = data.title ?? null;
  if (data.profileUrl !== undefined)
    setValues.profileUrl = data.profileUrl ?? null;
  if (data.roleContext !== undefined)
    setValues.roleContext = data.roleContext ?? null;
  if (data.notes !== undefined) setValues.notes = data.notes ?? null;
  if (data.confidenceLabel !== undefined)
    setValues.confidenceLabel = data.confidenceLabel;
  if (data.sourceIds !== undefined) setValues.sourceIds = data.sourceIds;

  const rows = await db
    .update(investigatorPeople)
    .set(setValues)
    .where(
      and(
        eq(investigatorPeople.tenantId, tenantId),
        eq(investigatorPeople.id, personId),
      ),
    )
    .returning();
  return rows[0] ? mapRowToPerson(rows[0]) : null;
}

export async function deleteById(personId: string): Promise<boolean> {
  const tenantId = getActiveTenantId();
  const rows = await db
    .delete(investigatorPeople)
    .where(
      and(
        eq(investigatorPeople.tenantId, tenantId),
        eq(investigatorPeople.id, personId),
      ),
    )
    .returning({ id: investigatorPeople.id });
  return rows.length > 0;
}
