import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@server/repositories/settings", () => ({
  getSetting: vi.fn(),
}));

vi.mock("@server/repositories/investigatorDossierRepository", () => ({
  findById: vi.fn(),
}));

vi.mock("@server/repositories/investigatorSourceRepository", () => ({
  findByDossier: vi.fn(),
}));

vi.mock("@server/repositories/investigatorSummaryRepository", () => ({
  findLatest: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@server/repositories/investigatorTimelineRepository", () => ({
  insertEvent: vi.fn(),
}));

vi.mock("@server/services/modelSelection", () => ({
  createConfiguredLlmService: vi.fn(),
  resolveLlmModel: vi.fn(),
}));

import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import * as sourceRepo from "@server/repositories/investigatorSourceRepository";
import * as summaryRepo from "@server/repositories/investigatorSummaryRepository";
import * as timelineRepo from "@server/repositories/investigatorTimelineRepository";
import * as settingsRepo from "@server/repositories/settings";
import {
  buildSummaryPrompt,
  regenerateSummary,
} from "@server/services/investigator/summaryService";
import {
  createConfiguredLlmService,
  resolveLlmModel,
} from "@server/services/modelSelection";
import type { InvestigatorSource, InvestigatorSummary } from "@shared/types";

describe("investigator summaryService", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses configured investigator summary settings for LLM prompts", async () => {
    vi.mocked(settingsRepo.getSetting).mockImplementation(async (key) => {
      switch (key) {
        case "investigatorSummarySystemPromptTemplate":
          return "Use concise dossier analysis output.";
        case "investigatorSummarySourceLimit":
          return "2";
        case "investigatorSummaryExcerptMaxChars":
          return "120";
        default:
          return null;
      }
    });

    vi.mocked(dossierRepo.findById).mockResolvedValue({
      id: "dossier-1",
      tenantId: "tenant-1",
      companyName: "Acme",
      canonicalCompanyKey: "acme",
      companyUrl: "https://acme.example",
      normalizedDomain: "acme.example",
      status: "active",
      tags: [],
      lastResearchedAt: null,
      createdFromJobId: null,
      createdAt: "",
      updatedAt: "",
    });

    vi.mocked(sourceRepo.findByDossier).mockResolvedValue([
      {
        id: "source-1",
        tenantId: "tenant-1",
        dossierId: "dossier-1",
        runId: null,
        sourceType: "other_web_page",
        title: "Source 1",
        url: null,
        sourceHost: null,
        capturedExcerpt: "A".repeat(300),
        retrievedAt: 0,
        reviewState: "verified",
        reviewerNote: null,
        contentHash: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "source-2",
        tenantId: "tenant-1",
        dossierId: "dossier-1",
        runId: null,
        sourceType: "other_web_page",
        title: "Source 2",
        url: null,
        sourceHost: null,
        capturedExcerpt: "B".repeat(300),
        retrievedAt: 0,
        reviewState: "verified",
        reviewerNote: null,
        contentHash: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "source-3",
        tenantId: "tenant-1",
        dossierId: "dossier-1",
        runId: null,
        sourceType: "other_web_page",
        title: "Source 3",
        url: null,
        sourceHost: null,
        capturedExcerpt: "C".repeat(300),
        retrievedAt: 0,
        reviewState: "low_confidence",
        reviewerNote: null,
        contentHash: null,
        createdAt: "",
        updatedAt: "",
      },
    ] as InvestigatorSource[]);

    vi.mocked(summaryRepo.findLatest).mockResolvedValue(null);

    const createdSummary: InvestigatorSummary = {
      id: "summary-1",
      tenantId: "tenant-1",
      dossierId: "dossier-1",
      runId: null,
      summaryType: "company_brief",
      title: "Company Brief",
      bodyMarkdown: "Configured summary body",
      factsJson: [{ statement: "Fact 1", sourceIds: [] }],
      hypothesesJson: [{ statement: "Hypothesis 1", sourceIds: [] }],
      reviewState: "draft",
      version: 1,
      createdAt: "",
      updatedAt: "",
    };
    vi.mocked(summaryRepo.create).mockResolvedValue(createdSummary);
    vi.mocked(timelineRepo.insertEvent).mockResolvedValue(undefined);
    vi.mocked(resolveLlmModel).mockResolvedValue("test-model");

    const callJson = vi.fn().mockResolvedValue({
      success: true,
      data: {
        summary: "Configured summary body",
        facts: ["Fact 1"],
        hypotheses: ["Hypothesis 1"],
      },
    });
    const llmServiceMock = {
      callJson,
    } as unknown as Awaited<ReturnType<typeof createConfiguredLlmService>>;
    vi.mocked(createConfiguredLlmService).mockResolvedValue(llmServiceMock);

    await regenerateSummary("dossier-1", "company_brief");

    expect(callJson).toHaveBeenCalledTimes(1);
    const [[input]] = callJson.mock.calls as Array<
      [{ messages: Array<{ role: string; content: string }> }]
    >;
    expect(input.messages[0]?.content).toBe(
      "Use concise dossier analysis output.",
    );
    expect(input.messages[1]?.content).toContain("[2]");
    expect(input.messages[1]?.content).not.toContain("[3]");
    expect(input.messages[1]?.content).not.toContain("A".repeat(121));
    expect(vi.mocked(summaryRepo.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyMarkdown: "Configured summary body",
        title: "Company Brief",
        version: 1,
      }),
    );
  });

  it("includes driving research question section only when provided", () => {
    const sources = [
      {
        id: "source-1",
        tenantId: "tenant-1",
        dossierId: "dossier-1",
        runId: null,
        sourceType: "other_web_page",
        title: "Source 1",
        url: null,
        sourceHost: null,
        capturedExcerpt: "excerpt",
        retrievedAt: 0,
        reviewState: "verified",
        reviewerNote: null,
        contentHash: null,
        createdAt: "",
        updatedAt: "",
      },
    ] as InvestigatorSource[];

    const promptWithQuestion = buildSummaryPrompt(
      "Acme",
      null,
      sources,
      "company_brief",
      undefined,
      "What should I focus on?",
    );
    expect(promptWithQuestion).toContain("## Driving Research Question");
    expect(promptWithQuestion).toContain("What should I focus on?");

    const promptWithoutQuestion = buildSummaryPrompt(
      "Acme",
      null,
      sources,
      "company_brief",
    );
    expect(promptWithoutQuestion).not.toContain("## Driving Research Question");
  });

  it("caps prompt source and excerpt settings at required maximums", () => {
    const sources = Array.from({ length: 12 }, (_, i) => ({
      id: `source-${i + 1}`,
      tenantId: "tenant-1",
      dossierId: "dossier-1",
      runId: null,
      sourceType: "other_web_page",
      title: `Source ${i + 1}`,
      url: null,
      sourceHost: null,
      capturedExcerpt: "A".repeat(700),
      retrievedAt: 0,
      reviewState: "verified",
      reviewerNote: null,
      contentHash: null,
      createdAt: "",
      updatedAt: "",
    })) as InvestigatorSource[];

    const prompt = buildSummaryPrompt(
      "Acme",
      null,
      sources,
      "company_brief",
      {
        sourceLimit: 25,
        excerptMaxChars: 900,
      },
    );

    expect(prompt).toContain("[10]");
    expect(prompt).not.toContain("[11]");
    expect(prompt).not.toContain("A".repeat(501));
  });

  it("gracefully falls back when parsed LLM summary payload is invalid", async () => {
    vi.mocked(settingsRepo.getSetting).mockResolvedValue(null);
    vi.mocked(dossierRepo.findById).mockResolvedValue({
      id: "dossier-1",
      tenantId: "tenant-1",
      companyName: "Acme",
      canonicalCompanyKey: "acme",
      companyUrl: null,
      normalizedDomain: null,
      status: "active",
      tags: [],
      lastResearchedAt: null,
      createdFromJobId: null,
      createdAt: "",
      updatedAt: "",
    });
    vi.mocked(sourceRepo.findByDossier).mockResolvedValue([]);
    vi.mocked(summaryRepo.findLatest).mockResolvedValue(null);
    vi.mocked(summaryRepo.create).mockResolvedValue({
      id: "summary-1",
      tenantId: "tenant-1",
      dossierId: "dossier-1",
      runId: null,
      summaryType: "company_brief",
      title: "Company Brief",
      bodyMarkdown: "(Generation failed)",
      factsJson: [],
      hypothesesJson: [],
      reviewState: "draft",
      version: 1,
      createdAt: "",
      updatedAt: "",
    });
    vi.mocked(timelineRepo.insertEvent).mockResolvedValue(undefined);
    vi.mocked(resolveLlmModel).mockResolvedValue("test-model");
    vi.mocked(createConfiguredLlmService).mockResolvedValue({
      callJson: vi.fn().mockResolvedValue({
        success: true,
        data: { summary: 123, facts: "invalid", hypotheses: null },
      }),
    } as unknown as Awaited<ReturnType<typeof createConfiguredLlmService>>);

    await regenerateSummary("dossier-1", "company_brief");

    expect(summaryRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyMarkdown: "(Generation failed)",
        factsJson: [],
        hypothesesJson: [],
      }),
    );
    expect(timelineRepo.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "summary_saved",
        payload: expect.objectContaining({ generationFailed: true }),
      }),
    );
  });
});
