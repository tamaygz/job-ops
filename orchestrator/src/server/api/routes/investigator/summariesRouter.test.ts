import type { Server } from "node:http";
import type { InvestigatorSource, InvestigatorSummary } from "@shared/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startServer, stopServer } from "../test-utils";

// Mock LLM to avoid real API calls in tests.
vi.mock("@server/services/modelSelection", () => ({
  createConfiguredLlmService: vi.fn().mockResolvedValue({
    callJson: vi.fn().mockResolvedValue({
      success: true,
      data: {
        summary: "Test summary body",
        facts: ["Fact 1"],
        hypotheses: ["Hypothesis 1"],
      },
    }),
  }),
  resolveLlmModel: vi.fn().mockResolvedValue("test-model"),
}));

// Prevent run worker from auto-draining during tests.
vi.mock("@server/services/investigator/runWorker", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@server/services/investigator/runWorker")
    >();
  return { ...actual, scheduleResearchRunWorker: vi.fn() };
});

describe.sequential("Summaries API routes", () => {
  let server: Server;
  let baseUrl: string;
  let closeDb: () => void;
  let tempDir: string;

  beforeEach(async () => {
    ({ server, baseUrl, closeDb, tempDir } = await startServer());
  });

  afterEach(async () => {
    await stopServer({ server, closeDb, tempDir });
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function dossiersUrl(path = "") {
    return `${baseUrl}/api/investigator/dossiers${path}`;
  }

  async function createDossier(
    companyName = "Summary Test Co",
  ): Promise<string> {
    const res = await fetch(dossiersUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName }),
    });
    const json = (await res.json()) as { data: { id: string } };
    return json.data.id;
  }

  async function _createSource(
    dossierId: string,
    overrides: Partial<Record<string, unknown>> = {},
  ): Promise<InvestigatorSource> {
    const res = await fetch(dossiersUrl(`/${dossierId}/sources`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceType: "web_page",
        title: "Test Source",
        url: "https://example.com",
        capturedExcerpt: "A captured excerpt about the company.",
        retrievedAt: Math.floor(Date.now() / 1000),
        reviewState: "verified",
        ...overrides,
      }),
    });
    const json = (await res.json()) as { data: InvestigatorSource };
    return json.data;
  }

  async function regenerate(
    dossierId: string,
    summaryType = "company_brief",
  ): Promise<Response> {
    return fetch(dossiersUrl(`/${dossierId}/summaries/regenerate`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summaryType }),
    });
  }

  // ---------------------------------------------------------------------------
  // GET /summaries — list
  // ---------------------------------------------------------------------------

  it("returns empty array for dossier with no summaries", async () => {
    const dossierId = await createDossier("Empty Summary Co");
    const res = await fetch(dossiersUrl(`/${dossierId}/summaries`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: InvestigatorSummary[] };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(0);
  });

  it("returns 404 for unknown dossier on GET", async () => {
    const res = await fetch(dossiersUrl("/nonexistent-dossier/summaries"));
    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // POST /summaries/regenerate
  // ---------------------------------------------------------------------------

  it("regenerate returns 201 with a well-formed summary record", async () => {
    const dossierId = await createDossier("Regen Test Co");
    const res = await regenerate(dossierId);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: InvestigatorSummary };
    const s = body.data;
    expect(s.dossierId).toBe(dossierId);
    expect(s.summaryType).toBe("company_brief");
    expect(s.version).toBe(1);
    expect(s.bodyMarkdown).toBe("Test summary body");
    expect(Array.isArray(s.factsJson)).toBe(true);
    expect(s.factsJson[0]).toMatchObject({
      statement: "Fact 1",
      sourceIds: [],
    });
    expect(Array.isArray(s.hypothesesJson)).toBe(true);
    expect(s.reviewState).toBe("draft");
  });

  it("regenerate increments version on second call", async () => {
    const dossierId = await createDossier("Version Inc Co");
    const res1 = await regenerate(dossierId);
    const { data: s1 } = (await res1.json()) as { data: InvestigatorSummary };
    const res2 = await regenerate(dossierId);
    const { data: s2 } = (await res2.json()) as { data: InvestigatorSummary };
    expect(s1.version).toBe(1);
    expect(s2.version).toBe(2);
    // Both records are persisted
    const listRes = await fetch(dossiersUrl(`/${dossierId}/summaries`));
    const { data: all } = (await listRes.json()) as {
      data: InvestigatorSummary[];
    };
    expect(all).toHaveLength(2);
  });

  it("returns 400 for invalid summaryType", async () => {
    const dossierId = await createDossier("Bad Type Co");
    const res = await fetch(dossiersUrl(`/${dossierId}/summaries/regenerate`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summaryType: "not_a_real_type" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown dossier on regenerate", async () => {
    const res = await fetch(
      dossiersUrl("/nonexistent-dossier/summaries/regenerate"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summaryType: "company_brief" }),
      },
    );
    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // LLM failure path
  // ---------------------------------------------------------------------------

  it("returns graceful summary when LLM call fails", async () => {
    const { createConfiguredLlmService } = await import(
      "@server/services/modelSelection"
    );
    (
      createConfiguredLlmService as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      callJson: vi
        .fn()
        .mockResolvedValue({ success: false, error: "LLM unavailable" }),
    });

    const dossierId = await createDossier("LLM Fail Co");
    const res = await regenerate(dossierId, "people_brief");
    expect(res.status).toBe(201);
    const { data: s } = (await res.json()) as { data: InvestigatorSummary };
    expect(s.bodyMarkdown).toBe("(Generation failed)");
    expect(s.factsJson).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Prompt construction — source count / excerpt truncation
  // ---------------------------------------------------------------------------

  it("only includes up to 10 verified/low_confidence sources in prompt", async () => {
    const { buildSummaryPrompt } = await import(
      "@server/services/investigator/summaryService"
    );
    // 12 sources
    const sources = Array.from({ length: 12 }, (_, i) => ({
      id: `s${i}`,
      capturedExcerpt: "A".repeat(600),
      title: `Source ${i}`,
      reviewState: "verified",
      tenantId: "t1",
      dossierId: "d1",
      runId: null,
      sourceType: "other_web_page",
      url: null,
      sourceHost: null,
      retrievedAt: 0,
      reviewerNote: null,
      contentHash: null,
      createdAt: "",
      updatedAt: "",
    })) as unknown as InvestigatorSource[];

    const prompt = buildSummaryPrompt("Acme", null, sources, "company_brief");
    // Should contain exactly 10 source markers [1] through [10], not [11] or [12]
    expect(prompt).toContain("[10]");
    expect(prompt).not.toContain("[11]");
    // Excerpts should be truncated to 500 chars
    expect(prompt).not.toContain("A".repeat(501));
  });

  // ---------------------------------------------------------------------------
  // GET ?latest=true
  // ---------------------------------------------------------------------------

  it("returns only latest version per type with ?latest=true", async () => {
    const dossierId = await createDossier("Latest Only Co");
    // Two regenerates → version 1 and version 2 for company_brief
    await regenerate(dossierId);
    await regenerate(dossierId);
    // One people_brief
    await regenerate(dossierId, "people_brief");

    const res = await fetch(dossiersUrl(`/${dossierId}/summaries?latest=true`));
    const { data: summaries } = (await res.json()) as {
      data: InvestigatorSummary[];
    };
    // Should have exactly 2: latest company_brief (v2) + people_brief (v1)
    expect(summaries).toHaveLength(2);
    const companyBrief = summaries.find(
      (s) => s.summaryType === "company_brief",
    );
    expect(companyBrief?.version).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // PATCH /:summaryId — user edit
  // ---------------------------------------------------------------------------

  it("PATCH updates bodyMarkdown and increments version", async () => {
    const dossierId = await createDossier("Edit Summary Co");
    const createRes = await regenerate(dossierId);
    const { data: created } = (await createRes.json()) as {
      data: InvestigatorSummary;
    };

    const patchRes = await fetch(
      dossiersUrl(`/${dossierId}/summaries/${created.id}`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyMarkdown: "User-edited content" }),
      },
    );
    expect(patchRes.status).toBe(200);
    const { data: updated } = (await patchRes.json()) as {
      data: InvestigatorSummary;
    };
    expect(updated.bodyMarkdown).toBe("User-edited content");
    expect(updated.version).toBe(created.version + 1);
  });

  it("PATCH returns 404 for unknown summaryId", async () => {
    const dossierId = await createDossier("Edit 404 Co");
    const res = await fetch(
      dossiersUrl(`/${dossierId}/summaries/nonexistent-id`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyMarkdown: "Updated" }),
      },
    );
    expect(res.status).toBe(404);
  });
});
