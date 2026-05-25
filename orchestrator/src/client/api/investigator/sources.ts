import type {
  CreateInvestigatorSourceInput,
  InvestigatorSource,
  UpdateInvestigatorSourceInput,
} from "@shared/types";
import { fetchApi } from "../core";

export function listSources(dossierId: string): Promise<InvestigatorSource[]> {
  return fetchApi<InvestigatorSource[]>(
    `/investigator/dossiers/${dossierId}/sources`,
  );
}

export function createSource(
  dossierId: string,
  input: CreateInvestigatorSourceInput,
): Promise<InvestigatorSource> {
  return fetchApi<InvestigatorSource>(
    `/investigator/dossiers/${dossierId}/sources`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function updateSource(
  dossierId: string,
  sourceId: string,
  data: UpdateInvestigatorSourceInput,
): Promise<InvestigatorSource> {
  return fetchApi<InvestigatorSource>(
    `/investigator/dossiers/${dossierId}/sources/${sourceId}`,
    { method: "PATCH", body: JSON.stringify(data) },
  );
}

export function deleteSource(
  dossierId: string,
  sourceId: string,
): Promise<void> {
  return fetchApi<void>(
    `/investigator/dossiers/${dossierId}/sources/${sourceId}`,
    { method: "DELETE" },
  );
}
