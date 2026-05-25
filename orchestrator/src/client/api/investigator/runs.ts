import type {
  InvestigatorResearchRun,
  StartInvestigatorRunInput,
} from "@shared/types";
import { fetchApi } from "../core";

export function listRuns(
  dossierId: string,
): Promise<InvestigatorResearchRun[]> {
  return fetchApi<InvestigatorResearchRun[]>(
    `/investigator/dossiers/${dossierId}/runs`,
  );
}

export function getRun(
  dossierId: string,
  runId: string,
): Promise<InvestigatorResearchRun> {
  return fetchApi<InvestigatorResearchRun>(
    `/investigator/dossiers/${dossierId}/runs/${runId}`,
  );
}

export function startRun(
  dossierId: string,
  input: StartInvestigatorRunInput,
): Promise<InvestigatorResearchRun> {
  return fetchApi<InvestigatorResearchRun>(
    `/investigator/dossiers/${dossierId}/runs`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function cancelRun(
  dossierId: string,
  runId: string,
): Promise<InvestigatorResearchRun> {
  return fetchApi<InvestigatorResearchRun>(
    `/investigator/dossiers/${dossierId}/runs/${runId}/cancel`,
    { method: "POST" },
  );
}
