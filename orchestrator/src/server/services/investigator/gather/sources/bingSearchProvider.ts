import * as sourceService from "@server/services/investigator/sourceService";
import type { InvestigatorProvider } from "../types";
import { truncateText } from "../utils/text";

const MAX_EXCERPT_CHARS = 1200;

type BingResult = {
  name?: string;
  url?: string;
  snippet?: string;
};

type BingResponse = {
  webPages?: { value?: BingResult[] };
};

function inferSourceType(url: string | null):
  | "news_article"
  | "review_site"
  | "public_profile"
  | "other_web_page" {
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

export const bingSearchProvider: InvestigatorProvider = {
  id: "bing_search",
  displayName: "Bing web search",
  phase: "sources",
  requiredSettings: ["bingSearchApiKey"],
  async run(context) {
    const apiKey = context.settings.bingSearchApiKey;
    if (!apiKey) {
      return { status: "skipped", message: "Missing Bing API key" };
    }

    const query = buildQuery(
      context.dossier.companyName,
      context.dossier.companyUrl,
    );

    const url = new URL(context.settings.bingSearchEndpoint);
    url.searchParams.set("q", query);
    url.searchParams.set(
      "count",
      String(context.settings.bingSearchResultLimit),
    );
    url.searchParams.set("mkt", context.settings.bingSearchMarket);

    const response = await fetch(url.toString(), {
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
      },
    });

    if (!response.ok) {
      return {
        status: "failed",
        message: `Bing search failed (${response.status})`,
      };
    }

    const data = (await response.json()) as BingResponse;
    const results = data.webPages?.value ?? [];

    if (results.length === 0) {
      return { status: "success", createdCount: 0, message: "No results" };
    }

    let created = 0;

    for (const result of results) {
      const title = result.name?.trim();
      const snippet = result.snippet?.trim();
      const link = result.url?.trim();
      if (!title || !snippet) continue;

      const excerpt = truncateText(snippet, MAX_EXCERPT_CHARS);

      const saved = await sourceService.saveSource(context.dossierId, {
        runId: context.runId,
        sourceType: inferSourceType(link ?? null),
        title,
        url: link ?? null,
        capturedExcerpt: excerpt,
        retrievedAt: Math.floor(Date.now() / 1000),
      });

      if (!saved.deduplicated) created += 1;
    }

    return {
      status: "success",
      createdCount: created,
      message: `Saved ${created} search results`,
    };
  },
};
