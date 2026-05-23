import type {
  InvestigatorSummary,
  RegenerateInvestigatorSummaryInput,
} from "@shared/types";
import { fetchApi, withQuery } from "../core";

export function listSummaries(
  dossierId: string,
  opts?: { latestOnly?: boolean },
): Promise<InvestigatorSummary[]> {
  return fetchApi<InvestigatorSummary[]>(
    withQuery(`/investigator/dossiers/${dossierId}/summaries`, {
      latest: opts?.latestOnly ? "true" : undefined,
    }),
  );
}

export function regenerateSummary(
  dossierId: string,
  input: RegenerateInvestigatorSummaryInput,
): Promise<InvestigatorSummary> {
  return fetchApi<InvestigatorSummary>(
    `/investigator/dossiers/${dossierId}/summaries/regenerate`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function editSummary(
  dossierId: string,
  summaryId: string,
  data: { bodyMarkdown?: string; reviewState?: string },
): Promise<InvestigatorSummary> {
  return fetchApi<InvestigatorSummary>(
    `/investigator/dossiers/${dossierId}/summaries/${summaryId}`,
    { method: "PATCH", body: JSON.stringify(data) },
  );
}
