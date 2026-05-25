import { notFound } from "@infra/errors";
import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import * as peopleRepo from "@server/repositories/investigatorPeopleRepository";
import * as timelineRepo from "@server/repositories/investigatorTimelineRepository";
import type {
  CreateInvestigatorPersonInput,
  InvestigatorPerson,
  UpdateInvestigatorPersonInput,
} from "@shared/types";

export async function createPerson(
  dossierId: string,
  input: CreateInvestigatorPersonInput,
): Promise<InvestigatorPerson> {
  const dossier = await dossierRepo.findById(dossierId);
  if (!dossier) throw notFound(`Dossier ${dossierId} not found`);

  const person = await peopleRepo.create({
    dossierId,
    runId: input.runId ?? null,
    fullName: input.fullName,
    personType: input.personType,
    title: input.title ?? null,
    profileUrl: input.profileUrl ?? null,
    roleContext: input.roleContext ?? null,
    notes: input.notes ?? null,
    confidenceLabel: input.confidenceLabel,
    sourceIds: input.sourceIds ?? [],
  });

  await timelineRepo.insertEvent({
    dossierId,
    runId: input.runId ?? null,
    eventType: "person_saved",
    payload: { personId: person.id, fullName: person.fullName },
    occurredAt: Math.floor(Date.now() / 1000),
  });

  return person;
}

export async function updatePerson(
  personId: string,
  data: UpdateInvestigatorPersonInput,
): Promise<InvestigatorPerson> {
  const existing = await peopleRepo.findById(personId);
  if (!existing) {
    throw notFound("Person not found");
  }

  const updated = await peopleRepo.update(personId, {
    fullName: data.fullName,
    personType: data.personType,
    title: data.title,
    profileUrl: data.profileUrl,
    roleContext: data.roleContext,
    notes: data.notes,
    confidenceLabel: data.confidenceLabel,
    sourceIds: data.sourceIds,
  });

  if (!updated) {
    throw notFound("Person not found");
  }

  await timelineRepo.insertEvent({
    dossierId: existing.dossierId,
    runId: existing.runId,
    eventType: "person_saved",
    payload: { personId: updated.id, fullName: updated.fullName },
    occurredAt: Math.floor(Date.now() / 1000),
  });

  return updated;
}

export async function deletePerson(personId: string): Promise<void> {
  const deleted = await peopleRepo.deleteById(personId);
  if (!deleted) {
    throw notFound("Person not found");
  }
}

export async function listPeople(
  dossierId: string,
): Promise<InvestigatorPerson[]> {
  return peopleRepo.findByDossier(dossierId);
}

export async function getPerson(personId: string): Promise<InvestigatorPerson> {
  const person = await peopleRepo.findById(personId);
  if (!person) {
    throw notFound("Person not found");
  }
  return person;
}
