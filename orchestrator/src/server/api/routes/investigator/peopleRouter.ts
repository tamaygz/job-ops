import { notFound, toAppError } from "@infra/errors";
import { asyncRoute, fail, ok } from "@infra/http";
import * as peopleRepo from "@server/repositories/investigatorPeopleRepository";
import * as peopleSvc from "@server/services/investigator/peopleService";
import {
  CreateInvestigatorPersonInputSchema,
  UpdateInvestigatorPersonInputSchema,
} from "@shared/types";
import { Router } from "express";

export const peopleRouter = Router({ mergeParams: true });

// GET /api/investigator/dossiers/:dossierId/people
peopleRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const { dossierId } = req.params as { dossierId: string };
    const people = await peopleSvc.listPeople(dossierId);
    ok(res, people);
  }),
);

// POST /api/investigator/dossiers/:dossierId/people
peopleRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const { dossierId } = req.params as { dossierId: string };
    const parsed = CreateInvestigatorPersonInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, toAppError(parsed.error));
    }
    const person = await peopleSvc.createPerson(dossierId, parsed.data);
    ok(res, person, 201);
  }),
);

// PATCH /api/investigator/dossiers/:dossierId/people/:personId
peopleRouter.patch(
  "/:personId",
  asyncRoute(async (req, res) => {
    const params = req.params as {
      dossierId: string;
      personId: string;
    };
    const parsed = UpdateInvestigatorPersonInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, toAppError(parsed.error));
    }
    const existing = await peopleRepo.findById(params.personId);
    if (!existing || existing.dossierId !== params.dossierId) {
      return fail(res, notFound("Person not found"));
    }
    const updated = await peopleSvc.updatePerson(params.personId, parsed.data);
    ok(res, updated);
  }),
);

// DELETE /api/investigator/dossiers/:dossierId/people/:personId
peopleRouter.delete(
  "/:personId",
  asyncRoute(async (req, res) => {
    const params = req.params as {
      dossierId: string;
      personId: string;
    };
    const existing = await peopleRepo.findById(params.personId);
    if (!existing || existing.dossierId !== params.dossierId) {
      return fail(res, notFound("Person not found"));
    }
    await peopleSvc.deletePerson(params.personId);
    res.status(204).end();
  }),
);
