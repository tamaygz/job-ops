import type {
  CreateInvestigatorSalaryObservationInput,
  InvestigatorSalaryObservation,
  UpdateInvestigatorSalaryObservationInput,
} from "@shared/types";
import { fetchApi } from "../core";

export function listSalary(
  dossierId: string,
): Promise<InvestigatorSalaryObservation[]> {
  return fetchApi<InvestigatorSalaryObservation[]>(
    `/investigator/dossiers/${dossierId}/salary-observations`,
  );
}

export function createObservation(
  dossierId: string,
  input: CreateInvestigatorSalaryObservationInput,
): Promise<InvestigatorSalaryObservation> {
  return fetchApi<InvestigatorSalaryObservation>(
    `/investigator/dossiers/${dossierId}/salary-observations`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function updateObservation(
  dossierId: string,
  id: string,
  data: UpdateInvestigatorSalaryObservationInput,
): Promise<InvestigatorSalaryObservation> {
  return fetchApi<InvestigatorSalaryObservation>(
    `/investigator/dossiers/${dossierId}/salary-observations/${id}`,
    { method: "PATCH", body: JSON.stringify(data) },
  );
}

export function deleteObservation(
  dossierId: string,
  id: string,
): Promise<void> {
  return fetchApi<void>(
    `/investigator/dossiers/${dossierId}/salary-observations/${id}`,
    {
    method: "DELETE",
    },
  );
}
