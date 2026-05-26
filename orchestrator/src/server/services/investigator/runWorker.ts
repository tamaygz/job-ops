import { logger } from "@infra/logger";
import { runWithRequestContext } from "@infra/request-context";
import { sanitizeError } from "@infra/sanitize";
import type { InvestigatorResearchRunJobPayload } from "@server/infra/job-queue";
import { getJobQueue } from "@server/infra/job-queue-registry";
import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import * as runRepo from "@server/repositories/investigatorRunRepository";
import { runInvestigatorPhases } from "./gather/runPhases";
import { notifyRunProgress } from "./runProgress";
import { writeEvent } from "./timelineService";

const log = logger.child({ service: "runWorker" });

let workerPromise: Promise<void> | null = null;
let workerRequested = false;

export function scheduleResearchRunWorker(): void {
  workerRequested = true;
  if (workerPromise) return;
  workerPromise = drainWorkerLoop().finally(() => {
    workerPromise = null;
    if (workerRequested) {
      scheduleResearchRunWorker();
    }
  });
}

async function drainWorkerLoop(): Promise<void> {
  while (workerRequested) {
    workerRequested = false;
    await drainQueue();
  }
}

async function drainQueue(): Promise<void> {
  const queue = getJobQueue();
  while (true) {
    const queued = await queue.reserveNext("investigator_research_run");
    if (!queued) return;

    try {
      await processQueuedRun(queued.payload);
      await queue.acknowledge(queued.id);
    } catch (error) {
      log.error("Unexpected error processing investigator research run job", {
        queue: "investigator_research_run",
        tenantId: queued.payload.tenantId,
        runId: queued.payload.runId,
        dossierId: queued.payload.dossierId,
        error,
      });
      await queue.reject(queued.id);
    }
  }
}

async function processQueuedRun(
  payload: InvestigatorResearchRunJobPayload,
): Promise<void> {
  return runWithRequestContext(
    { tenantId: payload.tenantId, pipelineRunId: payload.runId },
    async () => {
      const run = await runRepo.findById(payload.runId);
      if (!run) {
        log.info("Skipping run: record not found", { runId: payload.runId });
        return;
      }
      if (run.status !== "queued") {
        log.info("Skipping run: not in queued state", {
          runId: payload.runId,
          status: run.status,
        });
        return;
      }

      const dossier = await dossierRepo.findById(payload.dossierId);
      if (!dossier) {
        log.info("Skipping run: dossier not found", {
          dossierId: payload.dossierId,
          runId: payload.runId,
        });
        return;
      }

      const startedAt = Math.floor(Date.now() / 1000);
      await runRepo.updateStatus(payload.runId, "running", { startedAt });
      notifyRunProgress({
        runId: payload.runId,
        dossierId: payload.dossierId,
        status: "running",
      });

      log.info("Research run processing started", {
        runId: payload.runId,
        dossierId: payload.dossierId,
        runKind: payload.runKind,
      });

      try {
        const researchQuestionValue = run.seedContext?.researchQuestion;
        const researchQuestion =
          typeof researchQuestionValue === "string"
            ? researchQuestionValue
            : null;

        const { failures } = await runInvestigatorPhases({
          runId: payload.runId,
          dossierId: payload.dossierId,
          runKind: payload.runKind,
          dossier,
          seedContext: run.seedContext,
          researchQuestion,
        });

        const latest = await runRepo.findById(payload.runId);
        if (latest?.status === "cancelled") {
          notifyRunProgress({
            runId: payload.runId,
            dossierId: payload.dossierId,
            status: "cancelled",
          });
          log.info("Research run cancelled before completion", {
            runId: payload.runId,
            dossierId: payload.dossierId,
            runKind: payload.runKind,
          });
          return;
        }

        const completedAt = Math.floor(Date.now() / 1000);
        const finalStatus =
          failures.length > 0 ? "partial_failed" : "completed";
        await runRepo.updateStatus(payload.runId, finalStatus, { completedAt });
        notifyRunProgress({
          runId: payload.runId,
          dossierId: payload.dossierId,
          status: finalStatus,
          message:
            failures.length > 0
              ? "One or more phases failed. Review details in the timeline."
              : undefined,
        });

        await dossierRepo.update(payload.dossierId, {
          lastResearchedAt: completedAt,
        });

        await writeEvent(
          payload.dossierId,
          failures.length > 0 ? "run_partial_failed" : "run_completed",
          failures.length > 0
            ? { runKind: payload.runKind, runId: payload.runId, failures }
            : { runKind: payload.runKind, runId: payload.runId },
          { runId: payload.runId, occurredAt: completedAt },
        );

        log.info("Research run completed", {
          runId: payload.runId,
          dossierId: payload.dossierId,
          runKind: payload.runKind,
          status: finalStatus,
          failures,
        });
      } catch (rawError) {
        const err =
          rawError instanceof Error ? rawError : new Error(String(rawError));
        const sanitized = sanitizeError(err);
        const errorMessage =
          typeof sanitized.message === "string"
            ? sanitized.message
            : "Unknown error";
        const errorCode =
          typeof sanitized.name === "string" ? sanitized.name : "Error";

        const failedAt = Math.floor(Date.now() / 1000);

        await runRepo.updateStatus(payload.runId, "failed", {
          completedAt: failedAt,
          errorCode,
          errorMessage,
        });
        notifyRunProgress({
          runId: payload.runId,
          dossierId: payload.dossierId,
          status: "failed",
          message: errorMessage,
        });

        await writeEvent(
          payload.dossierId,
          "run_failed",
          {
            runKind: payload.runKind,
            runId: payload.runId,
            errorCode,
            errorMessage,
          },
          { runId: payload.runId, occurredAt: failedAt },
        );

        log.error("Research run failed", {
          runId: payload.runId,
          dossierId: payload.dossierId,
          runKind: payload.runKind,
          error: rawError,
        });
        // Do NOT re-throw — prevents queue retry loop
      }
    },
  );
}

/**
 * Exposed for integration tests — synchronously drains the queue.
 * In production code, use scheduleResearchRunWorker() instead.
 */
export async function drainResearchRunQueue(): Promise<void> {
  await drainQueue();
}
