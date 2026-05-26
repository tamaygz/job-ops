import { badRequest, notFound } from "@infra/errors";
import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import * as salaryRepo from "@server/repositories/investigatorSalaryRepository";
import type {
  CreateInvestigatorSalaryObservationInput,
  InvestigatorSalaryObservation,
  UpdateInvestigatorSalaryObservationInput,
} from "@shared/types";
import { writeEvent } from "./timelineService";

function validateAmountRange(
  minAmount: number | null | undefined,
  maxAmount: number | null | undefined,
): void {
  if (minAmount != null && maxAmount != null && minAmount > maxAmount) {
    throw badRequest("minAmount must be less than or equal to maxAmount");
  }
}

export async function createObservation(
  dossierId: string,
  input: CreateInvestigatorSalaryObservationInput,
): Promise<InvestigatorSalaryObservation> {
  const dossier = await dossierRepo.findById(dossierId);
  if (!dossier) throw notFound(`Dossier ${dossierId} not found`);

  validateAmountRange(input.minAmount, input.maxAmount);

  const obs = await salaryRepo.create({
    dossierId,
    runId: input.runId ?? null,
    roleScope: input.roleScope ?? null,
    geoScope: input.geoScope ?? null,
    currency: input.currency ?? "USD",
    payInterval: input.payInterval ?? null,
    minAmount: input.minAmount ?? null,
    maxAmount: input.maxAmount ?? null,
    equityText: input.equityText ?? null,
    bonusText: input.bonusText ?? null,
    confidenceLabel: input.confidenceLabel,
    sourceId: input.sourceId ?? null,
    observedAt: input.observedAt ?? null,
    notes: input.notes ?? null,
  });

  await writeEvent(
    dossierId,
    "salary_saved",
    { observationId: obs.id },
    { runId: input.runId ?? null, occurredAt: Math.floor(Date.now() / 1000) },
  );

  return obs;
}

export async function updateObservation(
  observationId: string,
  data: UpdateInvestigatorSalaryObservationInput,
): Promise<InvestigatorSalaryObservation> {
  const existing = await salaryRepo.findById(observationId);
  if (!existing) {
    throw notFound("Salary observation not found");
  }

  const nextMin = "minAmount" in data ? data.minAmount : existing.minAmount;
  const nextMax = "maxAmount" in data ? data.maxAmount : existing.maxAmount;
  validateAmountRange(nextMin, nextMax);

  const updated = await salaryRepo.update(observationId, data);
  if (!updated) {
    throw notFound("Salary observation not found");
  }
  return updated;
}

export async function deleteObservation(observationId: string): Promise<void> {
  const deleted = await salaryRepo.deleteById(observationId);
  if (!deleted) {
    throw notFound("Salary observation not found");
  }
}

export async function listObservations(
  dossierId: string,
): Promise<InvestigatorSalaryObservation[]> {
  return salaryRepo.findByDossier(dossierId);
}

export async function getObservation(
  observationId: string,
): Promise<InvestigatorSalaryObservation> {
  const obs = await salaryRepo.findById(observationId);
  if (!obs) {
    throw notFound("Salary observation not found");
  }
  return obs;
}
