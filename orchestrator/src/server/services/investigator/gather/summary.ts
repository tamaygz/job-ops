import type { RunKind, SummaryType } from "@shared/types";
import * as summaryService from "@server/services/investigator/summaryService";
import type { InvestigatorGatherContext } from "./types";

const SUMMARY_TYPES_BY_RUN_KIND: Record<RunKind, SummaryType[]> = {
  company_brief: ["company_brief", "interview_angles"],
  people_scan: ["people_brief"],
  dossier_refresh: [
    "company_brief",
    "people_brief",
    "interview_angles",
  ],
};

export async function runSummaryPhase(
  context: InvestigatorGatherContext,
): Promise<{ createdCount: number }> {
  const summaryTypes = SUMMARY_TYPES_BY_RUN_KIND[context.runKind] ?? [];
  let createdCount = 0;

  for (const summaryType of summaryTypes) {
    await summaryService.regenerateSummary(
      context.dossierId,
      summaryType,
      context.runId,
      context.researchQuestion,
    );
    createdCount += 1;

    context.reportProgress({
      runId: context.runId,
      dossierId: context.dossierId,
      status: "running",
      phase: "summary",
      message: `Generated ${summaryType.replace(/_/g, " ")}`,
    });
  }

  return { createdCount };
}
