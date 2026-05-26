import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@server/repositories/investigatorDossierRepository", () => ({
  create: vi.fn(),
  findAll: vi.fn(),
  findByCanonicalKey: vi.fn(),
  findById: vi.fn(),
  linkJob: vi.fn(),
  listLinkedJobsWithDetails: vi.fn(),
  unlinkJob: vi.fn(),
  update: vi.fn(),
}));

vi.mock("./timelineService", () => ({
  writeEvent: vi.fn(),
}));

vi.mock("@server/repositories/jobs", () => ({
  getJobById: vi.fn(),
}));

import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import {
  ensureDossiersForCompanies,
  normalizeCanonicalKey,
  updateDossier,
} from "./dossierService";
import * as timelineService from "./timelineService";

describe("normalizeCanonicalKey", () => {
  it("strips punctuation and lowercases", () => {
    expect(normalizeCanonicalKey("Acme, Inc.")).toBe("acme inc");
  });

  it("trims leading and trailing whitespace and uppercases", () => {
    expect(normalizeCanonicalKey("  GOOGLE LLC  ")).toBe("google llc");
  });

  it("handles multi-word names with comma and period", () => {
    expect(normalizeCanonicalKey("Meta Platforms, Inc.")).toBe(
      "meta platforms inc",
    );
  });

  it("passes through a plain single word", () => {
    expect(normalizeCanonicalKey("DeepMind")).toBe("deepmind");
  });

  it("strips non-word characters like +", () => {
    expect(normalizeCanonicalKey("C++ Corp")).toBe("c corp");
  });

  it("returns empty string for blank input", () => {
    expect(normalizeCanonicalKey("")).toBe("");
    expect(normalizeCanonicalKey("   ")).toBe("");
  });

  it("collapses multiple internal spaces", () => {
    expect(normalizeCanonicalKey("Foo   Bar")).toBe("foo bar");
  });

  it("strips apostrophes and quotes", () => {
    expect(normalizeCanonicalKey("O'Reilly Media")).toBe("oreilly media");
  });
});

describe("updateDossier", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("recomputes canonical key when company name changes", async () => {
    vi.mocked(dossierRepo.findById).mockResolvedValue({
      id: "dossier-1",
      tenantId: "tenant-1",
      companyName: "Acme, Inc.",
      canonicalCompanyKey: "acme inc",
      companyUrl: null,
      normalizedDomain: null,
      status: "active",
      tags: [],
      lastResearchedAt: null,
      createdFromJobId: null,
      createdAt: "",
      updatedAt: "",
    });
    vi.mocked(dossierRepo.findByCanonicalKey).mockResolvedValue(null);
    vi.mocked(dossierRepo.update).mockResolvedValue({
      id: "dossier-1",
      tenantId: "tenant-1",
      companyName: "Beta, LLC",
      canonicalCompanyKey: "beta llc",
      companyUrl: null,
      normalizedDomain: null,
      status: "active",
      tags: [],
      lastResearchedAt: null,
      createdFromJobId: null,
      createdAt: "",
      updatedAt: "",
    });

    const updated = await updateDossier("dossier-1", {
      companyName: "Beta, LLC",
    });

    expect(dossierRepo.findById).toHaveBeenCalledWith("dossier-1");
    expect(dossierRepo.findByCanonicalKey).toHaveBeenCalledWith("beta llc");
    expect(dossierRepo.update).toHaveBeenCalledWith("dossier-1", {
      companyName: "Beta, LLC",
      canonicalCompanyKey: "beta llc",
    });
    expect(updated.canonicalCompanyKey).toBe("beta llc");
  });

  it("rejects a company rename that would duplicate another dossier canonical key", async () => {
    vi.mocked(dossierRepo.findById).mockResolvedValue({
      id: "dossier-1",
      tenantId: "tenant-1",
      companyName: "Acme, Inc.",
      canonicalCompanyKey: "acme inc",
      companyUrl: null,
      normalizedDomain: null,
      status: "active",
      tags: [],
      lastResearchedAt: null,
      createdFromJobId: null,
      createdAt: "",
      updatedAt: "",
    });
    vi.mocked(dossierRepo.findByCanonicalKey).mockResolvedValue({
      id: "dossier-2",
      tenantId: "tenant-1",
      companyName: "Beta LLC",
      canonicalCompanyKey: "beta llc",
      companyUrl: null,
      normalizedDomain: null,
      status: "active",
      tags: [],
      lastResearchedAt: null,
      createdFromJobId: null,
      createdAt: "",
      updatedAt: "",
    });

    await expect(
      updateDossier("dossier-1", { companyName: "Beta, LLC" }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(dossierRepo.findById).toHaveBeenCalledWith("dossier-1");
    expect(dossierRepo.update).not.toHaveBeenCalled();
  });

  it("writes a status_changed timeline event when status changes", async () => {
    vi.mocked(dossierRepo.findById).mockResolvedValue({
      id: "dossier-1",
      tenantId: "tenant-1",
      companyName: "Acme, Inc.",
      canonicalCompanyKey: "acme inc",
      companyUrl: null,
      normalizedDomain: null,
      status: "active",
      tags: [],
      lastResearchedAt: null,
      createdFromJobId: null,
      createdAt: "",
      updatedAt: "",
    });
    vi.mocked(dossierRepo.update).mockResolvedValue({
      id: "dossier-1",
      tenantId: "tenant-1",
      companyName: "Acme, Inc.",
      canonicalCompanyKey: "acme inc",
      companyUrl: null,
      normalizedDomain: null,
      status: "archived",
      tags: [],
      lastResearchedAt: null,
      createdFromJobId: null,
      createdAt: "",
      updatedAt: "",
    });

    await updateDossier("dossier-1", { status: "archived" });

    expect(dossierRepo.findById).toHaveBeenCalledWith("dossier-1");
    expect(timelineService.writeEvent).toHaveBeenCalledWith(
      "dossier-1",
      "status_changed",
      { from: "active", to: "archived" },
      expect.objectContaining({
        occurredAt: expect.any(Number),
      }),
    );
  });
});

const STUB_DOSSIER = {
  id: "dossier-1",
  tenantId: "tenant-1",
  companyName: "Acme, Inc.",
  canonicalCompanyKey: "acme inc",
  companyUrl: null,
  normalizedDomain: null,
  status: "watchlist" as const,
  tags: [],
  lastResearchedAt: null,
  createdFromJobId: null,
  createdAt: "",
  updatedAt: "",
};

describe("ensureDossiersForCompanies", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("skips companies whose dossier already exists", async () => {
    vi.mocked(dossierRepo.findByCanonicalKey).mockResolvedValue(STUB_DOSSIER);

    const result = await ensureDossiersForCompanies([
      { companyName: "Acme, Inc.", companyUrl: null },
    ]);

    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(dossierRepo.create).not.toHaveBeenCalled();
    expect(timelineService.writeEvent).not.toHaveBeenCalled();
  });

  it("creates a new dossier and writes a timeline event for an unknown company", async () => {
    vi.mocked(dossierRepo.findByCanonicalKey).mockResolvedValue(null);
    vi.mocked(dossierRepo.create).mockResolvedValue({
      ...STUB_DOSSIER,
      id: "new-dossier",
      companyName: "Beta Corp",
      canonicalCompanyKey: "beta corp",
    });

    const result = await ensureDossiersForCompanies([
      { companyName: "Beta Corp", companyUrl: "https://beta.example.com" },
    ]);

    expect(result).toEqual({ created: 1, skipped: 0 });
    expect(dossierRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: "Beta Corp",
        canonicalCompanyKey: "beta corp",
        status: "watchlist",
      }),
    );
    expect(timelineService.writeEvent).toHaveBeenCalledWith(
      "new-dossier",
      "dossier_created",
      expect.objectContaining({
        companyName: "Beta Corp",
        canonicalKey: "beta corp",
        source: "watchlist",
      }),
      expect.objectContaining({
        occurredAt: expect.any(Number),
      }),
    );
  });

  it("deduplicates companies with the same canonical key within the input", async () => {
    vi.mocked(dossierRepo.findByCanonicalKey).mockResolvedValue(null);
    vi.mocked(dossierRepo.create).mockResolvedValue({
      ...STUB_DOSSIER,
      id: "new-dossier",
      companyName: "Acme Inc",
      canonicalCompanyKey: "acme inc",
    });

    const result = await ensureDossiersForCompanies([
      { companyName: "Acme Inc", companyUrl: null },
      { companyName: "Acme, Inc.", companyUrl: null },
    ]);

    // Both entries share the same canonical key — only one dossier should be created.
    expect(result).toEqual({ created: 1, skipped: 0 });
    expect(dossierRepo.create).toHaveBeenCalledTimes(1);
  });

  it("treats a UNIQUE constraint error from a concurrent create as a skip", async () => {
    vi.mocked(dossierRepo.findByCanonicalKey).mockResolvedValue(null);
    vi.mocked(dossierRepo.create).mockRejectedValue(
      new Error(
        "UNIQUE constraint failed: investigator_dossiers.canonical_company_key",
      ),
    );

    const result = await ensureDossiersForCompanies([
      { companyName: "Race Corp", companyUrl: null },
    ]);

    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(timelineService.writeEvent).not.toHaveBeenCalled();
  });

  it("re-throws non-UNIQUE errors", async () => {
    vi.mocked(dossierRepo.findByCanonicalKey).mockResolvedValue(null);
    vi.mocked(dossierRepo.create).mockRejectedValue(
      new Error("disk I/O error"),
    );

    await expect(
      ensureDossiersForCompanies([
        { companyName: "Broken Corp", companyUrl: null },
      ]),
    ).rejects.toThrow("disk I/O error");
  });
});
