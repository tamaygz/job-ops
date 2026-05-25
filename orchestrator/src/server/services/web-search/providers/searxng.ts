import type { WebSearchProvider, WebSearchResult } from "../types";

type SearxngResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
};

type SearxngResponse = {
  results?: SearxngResult[];
};

function resolveLanguage(market: string): string {
  const trimmed = market.trim();
  if (!trimmed) return "en";
  const [language] = trimmed.split(/[-_]/);
  return language || "en";
}

function buildSearchUrl(baseUrl: string): URL {
  const base = new URL(baseUrl);
  if (base.pathname.endsWith("/search")) return base;
  return new URL("search", base);
}

function normalizeResult(
  result: SearxngResult,
  index: number,
): WebSearchResult | null {
  const title = result.title?.trim();
  if (!title) return null;

  return {
    providerId: "searxng",
    title,
    url: result.url?.trim() || null,
    snippet: result.content?.trim() || null,
    rank: index + 1,
  };
}

export const searxngProvider: WebSearchProvider = {
  id: "searxng",
  displayName: "SearXNG",
  async search(query, settings) {
    if (!settings.searxngBaseUrl) {
      return { status: "skipped", message: "Missing SearXNG base URL" };
    }

    const url = buildSearchUrl(settings.searxngBaseUrl);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("language", resolveLanguage(settings.market));

    const headers: Record<string, string> = {};
    if (settings.searxngApiKey) {
      headers["X-API-Key"] = settings.searxngApiKey;
    }

    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      return {
        status: "failed",
        message: `SearXNG search failed (${response.status})`,
      };
    }

    const payload = (await response.json()) as SearxngResponse;
    const results = (payload.results ?? [])
      .slice(0, Math.max(1, settings.resultLimit))
      .map(normalizeResult)
      .filter((item): item is WebSearchResult => Boolean(item));

    return {
      status: "success",
      results,
      message: results.length ? undefined : "No results",
    };
  },
};
