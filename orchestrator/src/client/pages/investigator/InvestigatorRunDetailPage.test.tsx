import { renderWithQueryClient } from "@client/test/renderWithQueryClient";
import { screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvestigatorRunDetailPage } from "./InvestigatorRunDetailPage";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useDossier: vi.fn(),
  usePeople: vi.fn(),
  useRun: vi.fn(),
  useSalary: vi.fn(),
  useSources: vi.fn(),
  useSummaries: vi.fn(),
  useTimeline: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useParams: () => ({ dossierId: "dossier-1", runId: "run-1" }),
  };
});

vi.mock("@client/hooks/queries/useInvestigatorQueries", () => ({
  useDossier: mocks.useDossier,
  usePeople: mocks.usePeople,
  useRun: mocks.useRun,
  useSalary: mocks.useSalary,
  useSources: mocks.useSources,
  useSummaries: mocks.useSummaries,
  useTimeline: mocks.useTimeline,
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

describe("InvestigatorRunDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useDossier.mockReturnValue({
      data: {
        id: "dossier-1",
        companyName: "Acme Corp",
        companyUrl: "https://acme.test",
      },
      isLoading: false,
      error: null,
    });
    mocks.useRun.mockReturnValue({
      data: {
        id: "run-1",
        dossierId: "dossier-1",
        runKind: "dossier_refresh",
        status: "completed",
        initiatedBy: "user",
        startedAt: 10,
        completedAt: 20,
        errorMessage: null,
      },
      isLoading: false,
      error: null,
    });
    mocks.useSources.mockReturnValue({
      data: [
        {
          id: "source-1",
          runId: "run-1",
          title: "CEO profile",
          sourceType: "public_profile",
          sourceHost: "acme.test",
          capturedExcerpt: "Found Max Mustermann as CEO.",
          url: "https://acme.test/team",
        },
        {
          id: "source-2",
          runId: "run-2",
          title: "Old source",
          sourceType: "news_article",
          sourceHost: "news.test",
          capturedExcerpt: "Should be filtered out.",
          url: "https://news.test/story",
        },
      ],
      isLoading: false,
    });
    mocks.usePeople.mockReturnValue({
      data: [
        {
          id: "person-1",
          runId: "run-1",
          fullName: "Max Mustermann",
          personType: "executive",
          confidenceLabel: "high",
          title: "CEO",
          notes: null,
        },
      ],
      isLoading: false,
    });
    mocks.useSalary.mockReturnValue({
      data: [
        {
          id: "salary-1",
          runId: "run-1",
          roleScope: "Staff engineer",
          confidenceLabel: "medium",
          minAmount: 100000,
          maxAmount: 140000,
          currency: "USD",
          payInterval: "annual",
          geoScope: "Remote",
          notes: "From compensation page",
        },
      ],
      isLoading: false,
    });
    mocks.useSummaries.mockReturnValue({
      data: [
        {
          id: "summary-1",
          runId: "run-1",
          title: "Company brief",
          summaryType: "company_brief",
          bodyMarkdown: "Acme is expanding its platform team.",
        },
      ],
      isLoading: false,
    });
    mocks.useTimeline.mockReturnValue({
      data: [
        {
          id: "event-1",
          runId: "run-1",
          eventType: "source_saved",
          payload: { sourceId: "source-1", sourceType: "public_profile" },
          occurredAt: 12,
        },
        {
          id: "event-2",
          runId: "run-2",
          eventType: "source_saved",
          payload: { sourceId: "source-2", sourceType: "news_article" },
          occurredAt: 9,
        },
      ],
      isLoading: false,
    });
  });

  it("shows only evidence and audit events for the selected run", () => {
    renderWithQueryClient(<InvestigatorRunDetailPage />);

    expect(screen.getByText(/dossier refresh details/i)).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/i)).toBeInTheDocument();
    expect(screen.getByText(/CEO profile/i)).toBeInTheDocument();
    expect(screen.queryByText("Old source")).not.toBeInTheDocument();
    expect(screen.getByText("Max Mustermann")).toBeInTheDocument();
    expect(screen.getByText("Staff engineer")).toBeInTheDocument();
    expect(
      screen.getByText("Acme is expanding its platform team."),
    ).toBeInTheDocument();
    expect(screen.getByText("Source saved")).toBeInTheDocument();
    expect(screen.queryByText(/source-2/i)).not.toBeInTheDocument();
  });
});
