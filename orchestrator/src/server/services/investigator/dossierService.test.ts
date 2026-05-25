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

vi.mock("@server/repositories/investigatorTimelineRepository", () => ({
  insert: vi.fn(),
}));

vi.mock("@server/repositories/jobs", () => ({
  getJobById: vi.fn(),
}));

import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import * as timelineRepo from "@server/repositories/investigatorTimelineRepository";
import { normalizeCanonicalKey, updateDossier } from "./dossierService";

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
    expect(timelineRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        dossierId: "dossier-1",
        eventType: "status_changed",
        payload: { from: "active", to: "archived" },
        occurredAt: expect.any(Number),
      }),
    );
  });
});
