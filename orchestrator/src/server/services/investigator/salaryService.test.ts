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

vi.mock("@server/repositories/investigatorTimelineRepository", () => ({
  insertEvent: vi.fn(),
}));

import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import * as salaryRepo from "@server/repositories/investigatorSalaryRepository";
import * as timelineRepo from "@server/repositories/investigatorTimelineRepository";
import { createObservation, updateObservation } from "./salaryService";

describe("salaryService", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid salary ranges during creation", async () => {
    vi.mocked(dossierRepo.findById).mockResolvedValue({ id: "dossier-1" });

    await expect(
      createObservation("dossier-1", {
        minAmount: 200_000,
        maxAmount: 100_000,
        confidenceLabel: "high",
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("writes a timeline event when a salary observation is created and validates updates", async () => {
    vi.mocked(dossierRepo.findById).mockResolvedValue({ id: "dossier-1" });
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

    expect(timelineRepo.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "salary_saved" }),
    );

    await expect(
      updateObservation("obs-1", { minAmount: 190_000, maxAmount: 120_000 }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
});