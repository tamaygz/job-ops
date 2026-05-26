import * as settingsRepo from "@server/repositories/settings";
import { getOriginalEnvValue } from "@server/services/envSettings";
import { settingsRegistry } from "@shared/settings-registry";
import type { WebSearchSettings } from "./types";

function normalizeSecret(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function resolveEnvValue(keys: string[]): string | null {
  for (const key of keys) {
    const value = normalizeSecret(getOriginalEnvValue(key));
    if (value) return value;
  }
  return null;
}

export async function loadWebSearchSettings(): Promise<WebSearchSettings> {
  const [
    rawProviders,
    rawLimit,
    rawMarket,
    rawBingEndpoint,
    rawSearxngBaseUrl,
    rawBingApiKey,
    rawSearxngApiKey,
    rawBraveApiKey,
    rawLegacyBingApiKey,
    rawLegacyBingEndpoint,
    rawLegacyBingMarket,
    rawLegacyBingLimit,
  ] = await Promise.all([
    settingsRepo.getSetting("webSearchProviders"),
    settingsRepo.getSetting("webSearchResultLimit"),
    settingsRepo.getSetting("webSearchMarket"),
    settingsRepo.getSetting("webSearchBingEndpoint"),
    settingsRepo.getSetting("webSearchSearxngBaseUrl"),
    settingsRepo.getSetting("webSearchBingApiKey"),
    settingsRepo.getSetting("webSearchSearxngApiKey"),
    settingsRepo.getSetting("webSearchBraveApiKey"),
    settingsRepo.getSetting("investigatorBingSearchApiKey"),
    settingsRepo.getSetting("investigatorBingSearchEndpoint"),
    settingsRepo.getSetting("investigatorBingSearchMarket"),
    settingsRepo.getSetting("investigatorBingSearchResultLimit"),
  ]);

  const providers =
    settingsRegistry.webSearchProviders.parse(rawProviders ?? undefined) ??
    settingsRegistry.webSearchProviders.default();

  const resultLimit =
    settingsRegistry.webSearchResultLimit.parse(rawLimit ?? undefined) ??
    settingsRegistry.investigatorBingSearchResultLimit.parse(
      rawLegacyBingLimit ?? undefined,
    ) ??
    settingsRegistry.webSearchResultLimit.default();

  const market =
    settingsRegistry.webSearchMarket.parse(rawMarket ?? undefined) ??
    settingsRegistry.investigatorBingSearchMarket.parse(
      rawLegacyBingMarket ?? undefined,
    ) ??
    settingsRegistry.webSearchMarket.default();

  const bingEndpoint =
    settingsRegistry.webSearchBingEndpoint.parse(
      rawBingEndpoint ?? undefined,
    ) ??
    settingsRegistry.investigatorBingSearchEndpoint.parse(
      rawLegacyBingEndpoint ?? undefined,
    ) ??
    settingsRegistry.webSearchBingEndpoint.default();

  const searxngBaseUrl = normalizeOptionalString(
    settingsRegistry.webSearchSearxngBaseUrl.parse(
      rawSearxngBaseUrl ?? undefined,
    ) ?? settingsRegistry.webSearchSearxngBaseUrl.default(),
  );

  const bingApiKey =
    normalizeSecret(rawBingApiKey) ??
    normalizeSecret(rawLegacyBingApiKey) ??
    resolveEnvValue([
      "WEB_SEARCH_BING_API_KEY",
      "INVESTIGATOR_BING_SEARCH_API_KEY",
      "BING_SEARCH_API_KEY",
    ]);

  const searxngApiKey =
    normalizeSecret(rawSearxngApiKey) ?? resolveEnvValue(["SEARXNG_API_KEY"]);

  const braveApiKey =
    normalizeSecret(rawBraveApiKey) ??
    resolveEnvValue(["BRAVE_SEARCH_API_KEY"]);

  return {
    providers,
    resultLimit,
    market,
    bingApiKey,
    bingEndpoint,
    searxngBaseUrl,
    searxngApiKey,
    braveApiKey,
  };
}
