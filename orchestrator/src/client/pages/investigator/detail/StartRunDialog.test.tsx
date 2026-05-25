import { renderWithQueryClient } from "@client/test/renderWithQueryClient";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StartRunDialog } from "./StartRunDialog";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  mutateAsync: vi.fn(),
  useStartRun: vi.fn(),
  success: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("@client/hooks/queries/useInvestigatorMutations", () => ({
  useStartRun: mocks.useStartRun,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.success,
  },
}));

describe("StartRunDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useStartRun.mockReturnValue({
      mutateAsync: mocks.mutateAsync,
      isPending: false,
    });
    mocks.mutateAsync.mockResolvedValue({ id: "run-77" });
  });

  it("shows a success toast with a See details action after starting a run", async () => {
    const onClose = vi.fn();
    renderWithQueryClient(
      <StartRunDialog dossierId="dossier-1" open onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^start$/i }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        dossierId: "dossier-1",
        input: { runKind: "company_brief" },
      }),
    );

    expect(mocks.success).toHaveBeenCalledWith(
      "Research started",
      expect.objectContaining({
        description: expect.stringMatching(
          /follow each recorded research step/i,
        ),
        action: expect.objectContaining({
          label: "See details",
          onClick: expect.any(Function),
        }),
      }),
    );

    const [, options] = mocks.success.mock.calls[0];
    options.action.onClick();

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/investigator/dossier-1/runs/run-77",
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
