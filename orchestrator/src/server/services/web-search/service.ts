import { logger } from "@infra/logger";
import { sanitizeError } from "@infra/sanitize";
import { webSearchProvidersById } from "./providers";
import { loadWebSearchSettings } from "./settings";
import type {
  WebSearchProviderId,
  WebSearchResult,
  WebSearchSettings,
} from "./types";

const log = logger.child({ service: "webSearch" });

export type WebSearchRunResult = {
  results: WebSearchResult[];
  failures: string[];
  skipped: string[];
  providersAttempted: number;
};

function normalizeQuery(value: string): string {
  return value.trim();
}

function dedupeKey(result: WebSearchResult): string {
  return (result.url || result.title).trim().toLowerCase();
}

function uniqueProviders(input: WebSearchProviderId[]): WebSearchProviderId[] {
  const seen = new Set<WebSearchProviderId>();
  const out: WebSearchProviderId[] = [];
  for (const provider of input) {
    if (seen.has(provider)) continue;
    seen.add(provider);
    out.push(provider);
  }
  return out;
}

export async function runWebSearch(
  query: string,
  options: { settings?: WebSearchSettings } = {},
): Promise<WebSearchRunResult> {
  const trimmedQuery = normalizeQuery(query);
  if (!trimmedQuery) {
    return {
      results: [],
      failures: [],
      skipped: ["Empty search query"],
      providersAttempted: 0,
    };
  }

  const settings = options.settings ?? (await loadWebSearchSettings());
  const providerIds = uniqueProviders(settings.providers);
  const failures: string[] = [];
  const skipped: string[] = [];
  const results: WebSearchResult[] = [];
  const seen = new Set<string>();

  if (providerIds.length === 0) {
    return {
      results,
      failures,
      skipped: ["No web search providers configured"],
      providersAttempted: 0,
    };
  }

  let providersAttempted = 0;

  for (const providerId of providerIds) {
    const provider = webSearchProvidersById[providerId];
    if (!provider) {
      failures.push(`Unknown web search provider: ${providerId}`);
      continue;
    }

    providersAttempted += 1;

    try {
      const outcome = await provider.search(trimmedQuery, settings);
      if (outcome.status === "failed") {
        failures.push(outcome.message || provider.displayName);
        continue;
      }
      if (outcome.status === "skipped") {
        skipped.push(outcome.message || provider.displayName);
        continue;
      }

      for (const result of outcome.results ?? []) {
        const key = dedupeKey(result);
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(result);
      }
    } catch (error) {
      failures.push(provider.displayName);
      log.warn("Web search provider failed", {
        provider: provider.id,
        error: sanitizeError(
          error instanceof Error ? error : new Error(String(error)),
        ),
      });
    }
  }

  return {
    results,
    failures,
    skipped,
    providersAttempted,
  };
}
