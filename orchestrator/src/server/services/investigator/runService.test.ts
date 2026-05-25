import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  // runRepo
  create: vi.fn(),
  findById: vi.fn(),
  findActiveForDossierAndKind: vi.fn(),
  updateStatus: vi.fn(),
  // dossierRepo
  findDossierById: vi.fn(),
  // timelineRepo
  insertEvent: vi.fn(),
  // queue
  enqueue: vi.fn(),
  reserveNext: vi.fn(),
  acknowledge: vi.fn(),
  reject: vi.fn(),
  // tenancy
  getActiveTenantId: vi.fn(() => "tenant-test"),
  // worker stub
  scheduleResearchRunWorker: vi.fn(),
}));

vi.mock("@server/repositories/investigatorRunRepository", () => ({
  create: mocks.create,
  findById: mocks.findById,
  findActiveForDossierAndKind: mocks.findActiveForDossierAndKind,
  updateStatus: mocks.updateStatus,
}));

vi.mock("@server/repositories/investigatorDossierRepository", () => ({
  findById: mocks.findDossierById,
}));

vi.mock("@server/repositories/investigatorTimelineRepository", () => ({
  insertEvent: mocks.insertEvent,
}));

vi.mock("@server/infra/job-queue-registry", () => ({
  getJobQueue: vi.fn(() => ({
    enqueue: mocks.enqueue,
    reserveNext: mocks.reserveNext,
    acknowledge: mocks.acknowledge,
    reject: mocks.reject,
  })),
}));

vi.mock("@server/tenancy/context", () => ({
  getActiveTenantId: mocks.getActiveTenantId,
}));

vi.mock("./runWorker", () => ({
  scheduleResearchRunWorker: mocks.scheduleResearchRunWorker,
  drainResearchRunQueue: vi.fn(),
}));

import { cancelRun, startRun } from "./runService";

const DOSSIER_ID = "dossier-unit-001";
const RUN_ID = "run-unit-001";

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: RUN_ID,
    tenantId: "tenant-test",
    dossierId: DOSSIER_ID,
    runKind: "company_brief",
    status: "queued",
    initiatedBy: "user",
    seedContext: null,
    startedAt: null,
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("runService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveTenantId.mockReturnValue("tenant-test");
    mocks.enqueue.mockResolvedValue({
      id: "q-1",
      queue: "investigator_research_run",
      acceptedAt: new Date().toISOString(),
      deduplicated: false,
    });
    mocks.insertEvent.mockResolvedValue(undefined);
  });

  describe("startRun", () => {
    it("throws NOT_FOUND when dossier does not exist", async () => {
      mocks.findDossierById.mockResolvedValue(null);

      await expect(
        startRun(DOSSIER_ID, { runKind: "company_brief" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws CONFLICT when an active run with same kind already exists", async () => {
      mocks.findDossierById.mockResolvedValue({ id: DOSSIER_ID });
      mocks.findActiveForDossierAndKind.mockResolvedValue(
        makeRun({ status: "queued" }),
      );

      await expect(
        startRun(DOSSIER_ID, { runKind: "company_brief" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("throws CONFLICT when a running run with same kind already exists", async () => {
      mocks.findDossierById.mockResolvedValue({ id: DOSSIER_ID });
      mocks.findActiveForDossierAndKind.mockResolvedValue(
        makeRun({ id: "existing-run", status: "running" }),
      );

      await expect(
        startRun(DOSSIER_ID, { runKind: "company_brief" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("creates run, enqueues job, writes timeline event, and returns run", async () => {
      const mockRun = makeRun();
      mocks.findDossierById.mockResolvedValue({ id: DOSSIER_ID });
      mocks.findActiveForDossierAndKind.mockResolvedValue(null);
      mocks.create.mockResolvedValue(mockRun);

      const result = await startRun(DOSSIER_ID, { runKind: "company_brief" });

      expect(result).toEqual(mockRun);
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          dossierId: DOSSIER_ID,
          runKind: "company_brief",
        }),
      );
      expect(mocks.enqueue).toHaveBeenCalledWith(
        "investigator_research_run",
        expect.objectContaining({
          tenantId: "tenant-test",
          dossierId: DOSSIER_ID,
          runId: RUN_ID,
          runKind: "company_brief",
        }),
        {
          dedupeKey: "tenant-test:dossier-unit-001:company_brief",
        },
      );
      expect(mocks.insertEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "run_started", runId: RUN_ID }),
      );
      expect(mocks.scheduleResearchRunWorker).toHaveBeenCalledOnce();
    });

    it("trims and persists a non-empty research question in seedContext", async () => {
      const mockRun = makeRun();
      mocks.findDossierById.mockResolvedValue({ id: DOSSIER_ID });
      mocks.findActiveForDossierAndKind.mockResolvedValue(null);
      mocks.create.mockResolvedValue(mockRun);

      await startRun(DOSSIER_ID, {
        runKind: "company_brief",
        researchQuestion: "   What should I prepare for?   ",
      });

      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          seedContext: { researchQuestion: "What should I prepare for?" },
        }),
      );
    });

    it("does not persist whitespace-only research question in seedContext", async () => {
      const mockRun = makeRun();
      mocks.findDossierById.mockResolvedValue({ id: DOSSIER_ID });
      mocks.findActiveForDossierAndKind.mockResolvedValue(null);
      mocks.create.mockResolvedValue(mockRun);

      await startRun(DOSSIER_ID, {
        runKind: "company_brief",
        researchQuestion: "   ",
      });

      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          seedContext: null,
        }),
      );
    });

    it("cancels a newly created run and throws CONFLICT when enqueue is deduplicated", async () => {
      const mockRun = makeRun();
      mocks.findDossierById.mockResolvedValue({ id: DOSSIER_ID });
      mocks.findActiveForDossierAndKind.mockResolvedValue(null);
      mocks.create.mockResolvedValue(mockRun);
      mocks.enqueue.mockResolvedValue({
        id: "existing-queued-job",
        queue: "investigator_research_run",
        acceptedAt: new Date().toISOString(),
        deduplicated: true,
      });
      mocks.updateStatus.mockResolvedValue(makeRun({ status: "cancelled" }));

      await expect(
        startRun(DOSSIER_ID, { runKind: "company_brief" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      expect(mocks.updateStatus).toHaveBeenCalledWith(
        RUN_ID,
        "cancelled",
        expect.objectContaining({
          errorCode: "deduplicated",
          errorMessage: "Deduplicated by queued run existing-queued-job",
        }),
      );
      expect(mocks.insertEvent).not.toHaveBeenCalled();
      expect(mocks.scheduleResearchRunWorker).not.toHaveBeenCalled();
    });
  });

  describe("cancelRun", () => {
    it("throws NOT_FOUND when run does not exist", async () => {
      mocks.findById.mockResolvedValue(null);

      await expect(cancelRun(DOSSIER_ID, RUN_ID)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("throws NOT_FOUND when run belongs to different dossier", async () => {
      mocks.findById.mockResolvedValue(makeRun({ dossierId: "other-dossier" }));

      await expect(cancelRun(DOSSIER_ID, RUN_ID)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("throws CONFLICT when run is already completed", async () => {
      mocks.findById.mockResolvedValue(makeRun({ status: "completed" }));

      await expect(cancelRun(DOSSIER_ID, RUN_ID)).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });

    it("throws CONFLICT when run is already failed", async () => {
      mocks.findById.mockResolvedValue(makeRun({ status: "failed" }));

      await expect(cancelRun(DOSSIER_ID, RUN_ID)).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });

    it("throws CONFLICT when run is already cancelled", async () => {
      mocks.findById.mockResolvedValue(makeRun({ status: "cancelled" }));

      await expect(cancelRun(DOSSIER_ID, RUN_ID)).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });

    it("cancels a queued run and writes timeline event", async () => {
      const cancelledRun = makeRun({ status: "cancelled" });
      mocks.findById.mockResolvedValue(makeRun({ status: "queued" }));
      mocks.updateStatus.mockResolvedValue(cancelledRun);

      const result = await cancelRun(DOSSIER_ID, RUN_ID);

      expect(result.status).toBe("cancelled");
      expect(mocks.updateStatus).toHaveBeenCalledWith(RUN_ID, "cancelled");
      expect(mocks.insertEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "run_failed",
          payload: expect.objectContaining({ reason: "user_cancelled" }),
        }),
      );
    });

    it("cancels a running run", async () => {
      const cancelledRun = makeRun({ status: "cancelled" });
      mocks.findById.mockResolvedValue(makeRun({ status: "running" }));
      mocks.updateStatus.mockResolvedValue(cancelledRun);

      const result = await cancelRun(DOSSIER_ID, RUN_ID);

      expect(result.status).toBe("cancelled");
    });
  });
});
