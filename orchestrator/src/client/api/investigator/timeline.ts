import type { InvestigatorTimelineEvent } from "@shared/types";
import { fetchApi, withQuery } from "../core";

export function listTimeline(
  dossierId: string,
  opts?: { limit?: number; before?: number; runId?: string },
): Promise<InvestigatorTimelineEvent[]> {
  return fetchApi<InvestigatorTimelineEvent[]>(
    withQuery(`/investigator/dossiers/${dossierId}/timeline`, {
      limit: opts?.limit,
      before: opts?.before,
      runId: opts?.runId,
    }),
  );
}
