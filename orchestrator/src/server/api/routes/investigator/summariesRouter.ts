import { badRequest, notFound } from "@infra/errors";
import { asyncRoute, fail, ok } from "@infra/http";
import * as summaryService from "@server/services/investigator/summaryService";
import {
  RegenerateInvestigatorSummaryInputSchema,
  SummaryReviewState,
} from "@shared/types";
import { Router } from "express";
import { z } from "zod";

export const summariesRouter = Router({ mergeParams: true });

const summaryReviewStateValues = Object.values(SummaryReviewState) as [
  SummaryReviewState,
  ...SummaryReviewState[],
];

const editBodySchema = z
  .object({
    bodyMarkdown: z.string().optional(),
    reviewState: z.enum(summaryReviewStateValues).optional(),
  })
  .strict();

// GET /api/investigator/dossiers/:dossierId/summaries
summariesRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const { dossierId } = req.params as { dossierId: string };
    const latestOnly = req.query.latest === "true";

    const summaries = await summaryService.listSummaries(dossierId);

    if (latestOnly) {
      const latestByType = new Map<string, (typeof summaries)[number]>();
      for (const s of summaries) {
        const existing = latestByType.get(s.summaryType);
        if (!existing || s.version > existing.version) {
          latestByType.set(s.summaryType, s);
        }
      }
      return ok(res, Array.from(latestByType.values()));
    }

    ok(res, summaries);
  }),
);

// POST /api/investigator/dossiers/:dossierId/summaries/regenerate
summariesRouter.post(
  "/regenerate",
  asyncRoute(async (req, res) => {
    const { dossierId } = req.params as { dossierId: string };
    const parsed = RegenerateInvestigatorSummaryInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(
        res,
        badRequest("Invalid summary request", parsed.error.flatten()),
      );
    }
    const summary = await summaryService.regenerateSummary(
      dossierId,
      parsed.data.summaryType,
      parsed.data.runId ?? null,
    );
    ok(res, summary, 201);
  }),
);

// PATCH /api/investigator/dossiers/:dossierId/summaries/:summaryId
summariesRouter.patch(
  "/:summaryId",
  asyncRoute(async (req, res) => {
    const { dossierId, summaryId } = req.params as {
      dossierId: string;
      summaryId: string;
    };
    const parsed = editBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(
        res,
        badRequest("Invalid summary data", parsed.error.flatten()),
      );
    }
    const target = await summaryService.getSummaryById(summaryId, dossierId);
    if (!target) {
      return fail(res, notFound("Summary not found"));
    }
    const updated = await summaryService.editSummary(summaryId, parsed.data);
    ok(res, updated);
  }),
);
