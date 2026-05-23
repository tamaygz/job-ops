import { logger } from "@infra/logger";
import { runWithRequestContext } from "@infra/request-context";
import { sanitizeError } from "@infra/sanitize";
import type { InvestigatorResearchRunJobPayload } from "@server/infra/job-queue";
import { getJobQueue } from "@server/infra/job-queue-registry";
import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import * as runRepo from "@server/repositories/investigatorRunRepository";
import * as timelineRepo from "@server/repositories/investigatorTimelineRepository";
import { notifyRunProgress } from "./runProgress";

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
        // Execute phase stubs — actual logic lands in INV-008 through INV-012
        await runPhaseStubs(payload.runId, payload.dossierId, payload.runKind);

        const completedAt = Math.floor(Date.now() / 1000);
        await runRepo.updateStatus(payload.runId, "completed", { completedAt });
        notifyRunProgress({
          runId: payload.runId,
          dossierId: payload.dossierId,
          status: "completed",
        });
        await dossierRepo.update(payload.dossierId, {
          lastResearchedAt: completedAt,
        });

        await timelineRepo.insertEvent({
          dossierId: payload.dossierId,
          runId: payload.runId,
          eventType: "run_completed",
          payload: { runKind: payload.runKind, runId: payload.runId },
          occurredAt: completedAt,
        });

        log.info("Research run completed", {
          runId: payload.runId,
          dossierId: payload.dossierId,
          runKind: payload.runKind,
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

        // For v1 stubs the full run fails atomically; per-phase partial_failed
        // tracking is wired up when individual phase extractors land (INV-008+).
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

        await timelineRepo.insertEvent({
          dossierId: payload.dossierId,
          runId: payload.runId,
          eventType: "run_failed",
          payload: {
            runKind: payload.runKind,
            runId: payload.runId,
            errorCode,
            errorMessage,
          },
          occurredAt: failedAt,
        });

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

async function runPhaseStubs(
  runId: string,
  dossierId: string,
  runKind: string,
): Promise<void> {
  // Phase 1: source fetch — stub for INV-008
  log.info("Phase: source-fetch (stub)", { runId, dossierId, runKind });
  // Phase 2: people extraction — stub for INV-009
  log.info("Phase: people-extraction (stub)", { runId, dossierId, runKind });
  // Phase 3: salary extraction — stub for INV-010
  log.info("Phase: salary-extraction (stub)", { runId, dossierId, runKind });
  // Phase 4: summary generation — stub for INV-012
  log.info("Phase: summary-generation (stub)", { runId, dossierId, runKind });
}

/**
 * Exposed for integration tests — synchronously drains the queue.
 * In production code, use scheduleResearchRunWorker() instead.
 */
export async function drainResearchRunQueue(): Promise<void> {
  await drainQueue();
}
