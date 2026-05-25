import type { WebSearchProvider, WebSearchResult } from "../types";

type BingResult = {
  name?: string;
  url?: string;
  snippet?: string;
};

type BingResponse = {
  webPages?: { value?: BingResult[] };
};

function normalizeResult(
  result: BingResult,
  index: number,
): WebSearchResult | null {
  const title = result.name?.trim();
  if (!title) return null;

  return {
    providerId: "bing",
    title,
    url: result.url?.trim() || null,
    snippet: result.snippet?.trim() || null,
    rank: index + 1,
  };
}

export const bingProvider: WebSearchProvider = {
  id: "bing",
  displayName: "Bing Search",
  async search(query, settings) {
    if (!settings.bingApiKey) {
      return { status: "skipped", message: "Missing Bing API key" };
    }

    const count = Math.min(50, Math.max(1, settings.resultLimit));
    const url = new URL(settings.bingEndpoint);
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(count));
    if (settings.market) {
      url.searchParams.set("mkt", settings.market);
    }

    const response = await fetch(url.toString(), {
      headers: {
        "Ocp-Apim-Subscription-Key": settings.bingApiKey,
      },
    });

    if (!response.ok) {
      return {
        status: "failed",
        message: `Bing search failed (${response.status})`,
      };
    }

    const payload = (await response.json()) as BingResponse;
    const results = (payload.webPages?.value ?? [])
      .map(normalizeResult)
      .filter((item): item is WebSearchResult => Boolean(item));

    return {
      status: "success",
      results,
      message: results.length ? undefined : "No results",
    };
  },
};
