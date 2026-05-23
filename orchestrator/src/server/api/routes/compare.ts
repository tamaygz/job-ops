/**
 * API routes for the Profile Compare feature.
 *
 * POST /api/compare/scrape   — Scrape and normalise a LinkedIn profile
 * POST /api/compare/evaluate — Stream section-level LLM evaluations via SSE
 * POST /api/compare/apply    — Copy a section into the user's Design Resume
 */

import { asyncRoute, fail, ok } from "@infra/http";
import { logger } from "@infra/logger";
import { setupSse, startSseHeartbeat, writeSseData } from "@infra/sse";
import { badRequest, notFound } from "@server/infra/errors";
import {
  applySection,
  buildCacheKey,
  evaluateSections,
  getCached,
  normaliseLinkedInHtml,
  scrapeLinkedInProfile,
  setCached,
} from "@server/services/compare";
import { getProfile } from "@server/services/profile";
import { getActiveTenantId } from "@server/tenancy/context";
import type {
  CompareSectionKey,
  NormalisedCompareProfile,
} from "@shared/types";
import { Router } from "express";
import { z } from "zod";

export const compareRouter = Router();

const LINKEDIN_URL_PATTERN =
  /^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?$/;

const VALID_SECTIONS: CompareSectionKey[] = [
  "basics",
  "experience",
  "education",
  "skills",
  "certifications",
  "projects",
  "languages",
  "awards",
];

const VALID_ACTIONS = ["copy", "copy_rewrite"] as const;

function canonicaliseUrl(raw: string): string {
  let url = raw.trim();
  // Normalise http to https
  if (url.startsWith("http://")) {
    url = `https://${url.slice(7)}`;
  }
  // Remove query params and hash
  const qIndex = url.indexOf("?");
  if (qIndex !== -1) url = url.slice(0, qIndex);
  const hIndex = url.indexOf("#");
  if (hIndex !== -1) url = url.slice(0, hIndex);
  // Strip trailing slash
  if (url.endsWith("/")) url = url.slice(0, -1);
  return url;
}

const scrapeSchema = z.object({
  url: z.string().trim().min(1, "URL is required"),
});

const evaluateSchema = z.object({
  otherProfileUrl: z.string().trim().min(1),
  jobId: z.string().trim().optional().nullable(),
});

const applySchema = z.object({
  otherProfileUrl: z.string().trim().min(1),
  section: z.string().trim().min(1),
  action: z.string().trim().min(1),
});

/**
 * POST /api/compare/scrape
 */
compareRouter.post(
  "/scrape",
  asyncRoute(async (req, res) => {
    const input = scrapeSchema.parse(req.body);
    const url = canonicaliseUrl(input.url);

    if (!LINKEDIN_URL_PATTERN.test(url)) {
      fail(
        res,
        badRequest(
          "URL must be a LinkedIn profile URL (https://www.linkedin.com/in/<slug>)",
        ),
      );
      return;
    }

    const tenantId = getActiveTenantId();
    const cacheKey = buildCacheKey(tenantId, url);

    const cached = getCached<NormalisedCompareProfile>(cacheKey);
    if (cached) {
      logger.info("Returning cached LinkedIn profile", { url });
      ok(res, cached);
      return;
    }

    const html = await scrapeLinkedInProfile(url);
    const profile = normaliseLinkedInHtml(html, url);

    setCached(cacheKey, profile);

    logger.info("Scraped and normalised LinkedIn profile", {
      url,
      name: profile.basics.name,
    });

    ok(res, profile);
  }),
);

/**
 * POST /api/compare/evaluate — SSE stream
 */
compareRouter.post(
  "/evaluate",
  asyncRoute(async (req, res) => {
    const input = evaluateSchema.parse(req.body);
    const url = canonicaliseUrl(input.otherProfileUrl);

    const tenantId = getActiveTenantId();
    const cacheKey = buildCacheKey(tenantId, url);
    const otherProfile = getCached<NormalisedCompareProfile>(cacheKey);

    if (!otherProfile) {
      fail(
        res,
        notFound("No cached profile found for this URL. Please scrape first."),
      );
      return;
    }

    const ownProfile = await getProfile();

    let jobDescription: string | undefined;
    if (input.jobId) {
      try {
        const { getJobById } = await import("@server/repositories/jobs");
        const job = getJobById(input.jobId);
        if (job?.jobDescription) {
          jobDescription = job.jobDescription;
        }
      } catch {
        logger.warn("Could not load job for compare evaluation", {
          jobId: input.jobId,
        });
      }
    }

    setupSse(res, { disableBuffering: true, flushHeaders: true });
    const stopHeartbeat = startSseHeartbeat(res);

    try {
      for await (const evaluation of evaluateSections(
        ownProfile,
        otherProfile,
        jobDescription,
      )) {
        writeSseData(res, { type: "section_eval", ...evaluation });
      }

      writeSseData(res, { type: "done" });
    } catch (error) {
      logger.error("Error during compare evaluation stream", {
        error: error instanceof Error ? error.message : String(error),
      });
      writeSseData(res, {
        type: "error",
        code: "INTERNAL_ERROR",
        message: "Evaluation failed",
      });
    } finally {
      stopHeartbeat();
      res.end();
    }
  }),
);

/**
 * POST /api/compare/apply
 */
compareRouter.post(
  "/apply",
  asyncRoute(async (req, res) => {
    const input = applySchema.parse(req.body);
    const url = canonicaliseUrl(input.otherProfileUrl);

    if (!VALID_SECTIONS.includes(input.section as CompareSectionKey)) {
      fail(res, badRequest(`Invalid section: ${input.section}`));
      return;
    }
    if (
      !VALID_ACTIONS.includes(input.action as (typeof VALID_ACTIONS)[number])
    ) {
      fail(
        res,
        badRequest(
          `Invalid action: ${input.action}. Must be 'copy' or 'copy_rewrite'`,
        ),
      );
      return;
    }

    const tenantId = getActiveTenantId();
    const cacheKey = buildCacheKey(tenantId, url);
    const otherProfile = getCached<NormalisedCompareProfile>(cacheKey);

    if (!otherProfile) {
      fail(
        res,
        notFound(
          "No cached profile found for this URL. The cache may have expired.",
        ),
      );
      return;
    }

    await applySection(
      input.section as CompareSectionKey,
      input.action as "copy" | "copy_rewrite",
      otherProfile,
    );

    ok(res, { updatedSection: input.section });
  }),
);
