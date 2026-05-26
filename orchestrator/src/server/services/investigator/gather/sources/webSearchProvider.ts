import { logger } from "@infra/logger";
import { sanitizeError } from "@infra/sanitize";
import * as sourceService from "@server/services/investigator/sourceService";
import * as timelineService from "@server/services/investigator/timelineService";
import { runWebSearch } from "@server/services/web-search/service";
import type { InvestigatorProvider } from "../types";
import { truncateText } from "../utils/text";

const log = logger.child({ source: "webSearchProvider" });

const MAX_EXCERPT_CHARS = 1200;

function inferSourceType(
  url: string | null,
): "news_article" | "review_site" | "public_profile" | "other_web_page" {
  if (!url) return "other_web_page";
  const lower = url.toLowerCase();
  if (lower.includes("news") || lower.includes("press")) return "news_article";
  if (lower.includes("glassdoor") || lower.includes("trustpilot")) {
    return "review_site";
  }
  if (lower.includes("linkedin") || lower.includes("crunchbase")) {
    return "public_profile";
  }
  return "other_web_page";
}

function buildQuery(companyName: string, companyUrl: string | null): string {
  if (!companyUrl) return companyName;
  try {
    const hostname = new URL(companyUrl).hostname.replace(/^www\./, "");
    return `${companyName} site:${hostname}`.trim();
  } catch {
    return companyName;
  }
}

export const webSearchProvider: InvestigatorProvider = {
  id: "web_search",
  displayName: "Web search",
  phase: "sources",
  async run(context) {
    const query = buildQuery(
      context.dossier.companyName,
      context.dossier.companyUrl,
    );

    const search = await runWebSearch(query);

    await timelineService
      .writeEvent(
        context.dossierId,
        "search_queried",
        {
          query,
          resultCount: search.results.length,
          providersAttempted: search.providersAttempted,
          providers: search.providerOutcomes.map((o) => ({
            id: o.providerId,
            name: o.displayName,
            status: o.status,
            resultCount: o.resultCount,
            ...(o.message ? { message: o.message } : {}),
          })),
        },
        { runId: context.runId },
      )
      .catch((err: unknown) => {
        log.warn("Failed to record search_queried timeline event", {
          dossierId: context.dossierId,
          error: sanitizeError(
            err instanceof Error ? err : new Error(String(err)),
          ),
        });
      });

    if (search.providersAttempted === 0) {
      return {
        status: "skipped",
        message: search.skipped[0] ?? "No web search providers configured",
      };
    }

    let created = 0;

    for (const result of search.results) {
      const title = result.title?.trim();
      const snippet = result.snippet?.trim();
      const link = result.url?.trim() || null;
      if (!title || !snippet) continue;

      const excerpt = truncateText(snippet, MAX_EXCERPT_CHARS);

      const saved = await sourceService.saveSource(context.dossierId, {
        runId: context.runId,
        sourceType: inferSourceType(link),
        title,
        url: link,
        capturedExcerpt: excerpt,
        retrievedAt: Math.floor(Date.now() / 1000),
      });

      if (!saved.deduplicated) created += 1;
    }

    const warnings = [...search.failures, ...search.skipped];
    const messageParts: string[] = [];
    if (created === 0) {
      messageParts.push("No search results");
    } else {
      messageParts.push(`Saved ${created} search results`);
    }
    if (search.failures.length > 0) {
      messageParts.push(`${search.failures.length} provider error(s)`);
    }

    return {
      status: "success",
      createdCount: created,
      message: messageParts.join(" | "),
      warnings: warnings.length ? warnings : undefined,
    };
  },
};
