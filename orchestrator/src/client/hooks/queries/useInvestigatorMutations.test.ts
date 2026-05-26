import * as investigatorApi from "@client/api/investigator";
import type { InvestigatorDossier, InvestigatorSummary } from "@shared/types";
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/client/lib/queryKeys";
import { renderHookWithQueryClient } from "@/client/test/renderWithQueryClient";
import { useLinkJob, useRegenerateSummary } from "./useInvestigatorMutations";

vi.mock("@client/api/investigator", () => ({
  linkJob: vi.fn(),
  regenerateSummary: vi.fn(),
}));

describe("investigator mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates linked jobs, dossier, and dossiers after linking a job", async () => {
    vi.mocked(investigatorApi.linkJob).mockResolvedValue({
      id: "d-1",
    } as InvestigatorDossier);

    const { result, queryClient } = renderHookWithQueryClient(() =>
      useLinkJob(),
    );
    const invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);

    await act(async () => {
      await result.current.mutateAsync({
        dossierId: "d-1",
        input: { jobId: "j-1" },
      });
    });

    expect(investigatorApi.linkJob).toHaveBeenCalledWith("d-1", {
      jobId: "j-1",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.investigator.linkedJobs("d-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.investigator.dossier("d-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.investigator.dossiers(),
    });
  });

  it("calls regenerate API with summary type and invalidates summaries + dossier", async () => {
    vi.mocked(investigatorApi.regenerateSummary).mockResolvedValue({
      id: "s-1",
    } as InvestigatorSummary);

    const { result, queryClient } = renderHookWithQueryClient(() =>
      useRegenerateSummary(),
    );
    const invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);

    await act(async () => {
      await result.current.mutateAsync({
        dossierId: "d-1",
        type: "company_brief",
        runId: null,
      });
    });

    expect(investigatorApi.regenerateSummary).toHaveBeenCalledWith(
      "d-1",
      "company_brief",
      null,
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.investigator.summaries("d-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.investigator.dossier("d-1"),
    });
  });
});
