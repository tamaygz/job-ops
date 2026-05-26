import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadWebSearchSettings: vi.fn(),
  providersById: {
    bing: {
      id: "bing",
      displayName: "Bing Search",
      search: vi.fn(),
    },
    brave: {
      id: "brave",
      displayName: "Brave Search",
      search: vi.fn(),
    },
    searxng: {
      id: "searxng",
      displayName: "SearXNG",
      search: vi.fn(),
    },
  },
  logWarn: vi.fn(),
}));

vi.mock("./settings", () => ({
  loadWebSearchSettings: mocks.loadWebSearchSettings,
}));

vi.mock("./providers", () => ({
  webSearchProvidersById: mocks.providersById,
}));

vi.mock("@infra/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      warn: mocks.logWarn,
    })),
  },
}));

vi.mock("@infra/sanitize", () => ({
  sanitizeError: vi.fn((error: Error) => ({ message: error.message })),
}));

import { runWebSearch } from "./service";

const defaultSettings = {
  providers: ["bing", "brave", "searxng"] as const,
  resultLimit: 5,
  market: "en-US",
  bingApiKey: "bing-key",
  bingEndpoint: "https://api.bing.microsoft.com/v7.0/search",
  searxngBaseUrl: "https://search.example.com",
  searxngApiKey: "searxng-key",
  braveApiKey: "brave-key",
};

describe("web-search/service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadWebSearchSettings.mockResolvedValue(defaultSettings);
  });

  it("returns early for an empty query", async () => {
    const result = await runWebSearch("   ");

    expect(result).toEqual({
      results: [],
      failures: [],
      skipped: ["Empty search query"],
      providersAttempted: 0,
      providerOutcomes: [],
    });
    expect(mocks.loadWebSearchSettings).not.toHaveBeenCalled();
  });

  it("returns a skipped result when no providers are configured", async () => {
    const result = await runWebSearch("job ops", {
      settings: {
        ...defaultSettings,
        providers: [],
      },
    });

    expect(result).toEqual({
      results: [],
      failures: [],
      skipped: ["No web search providers configured"],
      providersAttempted: 0,
      providerOutcomes: [],
    });
  });

  it("deduplicates providers and result URLs while preserving failures and skips", async () => {
    mocks.providersById.bing.search.mockResolvedValue({
      status: "success",
      results: [
        {
          providerId: "bing",
          title: "JobOps",
          url: "https://example.com/a",
          snippet: "A",
          rank: 1,
        },
        {
          providerId: "bing",
          title: "JobOps Duplicate",
          url: "https://example.com/a",
          snippet: "A2",
          rank: 2,
        },
      ],
    });
    mocks.providersById.brave.search.mockResolvedValue({
      status: "skipped",
      message: "Brave API key missing",
    });
    mocks.providersById.searxng.search.mockResolvedValue({
      status: "failed",
      message: "Upstream returned 500",
    });

    const result = await runWebSearch("  job ops  ", {
      settings: {
        ...defaultSettings,
        providers: ["bing", "bing", "brave", "searxng"],
      },
    });

    expect(mocks.providersById.bing.search).toHaveBeenCalledWith(
      "job ops",
      expect.objectContaining({
        providers: ["bing", "bing", "brave", "searxng"],
      }),
    );
    expect(result).toEqual({
      results: [
        {
          providerId: "bing",
          title: "JobOps",
          url: "https://example.com/a",
          snippet: "A",
          rank: 1,
        },
      ],
      failures: ["Upstream returned 500"],
      skipped: ["Brave API key missing"],
      providersAttempted: 3,
      providerOutcomes: [
        {
          providerId: "bing",
          displayName: "Bing Search",
          status: "success",
          resultCount: 1,
        },
        {
          providerId: "brave",
          displayName: "Brave Search",
          status: "skipped",
          resultCount: 0,
          message: "Brave API key missing",
        },
        {
          providerId: "searxng",
          displayName: "SearXNG",
          status: "failed",
          resultCount: 0,
          message: "Upstream returned 500",
        },
      ],
    });
  });

  it("records thrown provider errors without failing the whole search", async () => {
    mocks.providersById.bing.search.mockRejectedValue(new Error("boom"));

    const result = await runWebSearch("job ops", {
      settings: {
        ...defaultSettings,
        providers: ["bing"],
      },
    });

    expect(result).toEqual({
      results: [],
      failures: ["Bing Search"],
      skipped: [],
      providersAttempted: 1,
      providerOutcomes: [
        {
          providerId: "bing",
          displayName: "Bing Search",
          status: "failed",
          resultCount: 0,
          message: "Unexpected error",
        },
      ],
    });
    expect(mocks.logWarn).toHaveBeenCalledWith(
      "Web search provider failed",
      expect.objectContaining({
        provider: "bing",
        error: { message: "boom" },
      }),
    );
  });

  it("records an outcome when a configured provider id is unknown", async () => {
    const result = await runWebSearch("job ops", {
      settings: {
        ...defaultSettings,
        providers: ["bing", "unknown-provider" as "bing"],
      },
    });

    expect(result.failures).toContain(
      "Unknown web search provider: unknown-provider",
    );
    expect(result.providerOutcomes).toContainEqual({
      providerId: "unknown-provider",
      displayName: "unknown-provider",
      status: "failed",
      resultCount: 0,
      message: "Unknown web search provider: unknown-provider",
    });
  });
});
