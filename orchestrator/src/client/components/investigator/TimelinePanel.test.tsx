import { renderWithQueryClient } from "@client/test/renderWithQueryClient";
import { fireEvent, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TimelinePanel } from "./TimelinePanel";

const mocks = vi.hoisted(() => ({
  useTimeline: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("@client/hooks/queries/useInvestigatorQueries", () => ({
  useTimeline: mocks.useTimeline,
}));

vi.mock("../layout", () => ({
  EmptyState: ({
    title,
    description,
  }: {
    title: string;
    description?: string;
  }) => (
    <div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  ),
}));

const renderPanel = () =>
  renderWithQueryClient(<TimelinePanel dossierId="dossier-1" />);

describe("TimelinePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refetch.mockResolvedValue(undefined);
  });

  it("renders timeline events with labels and payload summaries", () => {
    mocks.useTimeline.mockReturnValue({
      data: [
        {
          id: "event-1",
          tenantId: "tenant-1",
          dossierId: "dossier-1",
          runId: null,
          eventType: "source_reviewed",
          payload: {
            sourceId: "source-1",
            reviewState: "verified",
          },
          occurredAt: 1_714_607_200,
          createdAt: "",
          updatedAt: "",
        },
      ],
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetch,
    });

    renderPanel();

    expect(screen.getByText("Source reviewed")).toBeInTheDocument();
    expect(
      screen.getByText(/source id: source-1 • review state: verified/i),
    ).toBeInTheDocument();
  });

  it("renders an empty state when the dossier has no events", () => {
    mocks.useTimeline.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetch,
    });

    renderPanel();

    expect(screen.getByText("No timeline events yet")).toBeInTheDocument();
  });

  it("retries after a timeline load error", () => {
    mocks.useTimeline.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: mocks.refetch,
    });

    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });
});