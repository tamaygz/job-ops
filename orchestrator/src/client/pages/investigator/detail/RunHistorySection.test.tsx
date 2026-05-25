import { renderWithQueryClient } from "@client/test/renderWithQueryClient";
import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RunHistorySection } from "./RunHistorySection";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  mutateAsync: vi.fn(),
  useCancelRun: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("@client/hooks/queries/useInvestigatorMutations", () => ({
  useCancelRun: mocks.useCancelRun,
}));

describe("RunHistorySection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCancelRun.mockReturnValue({
      mutateAsync: mocks.mutateAsync,
      isPending: false,
    });
  });

  it("navigates to the run details page from history", () => {
    renderWithQueryClient(
      <RunHistorySection
        dossierId="dossier-1"
        runs={[
          {
            id: "run-1",
            tenantId: "tenant-1",
            dossierId: "dossier-1",
            runKind: "company_brief",
            status: "completed",
            initiatedBy: "user",
            seedContext: null,
            startedAt: 1,
            completedAt: 2,
            errorCode: null,
            errorMessage: null,
            createdAt: "",
            updatedAt: "",
          },
        ]}
        runsLoading={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /see details/i }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/investigator/dossier-1/runs/run-1",
    );
  });
});
