import { badRequest, notFound, toAppError } from "@infra/errors";
import { asyncRoute, fail, ok } from "@infra/http";
import { logger } from "@infra/logger";
import { setupSse, startSseHeartbeat, writeSseData } from "@infra/sse";
import * as runRepo from "@server/repositories/investigatorRunRepository";
import { subscribeToRunProgress } from "@server/services/investigator/runProgress";
import * as runService from "@server/services/investigator/runService";
import { StartInvestigatorRunInputSchema } from "@shared/types";
import { type Request, type Response, Router } from "express";
import { z } from "zod";

export const runsRouter = Router({ mergeParams: true });

const log = logger.child({ router: "runsRouter" });

// ---------------------------------------------------------------------------
// Param schemas
// ---------------------------------------------------------------------------

const runsParamsSchema = z.object({
  dossierId: z.string().trim().min(1).max(255),
});

const runParamsSchema = z.object({
  dossierId: z.string().trim().min(1).max(255),
  runId: z.string().trim().min(1).max(255),
});

// ---------------------------------------------------------------------------
// POST /api/investigator/dossiers/:dossierId/runs — start a run
// ---------------------------------------------------------------------------

runsRouter.post(
  "/",
  asyncRoute(async (req: Request, res: Response) => {
    const params = runsParamsSchema.safeParse(req.params);
    if (!params.success) {
      return fail(
        res,
        badRequest("Invalid dossier id", params.error.flatten()),
      );
    }

    const body = StartInvestigatorRunInputSchema.safeParse(req.body ?? {});
    if (!body.success) {
      return fail(res, badRequest("Invalid run payload", body.error.flatten()));
    }

    try {
      const run = await runService.startRun(params.data.dossierId, body.data);
      log.info("Run started", {
        dossierId: params.data.dossierId,
        runId: run.id,
      });
      return ok(res, run, 201);
    } catch (err) {
      return fail(res, toAppError(err));
    }
  }),
);

// ---------------------------------------------------------------------------
// GET /api/investigator/dossiers/:dossierId/runs — list runs
// ---------------------------------------------------------------------------

runsRouter.get(
  "/",
  asyncRoute(async (req: Request, res: Response) => {
    const params = runsParamsSchema.safeParse(req.params);
    if (!params.success) {
      return fail(
        res,
        badRequest("Invalid dossier id", params.error.flatten()),
      );
    }

    const runs = await runRepo.findByDossier(params.data.dossierId);
    return ok(res, runs);
  }),
);

// ---------------------------------------------------------------------------
// GET /api/investigator/dossiers/:dossierId/runs/:runId — run detail
// ---------------------------------------------------------------------------

runsRouter.get(
  "/:runId",
  asyncRoute(async (req: Request, res: Response) => {
    const params = runParamsSchema.safeParse(req.params);
    if (!params.success) {
      return fail(res, badRequest("Invalid params", params.error.flatten()));
    }

    const run = await runRepo.findById(params.data.runId);
    if (!run || run.dossierId !== params.data.dossierId) {
      return fail(res, notFound(`Run ${params.data.runId} not found`));
    }

    return ok(res, run);
  }),
);

// ---------------------------------------------------------------------------
// POST /api/investigator/dossiers/:dossierId/runs/:runId/cancel
// ---------------------------------------------------------------------------

runsRouter.post(
  "/:runId/cancel",
  asyncRoute(async (req: Request, res: Response) => {
    const params = runParamsSchema.safeParse(req.params);
    if (!params.success) {
      return fail(res, badRequest("Invalid params", params.error.flatten()));
    }

    try {
      const run = await runService.cancelRun(
        params.data.dossierId,
        params.data.runId,
      );
      return ok(res, run);
    } catch (err) {
      return fail(res, toAppError(err));
    }
  }),
);

// ---------------------------------------------------------------------------
// GET /api/investigator/dossiers/:dossierId/runs/:runId/progress — SSE stream
// ---------------------------------------------------------------------------

runsRouter.get("/:runId/progress", (req: Request, res: Response) => {
  const params = runParamsSchema.safeParse(req.params);
  if (!params.success) {
    fail(res, badRequest("Invalid params", params.error.flatten()));
    return;
  }

  setupSse(res, {
    cacheControl: "no-cache, no-transform",
    disableBuffering: true,
    flushHeaders: true,
  });

  const { runId } = params.data;

  const unsubscribe = subscribeToRunProgress((event) => {
    if (event.runId === runId) {
      writeSseData(res, event);
    }
  });

  const stopHeartbeat = startSseHeartbeat(res);

  req.on("close", () => {
    stopHeartbeat();
    unsubscribe();
  });
});
