import * as sourceService from "@server/services/investigator/sourceService";
import { buildCompanySiteCandidateUrls } from "@server/services/investigator/urlUtils";
import { isLocalOrPrivateHostname } from "@server/services/tracer-links";
import type { InvestigatorProvider } from "../types";
import { fetchPageText, isBlockedHost } from "../utils/html";
import { truncateText } from "../utils/text";

const MAX_EXCERPT_CHARS = 8000;
const MIN_TEXT_CHARS = 200;

const PATHS = [
  "",
  "/about",
  "/about-us",
  "/company",
  "/team",
  "/careers",
  "/jobs",
  "/contact",
] as const;

function isPublicHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    return !isLocalOrPrivateHostname(parsed.hostname);
  } catch {
    return false;
  }
}

export const companySiteProvider: InvestigatorProvider = {
  id: "company_site",
  displayName: "Company site",
  phase: "sources",
  async run(context) {
    const companyUrl = context.dossier.companyUrl;
    if (!companyUrl) {
      return { status: "skipped", message: "No company URL" };
    }

    if (!isPublicHttpUrl(companyUrl)) {
      return {
        status: "skipped",
        message: "Company URL is not a public HTTP(S) URL",
      };
    }

    if (isBlockedHost(companyUrl)) {
      return { status: "skipped", message: "Company URL blocked" };
    }

    const candidates = buildCompanySiteCandidateUrls(companyUrl, PATHS);
    if (candidates.length === 0) {
      return {
        status: "skipped",
        message: "Company URL is not a valid HTTP(S) URL",
      };
    }

    let created = 0;

    for (const url of candidates) {
      if (!isPublicHttpUrl(url) || isBlockedHost(url)) continue;

      const content = await fetchPageText(url).catch(() => null);
      if (!content || content.text.length < MIN_TEXT_CHARS) continue;

      const title = content.title || context.dossier.companyName;
      const excerpt = truncateText(
        [content.description, content.text].filter(Boolean).join("\n\n"),
        MAX_EXCERPT_CHARS,
      );

      const result = await sourceService.saveSource(context.dossierId, {
        runId: context.runId,
        sourceType: "company_site",
        title,
        url,
        capturedExcerpt: excerpt,
        retrievedAt: Math.floor(Date.now() / 1000),
      });

      if (!result.deduplicated) created += 1;
    }

    return {
      status: "success",
      createdCount: created,
      message: `Saved ${created} company site sources`,
    };
  },
};
