import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSetting: vi.fn(),
}));

vi.mock("@server/repositories/settings", () => ({
  getSetting: mocks.getSetting,
}));

import { loadInvestigatorGatherSettings } from "./settings";

describe("investigator/gather/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSetting.mockResolvedValue(null);
  });

  it("keeps configured source providers when web_search is already enabled", async () => {
    mocks.getSetting.mockImplementation(async (key: string) => {
      if (key === "investigatorSourceProviders") {
        return JSON.stringify(["linked_jobs", "company_site", "web_search"]);
      }
      return null;
    });

    const settings = await loadInvestigatorGatherSettings();

    expect(settings.sourceProviders).toEqual([
      "linked_jobs",
      "company_site",
      "web_search",
    ]);
  });

  it("restores web_search for legacy source provider list when web search providers are configured", async () => {
    mocks.getSetting.mockImplementation(async (key: string) => {
      if (key === "investigatorSourceProviders") {
        return JSON.stringify(["linked_jobs", "company_site"]);
      }
      if (key === "webSearchProviders") {
        return JSON.stringify(["searxng", "brave"]);
      }
      return null;
    });

    const settings = await loadInvestigatorGatherSettings();

    expect(settings.sourceProviders).toEqual([
      "linked_jobs",
      "company_site",
      "web_search",
    ]);
  });

  it("does not restore web_search when source providers are intentionally customized", async () => {
    mocks.getSetting.mockImplementation(async (key: string) => {
      if (key === "investigatorSourceProviders") {
        return JSON.stringify(["company_site"]);
      }
      if (key === "webSearchProviders") {
        return JSON.stringify(["searxng", "brave"]);
      }
      return null;
    });

    const settings = await loadInvestigatorGatherSettings();

    expect(settings.sourceProviders).toEqual(["company_site"]);
  });
});
