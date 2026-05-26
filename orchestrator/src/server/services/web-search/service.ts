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

export type WebSearchProviderOutcome = {
  providerId: WebSearchProviderId;
  displayName: string;
  status: "success" | "skipped" | "failed";
  resultCount: number;
  message?: string;
};

export type WebSearchRunResult = {
  results: WebSearchResult[];
  failures: string[];
  skipped: string[];
  providersAttempted: number;
  providerOutcomes: WebSearchProviderOutcome[];
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
      providerOutcomes: [],
    };
  }

  const settings = options.settings ?? (await loadWebSearchSettings());
  const providerIds = uniqueProviders(settings.providers);
  const failures: string[] = [];
  const skipped: string[] = [];
  const results: WebSearchResult[] = [];
  const providerOutcomes: WebSearchProviderOutcome[] = [];
  const seen = new Set<string>();

  if (providerIds.length === 0) {
    return {
      results,
      failures,
      skipped: ["No web search providers configured"],
      providersAttempted: 0,
      providerOutcomes,
    };
  }

  let providersAttempted = 0;

  for (const providerId of providerIds) {
    const provider = webSearchProvidersById[providerId];
    if (!provider) {
      const message = `Unknown web search provider: ${providerId}`;
      failures.push(message);
      providerOutcomes.push({
        providerId,
        displayName: String(providerId),
        status: "failed",
        resultCount: 0,
        message,
      });
      continue;
    }

    providersAttempted += 1;

    try {
      const outcome = await provider.search(trimmedQuery, settings);
      if (outcome.status === "failed") {
        failures.push(outcome.message || provider.displayName);
        providerOutcomes.push({
          providerId,
          displayName: provider.displayName,
          status: "failed",
          resultCount: 0,
          message: outcome.message,
        });
        continue;
      }
      if (outcome.status === "skipped") {
        skipped.push(outcome.message || provider.displayName);
        providerOutcomes.push({
          providerId,
          displayName: provider.displayName,
          status: "skipped",
          resultCount: 0,
          message: outcome.message,
        });
        continue;
      }

      let providerResultCount = 0;
      for (const result of outcome.results ?? []) {
        const key = dedupeKey(result);
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(result);
        providerResultCount += 1;
      }

      providerOutcomes.push({
        providerId,
        displayName: provider.displayName,
        status: "success",
        resultCount: providerResultCount,
      });
    } catch (error) {
      failures.push(provider.displayName);
      providerOutcomes.push({
        providerId,
        displayName: provider.displayName,
        status: "failed",
        resultCount: 0,
        message: "Unexpected error",
      });
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
    providerOutcomes,
  };
}
