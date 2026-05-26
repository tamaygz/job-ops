import { renderWithQueryClient } from "@client/test/renderWithQueryClient";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvestigatorListPage } from "./InvestigatorListPage";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useDossiers: vi.fn(),
  useCreateDossier: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("@client/hooks/queries/useInvestigatorQueries", () => ({
  useDossiers: mocks.useDossiers,
}));

vi.mock("@client/hooks/queries/useInvestigatorMutations", () => ({
  useCreateDossier: mocks.useCreateDossier,
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
  EmptyState: ({
    title,
    description,
    action,
  }: {
    title: string;
    description?: string;
    action?: React.ReactNode;
  }) => (
    <div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  ),
}));

const renderPage = () => renderWithQueryClient(<InvestigatorListPage />);

describe("InvestigatorListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCreateDossier.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ id: "dossier-1" }),
      isPending: false,
    });
  });

  it("renders the empty state and updates search and tag filters", () => {
    mocks.useDossiers.mockReturnValue({ data: [], isLoading: false });

    renderPage();

    expect(screen.getByText("No dossiers yet")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search companies/i), {
      target: { value: "Acme" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^tag$/i), {
      target: { value: "fintech" },
    });

    expect(mocks.useDossiers).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: "Acme", tag: "fintech" }),
    );
  });

  it("submits a new dossier from the creation dialog", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "dossier-2" });
    mocks.useDossiers.mockReturnValue({ data: [], isLoading: false });
    mocks.useCreateDossier.mockReturnValue({ mutateAsync, isPending: false });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /new dossier/i }));
    fireEvent.change(screen.getByLabelText(/company name/i), {
      target: { value: "Acme Corp" },
    });
    fireEvent.change(screen.getByLabelText(/website/i), {
      target: { value: "https://acme.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        companyName: "Acme Corp",
        companyUrl: "https://acme.test",
      }),
    );
  });

  it("navigates to the dossier detail page when a row is clicked", () => {
    mocks.useDossiers.mockReturnValue({
      data: [
        {
          id: "dossier-7",
          tenantId: "tenant-1",
          companyName: "Acme Corp",
          status: "active",
          tags: ["fintech"],
          lastResearchedAt: null,
          linkedJobCount: 2,
          createdAt: "",
        },
      ],
      isLoading: false,
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /acme corp/i }));

    expect(mocks.navigate).toHaveBeenCalledWith("/investigator/dossier-7");
  });
});
