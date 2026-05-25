import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logInfo: vi.fn(),
}));

vi.mock("@infra/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      info: mocks.logInfo,
    })),
  },
}));

vi.mock("@server/repositories/investigatorDossierRepository", () => ({
  findById: vi.fn(),
}));

vi.mock("@server/repositories/investigatorSourceRepository", () => ({
  findByContentHash: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
  findByDossier: vi.fn(),
}));

vi.mock("@server/repositories/investigatorTimelineRepository", () => ({
  insertEvent: vi.fn(),
}));

import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import * as sourceRepo from "@server/repositories/investigatorSourceRepository";
import * as timelineRepo from "@server/repositories/investigatorTimelineRepository";
import { saveSource, updateSource } from "./sourceService";

function makeDossier() {
  return {
    id: "dossier-1",
    tenantId: "tenant-1",
    companyName: "Acme Corp",
    canonicalCompanyKey: "acme corp",
    companyUrl: "https://acme.test",
    normalizedDomain: "acme.test",
    status: "active",
    tags: [],
    lastResearchedAt: null,
    createdFromJobId: null,
    createdAt: "",
    updatedAt: "",
  };
}

describe("sourceService", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("deduplicates an existing source without writing a new timeline event", async () => {
    vi.mocked(dossierRepo.findById).mockResolvedValue(makeDossier());
    vi.mocked(sourceRepo.findByContentHash).mockResolvedValue({
      id: "source-1",
      tenantId: "tenant-1",
      dossierId: "dossier-1",
      runId: null,
      sourceType: "news_article",
      title: "Existing source",
      url: "https://news.example/story",
      sourceHost: "news.example",
      capturedExcerpt: "Acme raised funding.",
      retrievedAt: 123,
      reviewState: "verified",
      reviewerNote: null,
      contentHash: "hash-1",
      createdAt: "",
      updatedAt: "",
    });

    const result = await saveSource("dossier-1", {
      sourceType: "news_article",
      title: "New title",
      url: "https://news.example/story",
      capturedExcerpt: "Acme raised funding.",
      retrievedAt: 123,
    });

    expect(result.deduplicated).toBe(true);
    expect(sourceRepo.create).not.toHaveBeenCalled();
    expect(timelineRepo.insertEvent).not.toHaveBeenCalled();
  });

  it("creates a source with a derived host and logs review transitions", async () => {
    vi.mocked(dossierRepo.findById).mockResolvedValue(makeDossier());
    vi.mocked(sourceRepo.findByContentHash).mockResolvedValue(null);
    vi.mocked(sourceRepo.create).mockResolvedValue({
      id: "source-2",
      tenantId: "tenant-1",
      dossierId: "dossier-1",
      runId: null,
      sourceType: "company_site",
      title: "Company site",
      url: "https://careers.acme.test/about",
      sourceHost: "careers.acme.test",
      capturedExcerpt: "About Acme",
      retrievedAt: 321,
      reviewState: "unreviewed",
      reviewerNote: null,
      contentHash: "hash-2",
      createdAt: "",
      updatedAt: "",
    });
    vi.mocked(sourceRepo.findById).mockResolvedValue({
      id: "source-2",
      tenantId: "tenant-1",
      dossierId: "dossier-1",
      runId: null,
      sourceType: "company_site",
      title: "Company site",
      url: "https://careers.acme.test/about",
      sourceHost: "careers.acme.test",
      capturedExcerpt: "About Acme",
      retrievedAt: 321,
      reviewState: "unreviewed",
      reviewerNote: null,
      contentHash: "hash-2",
      createdAt: "",
      updatedAt: "",
    });
    vi.mocked(sourceRepo.update).mockResolvedValue({
      id: "source-2",
      tenantId: "tenant-1",
      dossierId: "dossier-1",
      runId: null,
      sourceType: "company_site",
      title: "Company site",
      url: "https://careers.acme.test/about",
      sourceHost: "careers.acme.test",
      capturedExcerpt: "About Acme",
      retrievedAt: 321,
      reviewState: "verified",
      reviewerNote: null,
      contentHash: "hash-2",
      createdAt: "",
      updatedAt: "",
    });

    await saveSource("dossier-1", {
      sourceType: "company_site",
      title: "Company site",
      url: "https://careers.acme.test/about",
      capturedExcerpt: "About Acme",
      retrievedAt: 321,
    });

    expect(sourceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ sourceHost: "careers.acme.test" }),
    );
    expect(timelineRepo.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "source_saved" }),
    );

    await updateSource("source-2", { reviewState: "verified" });

    expect(timelineRepo.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        dossierId: "dossier-1",
        eventType: "source_reviewed",
        payload: {
          sourceId: "source-2",
          sourceType: "company_site",
          reviewState: "verified",
        },
      }),
    );
  });
});