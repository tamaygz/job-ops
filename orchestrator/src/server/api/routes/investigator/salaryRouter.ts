import { badRequest, notFound } from "@infra/errors";
import { asyncRoute, fail, ok } from "@infra/http";
import * as salaryService from "@server/services/investigator/salaryService";
import {
  CreateInvestigatorSalaryObservationInputSchema,
  UpdateInvestigatorSalaryObservationInputSchema,
} from "@shared/types";
import { Router } from "express";

export const salaryRouter = Router({ mergeParams: true });

// GET /api/investigator/dossiers/:dossierId/salary-observations
salaryRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const { dossierId } = req.params as { dossierId: string };
    const observations = await salaryService.listObservations(dossierId);
    ok(res, observations);
  }),
);

// POST /api/investigator/dossiers/:dossierId/salary-observations
salaryRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const { dossierId } = req.params as { dossierId: string };
    const parsed = CreateInvestigatorSalaryObservationInputSchema.safeParse(
      req.body,
    );
    if (!parsed.success) {
      return fail(
        res,
        badRequest("Invalid salary observation data", parsed.error.flatten()),
      );
    }
    const obs = await salaryService.createObservation(dossierId, parsed.data);
    ok(res, obs, 201);
  }),
);

// PATCH /api/investigator/dossiers/:dossierId/salary-observations/:observationId
salaryRouter.patch(
  "/:observationId",
  asyncRoute(async (req, res) => {
    const { dossierId, observationId } = req.params as {
      dossierId: string;
      observationId: string;
    };
    const parsed = UpdateInvestigatorSalaryObservationInputSchema.safeParse(
      req.body,
    );
    if (!parsed.success) {
      return fail(
        res,
        badRequest("Invalid salary observation data", parsed.error.flatten()),
      );
    }
    const existing = await salaryService.getObservation(observationId);
    if (existing.dossierId !== dossierId) {
      return fail(res, notFound("Salary observation not found"));
    }
    const updated = await salaryService.updateObservation(
      observationId,
      parsed.data,
    );
    ok(res, updated);
  }),
);

// DELETE /api/investigator/dossiers/:dossierId/salary-observations/:observationId
salaryRouter.delete(
  "/:observationId",
  asyncRoute(async (req, res) => {
    const { dossierId, observationId } = req.params as {
      dossierId: string;
      observationId: string;
    };
    const existing = await salaryService.getObservation(observationId);
    if (existing.dossierId !== dossierId) {
      return fail(res, notFound("Salary observation not found"));
    }
    await salaryService.deleteObservation(observationId);
    res.status(204).end();
  }),
);
