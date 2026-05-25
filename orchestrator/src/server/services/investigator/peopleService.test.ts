import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@server/repositories/investigatorDossierRepository", () => ({
  findById: vi.fn(),
}));

vi.mock("@server/repositories/investigatorPeopleRepository", () => ({
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
import * as peopleRepo from "@server/repositories/investigatorPeopleRepository";
import * as timelineRepo from "@server/repositories/investigatorTimelineRepository";
import { createPerson, updatePerson } from "./peopleService";

describe("peopleService", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when creating a person for a missing dossier", async () => {
    vi.mocked(dossierRepo.findById).mockResolvedValue(null);

    await expect(
      createPerson("dossier-1", {
        fullName: "Taylor Dev",
        personType: "hiring_manager",
        confidenceLabel: "high",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("writes a timeline event when a person is updated", async () => {
    vi.mocked(peopleRepo.findById).mockResolvedValue({
      id: "person-1",
      tenantId: "tenant-1",
      dossierId: "dossier-1",
      runId: "run-1",
      fullName: "Taylor Dev",
      personType: "hiring_manager",
      title: "Director",
      profileUrl: null,
      roleContext: null,
      notes: null,
      confidenceLabel: "high",
      sourceIds: [],
      createdAt: "",
      updatedAt: "",
    });
    vi.mocked(peopleRepo.update).mockResolvedValue({
      id: "person-1",
      tenantId: "tenant-1",
      dossierId: "dossier-1",
      runId: "run-1",
      fullName: "Taylor Architect",
      personType: "hiring_manager",
      title: "Director",
      profileUrl: null,
      roleContext: null,
      notes: null,
      confidenceLabel: "high",
      sourceIds: [],
      createdAt: "",
      updatedAt: "",
    });

    await updatePerson("person-1", { fullName: "Taylor Architect" });

    expect(timelineRepo.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        dossierId: "dossier-1",
        runId: "run-1",
        eventType: "person_saved",
        payload: { personId: "person-1", fullName: "Taylor Architect" },
      }),
    );
  });
});