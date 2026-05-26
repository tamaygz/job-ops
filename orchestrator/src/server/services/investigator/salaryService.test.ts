import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@server/repositories/investigatorDossierRepository", () => ({
  findById: vi.fn(),
}));

vi.mock("@server/repositories/investigatorSalaryRepository", () => ({
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
  findByDossier: vi.fn(),
}));

vi.mock("./timelineService", () => ({
  writeEvent: vi.fn(),
}));

import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import * as salaryRepo from "@server/repositories/investigatorSalaryRepository";
import type { InvestigatorDossier } from "@shared/types";
import { createObservation, updateObservation } from "./salaryService";
import * as timelineService from "./timelineService";

function makeDossier(): InvestigatorDossier {
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

describe("salaryService", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid salary ranges during creation", async () => {
    vi.mocked(dossierRepo.findById).mockResolvedValue(makeDossier());

    await expect(
      createObservation("dossier-1", {
        minAmount: 200_000,
        maxAmount: 100_000,
        confidenceLabel: "high",
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("writes a timeline event when a salary observation is created and validates updates", async () => {
    vi.mocked(dossierRepo.findById).mockResolvedValue(makeDossier());
    vi.mocked(salaryRepo.create).mockResolvedValue({
      id: "obs-1",
      tenantId: "tenant-1",
      dossierId: "dossier-1",
      runId: null,
      roleScope: "Engineer",
      geoScope: null,
      currency: "USD",
      payInterval: "annual",
      minAmount: 100_000,
      maxAmount: 150_000,
      equityText: null,
      bonusText: null,
      confidenceLabel: "high",
      sourceId: null,
      observedAt: 123,
      notes: null,
      createdAt: "",
      updatedAt: "",
    });
    vi.mocked(salaryRepo.findById).mockResolvedValue({
      id: "obs-1",
      tenantId: "tenant-1",
      dossierId: "dossier-1",
      runId: null,
      roleScope: "Engineer",
      geoScope: null,
      currency: "USD",
      payInterval: "annual",
      minAmount: 100_000,
      maxAmount: 150_000,
      equityText: null,
      bonusText: null,
      confidenceLabel: "high",
      sourceId: null,
      observedAt: 123,
      notes: null,
      createdAt: "",
      updatedAt: "",
    });

    await createObservation("dossier-1", {
      roleScope: "Engineer",
      minAmount: 100_000,
      maxAmount: 150_000,
      payInterval: "annual",
      confidenceLabel: "high",
      observedAt: 123,
    });

    expect(timelineService.writeEvent).toHaveBeenCalledWith(
      "dossier-1",
      "salary_saved",
      { observationId: "obs-1" },
      expect.objectContaining({ occurredAt: expect.any(Number) }),
    );

    await expect(
      updateObservation("obs-1", { minAmount: 190_000, maxAmount: 120_000 }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
});
