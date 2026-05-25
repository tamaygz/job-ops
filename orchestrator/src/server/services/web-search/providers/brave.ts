import type { WebSearchProvider, WebSearchResult } from "../types";

type BraveWebResult = {
  title?: string;
  url?: string;
  description?: string;
};

type BraveResponse = {
  web?: { results?: BraveWebResult[] };
};

const BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

function resolveMarketTokens(market: string): {
  language: string | null;
  country: string | null;
} {
  const trimmed = market.trim();
  if (!trimmed) {
    return { language: null, country: null };
  }
  const [languageRaw, countryRaw] = trimmed.split(/[-_]/);
  return {
    language: languageRaw ? languageRaw.toLowerCase() : null,
    country: countryRaw ? countryRaw.toUpperCase() : null,
  };
}

function normalizeResult(
  result: BraveWebResult,
  index: number,
): WebSearchResult | null {
  const title = result.title?.trim();
  if (!title) return null;

  return {
    providerId: "brave",
    title,
    url: result.url?.trim() || null,
    snippet: result.description?.trim() || null,
    rank: index + 1,
  };
}

export const braveProvider: WebSearchProvider = {
  id: "brave",
  displayName: "Brave Search",
  async search(query, settings) {
    if (!settings.braveApiKey) {
      return { status: "skipped", message: "Missing Brave API key" };
    }

    const count = Math.min(20, Math.max(1, settings.resultLimit));
    const url = new URL(BRAVE_SEARCH_ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(count));

    const tokens = resolveMarketTokens(settings.market);
    if (tokens.language) {
      url.searchParams.set("search_lang", tokens.language);
    }
    if (tokens.country) {
      url.searchParams.set("country", tokens.country);
    }

    const response = await fetch(url.toString(), {
      headers: {
        "X-Subscription-Token": settings.braveApiKey,
      },
    });

    if (!response.ok) {
      return {
        status: "failed",
        message: `Brave search failed (${response.status})`,
      };
    }

    const payload = (await response.json()) as BraveResponse;
    const results = (payload.web?.results ?? [])
      .map(normalizeResult)
      .filter((item): item is WebSearchResult => Boolean(item));

    return {
      status: "success",
      results,
      message: results.length ? undefined : "No results",
    };
  },
};
