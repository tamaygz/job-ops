import { badRequest, notFound, toAppError } from "@infra/errors";
import { asyncRoute, fail, ok } from "@infra/http";
import { logger } from "@infra/logger";
import * as sourceRepo from "@server/repositories/investigatorSourceRepository";
import * as sourceService from "@server/services/investigator/sourceService";
import {
  CreateInvestigatorSourceInputSchema,
  ReviewState,
  SourceType,
  UpdateInvestigatorSourceInputSchema,
} from "@shared/types";
import { type Request, type Response, Router } from "express";
import { z } from "zod";

export const sourcesRouter = Router({ mergeParams: true });

const log = logger.child({ router: "sourcesRouter" });

// ---------------------------------------------------------------------------
// Param / query schemas
// ---------------------------------------------------------------------------

const sourcesParamsSchema = z.object({
  dossierId: z.string().trim().min(1).max(255),
});

const sourceParamsSchema = z.object({
  dossierId: z.string().trim().min(1).max(255),
  sourceId: z.string().trim().min(1).max(255),
});

const listQuerySchema = z.object({
  reviewState: z
    .enum(Object.values(ReviewState) as [ReviewState, ...ReviewState[]])
    .optional(),
  sourceType: z
    .enum(Object.values(SourceType) as [SourceType, ...SourceType[]])
    .optional(),
});

// ---------------------------------------------------------------------------
// GET /api/investigator/dossiers/:dossierId/sources — list sources
// ---------------------------------------------------------------------------

sourcesRouter.get(
  "/",
  asyncRoute(async (req: Request, res: Response) => {
    const params = sourcesParamsSchema.safeParse(req.params);
    if (!params.success) {
      return fail(
        res,
        badRequest("Invalid dossier id", params.error.flatten()),
      );
    }

    const query = listQuerySchema.safeParse(req.query);
    if (!query.success) {
      return fail(
        res,
        badRequest("Invalid query params", query.error.flatten()),
      );
    }

    const sources = await sourceService.listSources(
      params.data.dossierId,
      query.data,
    );
    return ok(res, sources);
  }),
);

// ---------------------------------------------------------------------------
// POST /api/investigator/dossiers/:dossierId/sources — create source
// ---------------------------------------------------------------------------

sourcesRouter.post(
  "/",
  asyncRoute(async (req: Request, res: Response) => {
    const params = sourcesParamsSchema.safeParse(req.params);
    if (!params.success) {
      return fail(
        res,
        badRequest("Invalid dossier id", params.error.flatten()),
      );
    }

    const body = CreateInvestigatorSourceInputSchema.safeParse(req.body ?? {});
    if (!body.success) {
      return fail(
        res,
        badRequest("Invalid source payload", body.error.flatten()),
      );
    }

    try {
      const result = await sourceService.saveSource(
        params.data.dossierId,
        body.data,
      );
      const status = result.deduplicated ? 200 : 201;
      log.info("Source saved", {
        dossierId: params.data.dossierId,
        sourceId: result.source.id,
        deduplicated: result.deduplicated,
      });
      return ok(res, result.source, status);
    } catch (err) {
      return fail(res, toAppError(err));
    }
  }),
);

// ---------------------------------------------------------------------------
// PATCH /api/investigator/dossiers/:dossierId/sources/:sourceId — update source
// ---------------------------------------------------------------------------

sourcesRouter.patch(
  "/:sourceId",
  asyncRoute(async (req: Request, res: Response) => {
    const params = sourceParamsSchema.safeParse(req.params);
    if (!params.success) {
      return fail(res, badRequest("Invalid params", params.error.flatten()));
    }

    const body = UpdateInvestigatorSourceInputSchema.safeParse(req.body ?? {});
    if (!body.success) {
      return fail(
        res,
        badRequest("Invalid source payload", body.error.flatten()),
      );
    }

    // Verify ownership before update: ensure source belongs to this dossier
    const existing = await sourceRepo.findById(params.data.sourceId);
    if (!existing || existing.dossierId !== params.data.dossierId) {
      return fail(res, notFound(`Source ${params.data.sourceId} not found`));
    }

    try {
      const updated = await sourceService.updateSource(
        params.data.sourceId,
        body.data,
      );
      return ok(res, updated);
    } catch (err) {
      return fail(res, toAppError(err));
    }
  }),
);

// ---------------------------------------------------------------------------
// DELETE /api/investigator/dossiers/:dossierId/sources/:sourceId — delete source
// ---------------------------------------------------------------------------

sourcesRouter.delete(
  "/:sourceId",
  asyncRoute(async (req: Request, res: Response) => {
    const params = sourceParamsSchema.safeParse(req.params);
    if (!params.success) {
      return fail(res, badRequest("Invalid params", params.error.flatten()));
    }

    // Verify ownership before delete
    const existing = await sourceRepo.findById(params.data.sourceId);
    if (!existing || existing.dossierId !== params.data.dossierId) {
      return fail(res, notFound(`Source ${params.data.sourceId} not found`));
    }

    try {
      await sourceService.deleteSource(params.data.sourceId);
      res.status(204).end();
    } catch (err) {
      return fail(res, toAppError(err));
    }
  }),
);
