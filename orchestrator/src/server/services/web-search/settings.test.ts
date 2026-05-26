import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSetting: vi.fn(),
  getOriginalEnvValue: vi.fn(),
}));

vi.mock("@server/repositories/settings", () => ({
  getSetting: mocks.getSetting,
}));

vi.mock("@server/services/envSettings", () => ({
  getOriginalEnvValue: mocks.getOriginalEnvValue,
}));

import { loadWebSearchSettings } from "./settings";

describe("web-search/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSetting.mockResolvedValue(null);
    mocks.getOriginalEnvValue.mockReturnValue(null);
  });

  it("loads modern web-search settings from the repository", async () => {
    mocks.getSetting.mockImplementation(async (key: string) => {
      const values: Record<string, unknown> = {
        webSearchProviders: JSON.stringify(["brave", "bing"]),
        webSearchResultLimit: "12",
        webSearchMarket: "en-GB",
        webSearchBingEndpoint: "https://bing.example.test/search",
        webSearchSearxngBaseUrl: " https://search.example.test ",
        webSearchBingApiKey: " bing-key ",
        webSearchSearxngApiKey: " searxng-key ",
        webSearchBraveApiKey: " brave-key ",
      };
      return values[key] ?? null;
    });

    const settings = await loadWebSearchSettings();

    expect(settings).toEqual({
      providers: ["brave", "bing"],
      resultLimit: 12,
      market: "en-GB",
      bingApiKey: "bing-key",
      bingEndpoint: "https://bing.example.test/search",
      searxngBaseUrl: "https://search.example.test",
      searxngApiKey: "searxng-key",
      braveApiKey: "brave-key",
    });
  });

  it("falls back to legacy investigator settings when modern values are absent", async () => {
    mocks.getSetting.mockImplementation(async (key: string) => {
      const values: Record<string, unknown> = {
        investigatorBingSearchApiKey: " legacy-bing-key ",
        investigatorBingSearchEndpoint: "https://legacy.example.test/search",
        investigatorBingSearchMarket: "en-AU",
        investigatorBingSearchResultLimit: "9",
      };
      return values[key] ?? null;
    });

    const settings = await loadWebSearchSettings();

    expect(settings.providers).toEqual(["bing"]);
    expect(settings.resultLimit).toBe(9);
    expect(settings.market).toBe("en-AU");
    expect(settings.bingEndpoint).toBe("https://legacy.example.test/search");
    expect(settings.bingApiKey).toBe("legacy-bing-key");
  });

  it("falls back to environment secrets when repository secrets are not set", async () => {
    mocks.getOriginalEnvValue.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        BRAVE_SEARCH_API_KEY: "env-brave-key",
        SEARXNG_API_KEY: "env-searxng-key",
        WEB_SEARCH_BING_API_KEY: "env-bing-key",
      };
      return values[key] ?? null;
    });

    const settings = await loadWebSearchSettings();

    expect(settings.bingApiKey).toBe("env-bing-key");
    expect(settings.braveApiKey).toBe("env-brave-key");
    expect(settings.searxngApiKey).toBe("env-searxng-key");
  });
});
