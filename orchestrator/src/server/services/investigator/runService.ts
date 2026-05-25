import { conflict, notFound } from "@infra/errors";
import { logger } from "@infra/logger";
import { getJobQueue } from "@server/infra/job-queue-registry";
import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import * as runRepo from "@server/repositories/investigatorRunRepository";
import * as timelineRepo from "@server/repositories/investigatorTimelineRepository";
import { getActiveTenantId } from "@server/tenancy/context";
import type {
  InvestigatorResearchRun,
  StartInvestigatorRunInput,
} from "@shared/types";
import { scheduleResearchRunWorker } from "./runWorker";

const log = logger.child({ service: "runService" });

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export async function startRun(
  dossierId: string,
  input: StartInvestigatorRunInput,
): Promise<InvestigatorResearchRun> {
  const dossier = await dossierRepo.findById(dossierId);
  if (!dossier) {
    throw notFound(`Dossier ${dossierId} not found`);
  }

  const existing = await runRepo.findActiveForDossierAndKind(
    dossierId,
    input.runKind,
  );
  if (existing) {
    throw conflict(
      `A run of kind "${input.runKind}" is already ${existing.status} for dossier ${dossierId} (runId: ${existing.id})`,
    );
  }

  const tenantId = getActiveTenantId();
  const run = await runRepo.create({
    dossierId,
    runKind: input.runKind,
    seedContext: input.seedContext ?? null,
    initiatedBy: "user",
  });

  await getJobQueue().enqueue(
    "investigator_research_run",
    {
      tenantId,
      dossierId,
      runId: run.id,
      runKind: input.runKind,
    },
    { dedupeKey: `${tenantId}:${run.id}` },
  );

  await timelineRepo.insertEvent({
    dossierId,
    runId: run.id,
    eventType: "run_started",
    payload: { runKind: input.runKind, runId: run.id },
    occurredAt: nowSeconds(),
  });

  log.info("Research run started", {
    dossierId,
    runId: run.id,
    runKind: input.runKind,
  });

  scheduleResearchRunWorker();
  return run;
}

export async function cancelRun(
  dossierId: string,
  runId: string,
): Promise<InvestigatorResearchRun> {
  const run = await runRepo.findById(runId);
  if (!run || run.dossierId !== dossierId) {
    throw notFound(`Run ${runId} not found for dossier ${dossierId}`);
  }

  const TERMINAL_STATUSES = new Set([
    "completed",
    "failed",
    "partial_failed",
    "cancelled",
  ]);
  if (TERMINAL_STATUSES.has(run.status)) {
    throw conflict(
      `Run ${runId} is already in terminal status "${run.status}" and cannot be cancelled`,
    );
  }

  const updated = await runRepo.updateStatus(runId, "cancelled");
  if (!updated) {
    throw notFound(`Run ${runId} not found after cancel attempt`);
  }

  // No run_cancelled event type defined in v1; record via run_failed with user_cancelled reason
  await timelineRepo.insertEvent({
    dossierId,
    runId,
    eventType: "run_failed",
    payload: { runKind: run.runKind, runId, reason: "user_cancelled" },
    occurredAt: nowSeconds(),
  });

  log.info("Research run cancelled", { dossierId, runId });
  return updated;
}
