import { badRequest } from "@infra/errors";
import { asyncRoute, fail, ok } from "@infra/http";
import * as timelineService from "@server/services/investigator/timelineService";
import { Router } from "express";
import { z } from "zod";

export const timelineRouter = Router({ mergeParams: true });

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  before: z.coerce.number().int().optional(),
  runId: z.string().trim().min(1).max(255).optional(),
});

// GET /api/investigator/dossiers/:dossierId/timeline
timelineRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const { dossierId } = req.params as { dossierId: string };

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return fail(
        res,
        badRequest("Invalid query parameters", parsed.error.flatten()),
      );
    }

    const events = await timelineService.listEvents(dossierId, {
      limit: parsed.data.limit,
      before: parsed.data.before,
      runId: parsed.data.runId,
    });

    ok(res, events);
  }),
);
