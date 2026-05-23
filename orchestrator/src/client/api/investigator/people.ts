import type {
  CreateInvestigatorPersonInput,
  InvestigatorPerson,
  UpdateInvestigatorPersonInput,
} from "@shared/types";
import { fetchApi } from "../core";

export function listPeople(dossierId: string): Promise<InvestigatorPerson[]> {
  return fetchApi<InvestigatorPerson[]>(
    `/investigator/dossiers/${dossierId}/people`,
  );
}

export function createPerson(
  dossierId: string,
  input: CreateInvestigatorPersonInput,
): Promise<InvestigatorPerson> {
  return fetchApi<InvestigatorPerson>(
    `/investigator/dossiers/${dossierId}/people`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function updatePerson(
  dossierId: string,
  personId: string,
  data: UpdateInvestigatorPersonInput,
): Promise<InvestigatorPerson> {
  return fetchApi<InvestigatorPerson>(
    `/investigator/dossiers/${dossierId}/people/${personId}`,
    { method: "PATCH", body: JSON.stringify(data) },
  );
}

export function deletePerson(
  dossierId: string,
  personId: string,
): Promise<void> {
  return fetchApi<void>(
    `/investigator/dossiers/${dossierId}/people/${personId}`,
    { method: "DELETE" },
  );
}
