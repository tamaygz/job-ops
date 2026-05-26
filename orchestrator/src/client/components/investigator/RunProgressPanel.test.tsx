import { renderWithQueryClient } from "@client/test/renderWithQueryClient";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RunProgressPanel } from "./RunProgressPanel";

const mocks = vi.hoisted(() => ({
  useRuns: vi.fn(),
  useRun: vi.fn(),
  useCancelRun: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("@client/hooks/queries/useInvestigatorQueries", () => ({
  useRuns: mocks.useRuns,
  useRun: mocks.useRun,
}));

vi.mock("@client/hooks/queries/useInvestigatorMutations", () => ({
  useCancelRun: mocks.useCancelRun,
}));

vi.mock("@client/lib/error-toast", () => ({
  showErrorToast: mocks.showErrorToast,
}));

const queuedRun = {
  id: "run-1",
  tenantId: "tenant-1",
  dossierId: "dossier-1",
  runKind: "company_brief",
  status: "queued",
  initiatedBy: "user",
  seedContext: null,
  startedAt: null,
  completedAt: null,
  errorCode: null,
  errorMessage: null,
  createdAt: "",
  updatedAt: "",
};

const failedRun = {
  ...queuedRun,
  status: "failed",
  errorMessage: "Upstream timeout",
};

const renderPanel = (onStartRun = vi.fn()) =>
  renderWithQueryClient(
    <RunProgressPanel dossierId="dossier-1" onStartRun={onStartRun} />,
  );

describe("RunProgressPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCancelRun.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    });
  });

  it("confirms and cancels an active queued run", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mocks.useRuns.mockReturnValue({ data: [queuedRun] });
    mocks.useRun.mockReturnValue({ data: queuedRun, refetch: vi.fn() });
    mocks.useCancelRun.mockReturnValue({ mutateAsync, isPending: false });

    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    fireEvent.click(screen.getByRole("button", { name: /yes, cancel/i }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        dossierId: "dossier-1",
        runId: "run-1",
      }),
    );
  });

  it("offers a retry action for a failed run", () => {
    const onStartRun = vi.fn();
    mocks.useRuns.mockReturnValue({ data: [failedRun] });
    mocks.useRun.mockReturnValue({ data: failedRun, refetch: vi.fn() });

    renderPanel(onStartRun);

    expect(screen.getByText(/research failed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(onStartRun).toHaveBeenCalledTimes(1);
  });
});
