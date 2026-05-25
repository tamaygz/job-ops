import * as sourceService from "@server/services/investigator/sourceService";
import type { InvestigatorProvider } from "../types";
import {
  fetchPageText,
  isBlockedHost,
} from "../utils/html";
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

function buildCandidateUrls(baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const urls = new Set<string>();

  for (const path of PATHS) {
    const next = new URL(path, base).toString();
    urls.add(next);
  }

  return Array.from(urls);
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

    if (isBlockedHost(companyUrl)) {
      return { status: "skipped", message: "Company URL blocked" };
    }

    const candidates = buildCandidateUrls(companyUrl);
    let created = 0;

    for (const url of candidates) {
      if (isBlockedHost(url)) continue;

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
