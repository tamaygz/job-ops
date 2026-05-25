import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadInvestigatorGatherSettings: vi.fn(),
  runSourceProviders: vi.fn(),
  runPeopleProviders: vi.fn(),
  runSalaryProviders: vi.fn(),
  runSummaryPhase: vi.fn(),
  notifyRunProgress: vi.fn(),
  findRunById: vi.fn(),
}));

vi.mock("./settings", () => ({
  loadInvestigatorGatherSettings: mocks.loadInvestigatorGatherSettings,
}));

vi.mock("./sources", () => ({
  runSourceProviders: mocks.runSourceProviders,
}));

vi.mock("./people", () => ({
  runPeopleProviders: mocks.runPeopleProviders,
}));

vi.mock("./salary", () => ({
  runSalaryProviders: mocks.runSalaryProviders,
}));

vi.mock("./summary", () => ({
  runSummaryPhase: mocks.runSummaryPhase,
}));

vi.mock("../runProgress", () => ({
  notifyRunProgress: mocks.notifyRunProgress,
}));

vi.mock("@server/repositories/investigatorRunRepository", () => ({
  findById: mocks.findRunById,
}));

import { runInvestigatorPhases } from "./runPhases";

describe("runInvestigatorPhases", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.loadInvestigatorGatherSettings.mockResolvedValue({
      sourceProviders: ["linked_jobs"],
      peopleProviders: ["source_text"],
      salaryProviders: ["job_metadata"],
    });

    mocks.runSourceProviders.mockResolvedValue({
      createdCount: 1,
      failures: [],
    });
    mocks.runPeopleProviders.mockResolvedValue({
      createdCount: 1,
      failures: [],
    });
    mocks.runSalaryProviders.mockResolvedValue({
      createdCount: 1,
      failures: [],
    });
    mocks.runSummaryPhase.mockResolvedValue(undefined);
    mocks.findRunById.mockResolvedValue({ status: "running" });
  });

  it("runs only sources and summary for company_brief", async () => {
    const result = await runInvestigatorPhases({
      runId: "run-1",
      dossierId: "dossier-1",
      runKind: "company_brief",
      dossier: {
        id: "dossier-1",
        companyName: "Acme",
      } as never,
      seedContext: null,
      researchQuestion: null,
    });

    expect(result.failures).toEqual([]);
    expect(mocks.runSourceProviders).toHaveBeenCalledOnce();
    expect(mocks.runPeopleProviders).not.toHaveBeenCalled();
    expect(mocks.runSalaryProviders).not.toHaveBeenCalled();
    expect(mocks.runSummaryPhase).toHaveBeenCalledOnce();
  });

  it("aggregates provider failures across enabled phases", async () => {
    mocks.runSourceProviders.mockResolvedValue({
      createdCount: 0,
      failures: ["source_a"],
    });
    mocks.runPeopleProviders.mockResolvedValue({
      createdCount: 0,
      failures: ["people_a"],
    });
    mocks.runSalaryProviders.mockResolvedValue({
      createdCount: 0,
      failures: ["salary_a"],
    });

    const result = await runInvestigatorPhases({
      runId: "run-2",
      dossierId: "dossier-2",
      runKind: "dossier_refresh",
      dossier: {
        id: "dossier-2",
        companyName: "Acme",
      } as never,
      seedContext: null,
      researchQuestion: null,
    });

    expect(result.failures).toEqual([
      { phase: "sources", providers: ["source_a"] },
      { phase: "people", providers: ["people_a"] },
      { phase: "salary", providers: ["salary_a"] },
    ]);
  });

  it("short-circuits remaining phases when run is cancelled", async () => {
    mocks.findRunById
      .mockResolvedValueOnce({ status: "running" })
      .mockResolvedValueOnce({ status: "cancelled" });

    const result = await runInvestigatorPhases({
      runId: "run-3",
      dossierId: "dossier-3",
      runKind: "dossier_refresh",
      dossier: {
        id: "dossier-3",
        companyName: "Acme",
      } as never,
      seedContext: null,
      researchQuestion: null,
    });

    expect(result.failures).toEqual([]);
    expect(mocks.runSourceProviders).toHaveBeenCalledOnce();
    expect(mocks.runPeopleProviders).not.toHaveBeenCalled();
    expect(mocks.runSalaryProviders).not.toHaveBeenCalled();
    expect(mocks.runSummaryPhase).not.toHaveBeenCalled();
  });
});
