import { logger } from "@infra/logger";
import type { InvestigatorDossier, RunKind } from "@shared/types";
import { notifyRunProgress } from "../runProgress";
import { loadInvestigatorGatherSettings } from "./settings";
import { runPeopleProviders } from "./people";
import { runSalaryProviders } from "./salary";
import { runSourceProviders } from "./sources";
import { runSummaryPhase } from "./summary";
import type { InvestigatorGatherContext } from "./types";

const log = logger.child({ service: "investigatorGather" });

const PHASE_PLAN: Record<RunKind, { people: boolean; salary: boolean }> = {
  company_brief: { people: false, salary: false },
  people_scan: { people: true, salary: false },
  dossier_refresh: { people: true, salary: true },
};

export type RunPhaseResult = {
  failures: Array<{ phase: string; providers: string[] }>;
};

export async function runInvestigatorPhases(args: {
  runId: string;
  dossierId: string;
  runKind: RunKind;
  dossier: InvestigatorDossier;
  seedContext: Record<string, unknown> | null;
}): Promise<RunPhaseResult> {
  const settings = await loadInvestigatorGatherSettings();

  const context: InvestigatorGatherContext = {
    runId: args.runId,
    dossierId: args.dossierId,
    runKind: args.runKind,
    dossier: args.dossier,
    seedContext: args.seedContext,
    settings,
    log: logger.child({
      service: "investigatorGather",
      runId: args.runId,
      dossierId: args.dossierId,
    }),
    reportProgress: notifyRunProgress,
  };

  const failures: RunPhaseResult["failures"] = [];

  context.reportProgress({
    runId: args.runId,
    dossierId: args.dossierId,
    status: "running",
    phase: "sources",
    message: "Starting source collection",
  });

  const sources = await runSourceProviders(context);
  if (sources.failures.length > 0) {
    failures.push({ phase: "sources", providers: sources.failures });
  }

  const plan = PHASE_PLAN[args.runKind];

  if (plan.people) {
    context.reportProgress({
      runId: args.runId,
      dossierId: args.dossierId,
      status: "running",
      phase: "people",
      message: "Starting people extraction",
    });

    const people = await runPeopleProviders(context);
    if (people.failures.length > 0) {
      failures.push({ phase: "people", providers: people.failures });
    }
  }

  if (plan.salary) {
    context.reportProgress({
      runId: args.runId,
      dossierId: args.dossierId,
      status: "running",
      phase: "salary",
      message: "Starting salary extraction",
    });

    const salary = await runSalaryProviders(context);
    if (salary.failures.length > 0) {
      failures.push({ phase: "salary", providers: salary.failures });
    }
  }

  context.reportProgress({
    runId: args.runId,
    dossierId: args.dossierId,
    status: "running",
    phase: "summary",
    message: "Generating summaries",
  });

  await runSummaryPhase(context);

  log.info("Investigator phases completed", {
    runId: args.runId,
    dossierId: args.dossierId,
    runKind: args.runKind,
    failures,
  });

  return { failures };
}
