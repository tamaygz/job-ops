import * as investigatorApi from "@client/api/investigator";
import type { InvestigatorDossierListFilters } from "@shared/types";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/client/lib/queryKeys";

// ---------------------------------------------------------------------------
// Dossiers
// ---------------------------------------------------------------------------

export function useDossiers(
  filters?: InvestigatorDossierListFilters,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.investigator.dossiers(filters),
    queryFn: () => investigatorApi.listDossiers(filters),
    enabled: options?.enabled,
  });
}

export function useDossier(dossierId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.investigator.dossier(dossierId),
    queryFn: () => investigatorApi.getDossier(dossierId),
    enabled: options?.enabled,
  });
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export function useRuns(dossierId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.investigator.runs(dossierId),
    queryFn: () => investigatorApi.listRuns(dossierId),
    enabled: options?.enabled,
  });
}

export function useRun(
  dossierId: string,
  runId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.investigator.run(dossierId, runId),
    queryFn: () => investigatorApi.getRun(dossierId, runId),
    enabled: options?.enabled,
  });
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export function useSources(dossierId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.investigator.sources(dossierId),
    queryFn: () => investigatorApi.listSources(dossierId),
    enabled: options?.enabled,
  });
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export function usePeople(dossierId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.investigator.people(dossierId),
    queryFn: () => investigatorApi.listPeople(dossierId),
    enabled: options?.enabled,
  });
}

// ---------------------------------------------------------------------------
// Salary
// ---------------------------------------------------------------------------

export function useSalary(dossierId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.investigator.salary(dossierId),
    queryFn: () => investigatorApi.listSalary(dossierId),
    enabled: options?.enabled,
  });
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export function useSummaries(
  dossierId: string,
  opts?: { latestOnly?: boolean },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.investigator.summaries(dossierId, opts),
    queryFn: () => investigatorApi.listSummaries(dossierId, opts),
    enabled: options?.enabled,
  });
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export function useTimeline(
  dossierId: string,
  opts?: { limit?: number; before?: number },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.investigator.timeline(dossierId, opts),
    queryFn: () => investigatorApi.listTimeline(dossierId, opts),
    enabled: options?.enabled,
  });
}

// ---------------------------------------------------------------------------
// Linked jobs
// ---------------------------------------------------------------------------

export function useLinkedJobs(
  dossierId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.investigator.linkedJobs(dossierId),
    queryFn: () => investigatorApi.listLinkedJobs(dossierId),
    enabled: options?.enabled,
  });
}
