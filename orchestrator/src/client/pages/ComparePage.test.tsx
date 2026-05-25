import { renderWithQueryClient } from "@client/test/renderWithQueryClient";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComparePage } from "./ComparePage";

const mocks = vi.hoisted(() => ({
  scrapeProfile: vi.fn(),
  streamEvaluate: vi.fn(),
  applySectionApi: vi.fn(),
  fetchApi: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@client/api/compare", () => ({
  scrapeProfile: mocks.scrapeProfile,
  streamEvaluate: mocks.streamEvaluate,
  applySectionApi: mocks.applySectionApi,
}));

vi.mock("@client/api/core", () => ({
  fetchApi: mocks.fetchApi,
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

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

const renderPage = () => renderWithQueryClient(<ComparePage />);

const ownProfile = {
  basics: {
    name: "Taylor Dev",
    headline: "Staff Engineer",
    summary: "Builds useful things.",
    location: { city: "London" },
  },
  sections: {
    experience: {
      items: [{ id: "exp-1", position: "Engineer", company: "JobOps" }],
    },
    education: { items: [] },
    skills: { items: [{ id: "skill-1", name: "TypeScript" }] },
    certifications: { items: [] },
    projects: { items: [] },
    languages: { items: [] },
    awards: { items: [] },
  },
} as const;

const otherProfile = {
  sourceUrl: "https://www.linkedin.com/in/example-person",
  basics: {
    name: "Alex Example",
    headline: "Principal Engineer",
    summary: "Leads platform work.",
    location: "Berlin",
  },
  sections: {
    experience: [
      {
        company: "Acme",
        position: "Principal Engineer",
        period: "2021-present",
      },
    ],
    education: [],
    skills: [{ name: "Systems Design" }],
    certifications: [],
    projects: [],
    languages: [],
    awards: [],
  },
} as const;

describe("ComparePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchApi.mockImplementation(async (path: string) => {
      if (path === "/profile") {
        return ownProfile;
      }
      if (path === "/profile/status") {
        return { exists: true };
      }
      if (path === "/jobs?statuses=ready&view=list") {
        return {
          jobs: [{ id: "job-1", title: "Platform Engineer", company: "Acme" }],
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });
  });

  it("shows a validation error for non-LinkedIn URLs", async () => {
    renderPage();

    fireEvent.change(
      await screen.findByPlaceholderText(/linkedin.com\/in\/username/i),
      {
        target: { value: "https://example.com/not-linkedin" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: /^compare$/i }));

    expect(
      await screen.findByText(/please enter a valid linkedin profile url/i),
    ).toBeInTheDocument();
    expect(mocks.scrapeProfile).not.toHaveBeenCalled();
  });

  it("loads a comparison, streams evaluations, and reveals job context", async () => {
    mocks.scrapeProfile.mockResolvedValue(otherProfile);
    mocks.streamEvaluate.mockImplementation(
      async (
        _profileUrl: string,
        _jobId: string | null | undefined,
        options: { onEvent: (event: Record<string, unknown>) => void },
      ) => {
        options.onEvent({
          type: "section_eval",
          section: "basics",
          verdict: "stronger",
          rationale: "Stronger summary alignment.",
        });
        options.onEvent({ type: "done" });
      },
    );

    renderPage();

    fireEvent.change(
      await screen.findByPlaceholderText(/linkedin.com\/in\/username/i),
      {
        target: { value: otherProfile.sourceUrl },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: /^compare$/i }));

    await waitFor(() => expect(mocks.scrapeProfile).toHaveBeenCalled());
    await waitFor(() => expect(mocks.streamEvaluate).toHaveBeenCalled());
    expect(
      await screen.findByRole("button", { name: /clear comparison/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/compare against a job \(optional\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/profile summary/i)).toBeInTheDocument();
    expect(screen.getByText(/stronger/i)).toBeInTheDocument();
  });
});
