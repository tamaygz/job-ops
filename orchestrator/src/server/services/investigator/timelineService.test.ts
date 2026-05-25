import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@server/repositories/investigatorDossierRepository", () => ({
  findById: vi.fn(),
}));

vi.mock("@server/repositories/investigatorTimelineRepository", () => ({
  insert: vi.fn(),
  findByDossier: vi.fn(),
}));

import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import * as timelineRepo from "@server/repositories/investigatorTimelineRepository";
import { listEvents, writeEvent } from "./timelineService";

describe("timelineService", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sanitizes sensitive payload fields before writing a timeline event", async () => {
    vi.mocked(dossierRepo.findById).mockResolvedValue({ id: "dossier-1" });

    await writeEvent("dossier-1", "summary_saved", {
      accessToken: "secret-value",
      companyName: "Acme",
    });

    expect(timelineRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          accessToken: "[REDACTED]",
          companyName: "Acme",
        },
      }),
    );
  });

  it("requires a real dossier before listing events", async () => {
    vi.mocked(dossierRepo.findById).mockResolvedValue(null);

    await expect(listEvents("dossier-1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});