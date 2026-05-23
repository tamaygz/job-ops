import type {
  InvestigatorDossierListFilters,
  JobStatus,
  PostApplicationProvider,
} from "@shared/types";

export const queryKeys = {
  designResume: {
    all: ["design-resume"] as const,
    current: () => [...queryKeys.designResume.all, "current"] as const,
    status: () => [...queryKeys.designResume.all, "status"] as const,
  },
  settings: {
    all: ["settings"] as const,
    current: () => [...queryKeys.settings.all, "current"] as const,
  },
  profile: {
    all: ["profile"] as const,
    current: () => [...queryKeys.profile.all, "current"] as const,
  },
  tracer: {
    all: ["tracer"] as const,
    readiness: (force = false) =>
      [...queryKeys.tracer.all, "readiness", { force }] as const,
    analytics: (options?: {
      from?: number;
      to?: number;
      includeBots?: boolean;
      limit?: number;
    }) => [...queryKeys.tracer.all, "analytics", options ?? {}] as const,
    jobLinks: (
      jobId: string,
      options?: { from?: number; to?: number; includeBots?: boolean },
    ) => [...queryKeys.tracer.all, "job-links", jobId, options ?? {}] as const,
  },
  demo: {
    all: ["demo"] as const,
    info: () => [...queryKeys.demo.all, "info"] as const,
  },
  jobs: {
    all: ["jobs"] as const,
    inProgressBoard: () =>
      [...queryKeys.jobs.all, "in-progress-board"] as const,
    list: (options?: { statuses?: JobStatus[]; view?: "list" | "full" }) =>
      [...queryKeys.jobs.all, "list", options ?? {}] as const,
    revision: (options?: { statuses?: JobStatus[] }) =>
      [...queryKeys.jobs.all, "revision", options ?? {}] as const,
    detail: (id: string) => [...queryKeys.jobs.all, "detail", id] as const,
    stageEvents: (id: string) =>
      [...queryKeys.jobs.all, "stage-events", id] as const,
    tasks: (id: string) => [...queryKeys.jobs.all, "tasks", id] as const,
    notes: (id: string) => [...queryKeys.jobs.all, "notes", id] as const,
    documents: (id: string) =>
      [...queryKeys.jobs.all, "documents", id] as const,
    emails: (id: string, limit: number) =>
      [...queryKeys.jobs.all, "emails", id, { limit }] as const,
  },
  pipeline: {
    all: ["pipeline"] as const,
    status: () => [...queryKeys.pipeline.all, "status"] as const,
    runs: () => [...queryKeys.pipeline.all, "runs"] as const,
    runInsights: (id: string) =>
      [...queryKeys.pipeline.all, "run-insights", id] as const,
  },
  watchlist: {
    all: ["watchlist"] as const,
    sources: () => [...queryKeys.watchlist.all, "sources"] as const,
    results: () => [...queryKeys.watchlist.all, "results"] as const,
    states: () => [...queryKeys.watchlist.all, "states"] as const,
  },
  visaSponsors: {
    all: ["visa-sponsors"] as const,
    status: () => [...queryKeys.visaSponsors.all, "status"] as const,
    search: (
      query: string,
      limit: number,
      minScore: number,
      country?: string,
    ) =>
      [
        ...queryKeys.visaSponsors.all,
        "search",
        { query, limit, minScore, country: country ?? null },
      ] as const,
    organization: (name: string, providerId?: string) =>
      [
        ...queryKeys.visaSponsors.all,
        "organization",
        { name, providerId: providerId ?? null },
      ] as const,
  },
  postApplication: {
    all: ["post-application"] as const,
    providerStatus: (provider: PostApplicationProvider, accountKey: string) =>
      [
        ...queryKeys.postApplication.all,
        "provider-status",
        { provider, accountKey },
      ] as const,
    inbox: (
      provider: PostApplicationProvider,
      accountKey: string,
      limit: number,
    ) =>
      [
        ...queryKeys.postApplication.all,
        "inbox",
        { provider, accountKey, limit },
      ] as const,
    runs: (
      provider: PostApplicationProvider,
      accountKey: string,
      limit: number,
    ) =>
      [
        ...queryKeys.postApplication.all,
        "runs",
        { provider, accountKey, limit },
      ] as const,
    runMessages: (
      runId: string,
      provider: PostApplicationProvider,
      accountKey: string,
    ) =>
      [
        ...queryKeys.postApplication.all,
        "run-messages",
        { runId, provider, accountKey },
      ] as const,
  },
  backups: {
    all: ["backups"] as const,
    list: () => [...queryKeys.backups.all, "list"] as const,
  },
  investigator: {
    all: ["investigator"] as const,
    dossiers: (filters?: InvestigatorDossierListFilters) =>
      [...queryKeys.investigator.all, "dossiers", filters ?? {}] as const,
    dossier: (dossierId: string) =>
      [...queryKeys.investigator.all, "dossier", dossierId] as const,
    runs: (dossierId: string) =>
      [...queryKeys.investigator.all, "runs", dossierId] as const,
    run: (dossierId: string, runId: string) =>
      [...queryKeys.investigator.all, "run", dossierId, runId] as const,
    sources: (dossierId: string) =>
      [...queryKeys.investigator.all, "sources", dossierId] as const,
    people: (dossierId: string) =>
      [...queryKeys.investigator.all, "people", dossierId] as const,
    salary: (dossierId: string) =>
      [...queryKeys.investigator.all, "salary", dossierId] as const,
    summaries: (dossierId: string, opts?: { latestOnly?: boolean }) =>
      [
        ...queryKeys.investigator.all,
        "summaries",
        dossierId,
        opts ?? {},
      ] as const,
    linkedJobs: (dossierId: string) =>
      [...queryKeys.investigator.all, "linked-jobs", dossierId] as const,
    timeline: (dossierId: string, opts?: { limit?: number; before?: number }) =>
      [
        ...queryKeys.investigator.all,
        "timeline",
        dossierId,
        opts ?? {},
      ] as const,
  },
} as const;
