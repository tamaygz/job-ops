import { badRequest, toAppError } from "@infra/errors";
import { asyncRoute, fail, ok } from "@infra/http";
import { logger } from "@infra/logger";
import * as dossierService from "@server/services/investigator/dossierService";
import { getActiveTenantId } from "@server/tenancy/context";
import {
  CreateInvestigatorDossierInputSchema,
  DossierStatus,
  LinkReason,
  UpdateInvestigatorDossierInputSchema,
} from "@shared/types";
import { type Request, type Response, Router } from "express";
import { z } from "zod";

export const dossiersRouter = Router();

const log = logger.child({ router: "dossiersRouter" });

// ---------------------------------------------------------------------------
// Local query / body schemas
// ---------------------------------------------------------------------------

const dossierStatusValues = Object.values(DossierStatus) as [
  DossierStatus,
  ...DossierStatus[],
];

const linkReasonValues = Object.values(LinkReason) as [string, ...string[]];

function booleanParam() {
  return z.preprocess((v) => {
    if (v === undefined) return undefined;
    if (typeof v === "boolean") return v;
    const lower = String(v).trim().toLowerCase();
    return lower === "1" || lower === "true" || lower === "yes";
  }, z.boolean().optional());
}

const listQuerySchema = z.object({
  q: z.string().trim().min(1).max(255).optional(),
  status: z.enum(dossierStatusValues).optional(),
  tag: z.string().trim().min(1).max(100).optional(),
  linkedJobId: z.string().trim().min(1).max(255).optional(),
  hasPeople: booleanParam(),
  stale: booleanParam(),
  sort: z.string().trim().min(1).max(50).optional(),
});

const dossiersParamsSchema = z.object({
  dossierId: z.string().trim().min(1).max(255),
});

const dossierJobsParamsSchema = z.object({
  dossierId: z.string().trim().min(1).max(255),
  jobId: z.string().trim().min(1).max(255),
});

const linkJobBodySchema = z.object({
  jobId: z.string().min(1).max(255),
  linkReason: z
    .enum(linkReasonValues as [string, ...string[]])
    .optional()
    .default("manual"),
});

const fromJobBodySchema = z.object({
  jobId: z.string().min(1).max(255),
});

// ---------------------------------------------------------------------------
// GET /api/investigator/dossiers
// ---------------------------------------------------------------------------

dossiersRouter.get(
  "/",
  asyncRoute(async (req: Request, res: Response) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return fail(
        res,
        badRequest("Invalid query parameters", parsed.error.flatten()),
      );
    }

    const items = await dossierService.listDossiers(parsed.data);
    return ok(res, items);
  }),
);

// ---------------------------------------------------------------------------
// POST /api/investigator/dossiers
// ---------------------------------------------------------------------------

dossiersRouter.post(
  "/",
  asyncRoute(async (req: Request, res: Response) => {
    const parsed = CreateInvestigatorDossierInputSchema.safeParse(
      req.body ?? {},
    );
    if (!parsed.success) {
      return fail(
        res,
        badRequest("Invalid dossier payload", parsed.error.flatten()),
      );
    }

    try {
      const dossier = await dossierService.createDossier(parsed.data);
      log.info("Dossier created", {
        dossierId: dossier.id,
        tenantId: getActiveTenantId(),
      });
      return ok(res, dossier, 201);
    } catch (err) {
      return fail(res, toAppError(err));
    }
  }),
);

// ---------------------------------------------------------------------------
// POST /api/investigator/dossiers/from-job
// ---------------------------------------------------------------------------

dossiersRouter.post(
  "/from-job",
  asyncRoute(async (req: Request, res: Response) => {
    const parsed = fromJobBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return fail(
        res,
        badRequest("Invalid from-job payload", parsed.error.flatten()),
      );
    }

    try {
      const dossier = await dossierService.createDossierFromJob(
        parsed.data.jobId,
      );
      log.info("Dossier created from job", {
        dossierId: dossier.id,
        jobId: parsed.data.jobId,
        tenantId: getActiveTenantId(),
      });
      return ok(res, dossier, 201);
    } catch (err) {
      return fail(res, toAppError(err));
    }
  }),
);

// ---------------------------------------------------------------------------
// GET /api/investigator/dossiers/:dossierId
// ---------------------------------------------------------------------------

dossiersRouter.get(
  "/:dossierId",
  asyncRoute(async (req: Request, res: Response) => {
    const parsed = dossiersParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return fail(
        res,
        badRequest("Invalid dossier id", parsed.error.flatten()),
      );
    }

    try {
      const dossier = await dossierService.getDossier(parsed.data.dossierId);
      return ok(res, dossier);
    } catch (err) {
      return fail(res, toAppError(err));
    }
  }),
);

// ---------------------------------------------------------------------------
// PATCH /api/investigator/dossiers/:dossierId
// ---------------------------------------------------------------------------

dossiersRouter.patch(
  "/:dossierId",
  asyncRoute(async (req: Request, res: Response) => {
    const paramsParsed = dossiersParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return fail(
        res,
        badRequest("Invalid dossier id", paramsParsed.error.flatten()),
      );
    }

    const bodyParsed = UpdateInvestigatorDossierInputSchema.safeParse(
      req.body ?? {},
    );
    if (!bodyParsed.success) {
      return fail(
        res,
        badRequest("Invalid update payload", bodyParsed.error.flatten()),
      );
    }

    try {
      const dossier = await dossierService.updateDossier(
        paramsParsed.data.dossierId,
        bodyParsed.data,
      );
      return ok(res, dossier);
    } catch (err) {
      return fail(res, toAppError(err));
    }
  }),
);

// ---------------------------------------------------------------------------
// POST /api/investigator/dossiers/:dossierId/jobs
// ---------------------------------------------------------------------------

dossiersRouter.post(
  "/:dossierId/jobs",
  asyncRoute(async (req: Request, res: Response) => {
    const paramsParsed = dossiersParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return fail(
        res,
        badRequest("Invalid dossier id", paramsParsed.error.flatten()),
      );
    }

    const bodyParsed = linkJobBodySchema.safeParse(req.body ?? {});
    if (!bodyParsed.success) {
      return fail(
        res,
        badRequest("Invalid link-job payload", bodyParsed.error.flatten()),
      );
    }

    try {
      await dossierService.linkJobToDossier(
        paramsParsed.data.dossierId,
        bodyParsed.data.jobId,
        bodyParsed.data.linkReason as import("@shared/types").LinkReason,
      );
      return ok(res, { linked: true });
    } catch (err) {
      return fail(res, toAppError(err));
    }
  }),
);

// ---------------------------------------------------------------------------
// DELETE /api/investigator/dossiers/:dossierId/jobs/:jobId
// ---------------------------------------------------------------------------

dossiersRouter.delete(
  "/:dossierId/jobs/:jobId",
  asyncRoute(async (req: Request, res: Response) => {
    const parsed = dossierJobsParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return fail(res, badRequest("Invalid params", parsed.error.flatten()));
    }

    try {
      await dossierService.unlinkJobFromDossier(
        parsed.data.dossierId,
        parsed.data.jobId,
      );
      res.status(204).end();
    } catch (err) {
      return fail(res, toAppError(err));
    }
  }),
);
