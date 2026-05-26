import { renderWithQueryClient } from "@client/test/renderWithQueryClient";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvestigatorDetailPage } from "./InvestigatorDetailPage";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useDossier: vi.fn(),
  useRuns: vi.fn(),
  useStartRun: vi.fn(),
  useUpdateDossier: vi.fn(),
  useCancelRun: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useParams: () => ({ dossierId: "dossier-1" }),
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ state: null }),
  };
});

vi.mock("@client/hooks/queries/useInvestigatorQueries", () => ({
  useDossier: mocks.useDossier,
  useRuns: mocks.useRuns,
}));

vi.mock("@client/hooks/queries/useInvestigatorMutations", () => ({
  useStartRun: mocks.useStartRun,
  useUpdateDossier: mocks.useUpdateDossier,
  useCancelRun: mocks.useCancelRun,
}));

vi.mock("@client/components/layout", () => ({
  PageHeader: ({
    title,
    subtitle,
    actions,
  }: {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {actions}
    </header>
  ),
  PageMain: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
    disabled,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => onSelect?.()}
    >
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock("@client/components/investigator/RunProgressPanel", () => ({
  RunProgressPanel: ({ dossierId }: { dossierId: string }) => (
    <div data-testid="run-progress-panel">Run progress for {dossierId}</div>
  ),
}));

vi.mock("@client/components/investigator/SummaryPanel", () => ({
  SummaryPanel: ({ dossierId }: { dossierId: string }) => (
    <div data-testid="summary-panel">Summary {dossierId}</div>
  ),
}));

vi.mock("@client/components/investigator/SourceReviewPanel", () => ({
  SourceReviewPanel: ({ dossierId }: { dossierId: string }) => (
    <div data-testid="sources-panel">Sources {dossierId}</div>
  ),
}));

vi.mock("@client/components/investigator/PeoplePanel", () => ({
  PeoplePanel: ({ dossierId }: { dossierId: string }) => (
    <div data-testid="people-panel">People {dossierId}</div>
  ),
}));

vi.mock("@client/components/investigator/SalaryPanel", () => ({
  SalaryPanel: ({ dossierId }: { dossierId: string }) => (
    <div data-testid="salary-panel">Salary {dossierId}</div>
  ),
}));

vi.mock("./InvestigatorListPage", () => ({
  dossierStatusConfig: {
    active: { label: "Active", className: "text-emerald-400" },
    archived: { label: "Archived", className: "text-zinc-400" },
  },
}));

const renderPage = () => renderWithQueryClient(<InvestigatorDetailPage />);

describe("InvestigatorDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useStartRun.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    mocks.useUpdateDossier.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    mocks.useCancelRun.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it("renders dossier details, tabs, and the empty run-history state", () => {
    mocks.useDossier.mockReturnValue({
      data: {
        id: "dossier-1",
        companyName: "Acme Corp",
        companyUrl: "https://acme.test",
        status: "active",
        tags: ["fintech", "remote"],
      },
      isLoading: false,
      error: null,
    });
    mocks.useRuns.mockReturnValue({ data: [], isLoading: false });

    renderPage();

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /website/i })).toHaveAttribute(
      "href",
      "https://acme.test",
    );
    expect(
      screen.getByRole("button", { name: /start research/i }),
    ).toBeEnabled();
    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("People")).toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.getByTestId("run-progress-panel")).toBeInTheDocument();
    expect(screen.getByTestId("summary-panel")).toBeInTheDocument();
    expect(
      screen.getByText(
        /no research runs yet\. click "start research" to begin\./i,
      ),
    ).toBeInTheDocument();
  });

  it("shows an active run as running and disables the start button", () => {
    mocks.useDossier.mockReturnValue({
      data: {
        id: "dossier-1",
        companyName: "Acme Corp",
        companyUrl: null,
        status: "active",
        tags: [],
      },
      isLoading: false,
      error: null,
    });
    mocks.useRuns.mockReturnValue({
      data: [
        {
          id: "run-1",
          dossierId: "dossier-1",
          runKind: "company_brief",
          status: "running",
          errorMessage: null,
        },
      ],
      isLoading: false,
    });

    renderPage();

    expect(
      screen.getByRole("button", { name: /running…|running\.\.\./i }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("archives from the action menu using useUpdateDossier", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    mocks.useDossier.mockReturnValue({
      data: {
        id: "dossier-1",
        companyName: "Acme Corp",
        companyUrl: null,
        status: "active",
        tags: [],
      },
      isLoading: false,
      error: null,
    });
    mocks.useRuns.mockReturnValue({ data: [], isLoading: false });
    mocks.useUpdateDossier.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    renderPage();

    fireEvent.click(screen.getByRole("menuitem", { name: /archive/i }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        id: "dossier-1",
        input: { status: "archived" },
      }),
    );
  });
});
