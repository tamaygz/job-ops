import { z } from "zod";

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const DossierStatus = {
  active: "active",
  watchlist: "watchlist",
  interviewing: "interviewing",
  archived: "archived",
  declined: "declined",
} as const;
export type DossierStatus = (typeof DossierStatus)[keyof typeof DossierStatus];

export const RunKind = {
  company_brief: "company_brief",
  people_scan: "people_scan",
  dossier_refresh: "dossier_refresh",
} as const;
export type RunKind = (typeof RunKind)[keyof typeof RunKind];

export const RunStatus = {
  queued: "queued",
  running: "running",
  completed: "completed",
  partial_failed: "partial_failed",
  failed: "failed",
  cancelled: "cancelled",
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export const SourceType = {
  company_site: "company_site",
  news_article: "news_article",
  public_profile: "public_profile",
  github_profile: "github_profile",
  review_site: "review_site",
  salary_site: "salary_site",
  job_metadata: "job_metadata",
  manual_note: "manual_note",
  other_web_page: "other_web_page",
} as const;
export type SourceType = (typeof SourceType)[keyof typeof SourceType];

/** Source artifact review states (the richer review classification). */
export const ReviewState = {
  unreviewed: "unreviewed",
  verified: "verified",
  low_confidence: "low_confidence",
  outdated: "outdated",
  rejected: "rejected",
} as const;
export type ReviewState = (typeof ReviewState)[keyof typeof ReviewState];

export const PersonType = {
  recruiter: "recruiter",
  hiring_manager: "hiring_manager",
  interviewer: "interviewer",
  executive: "executive",
  founder: "founder",
  employee: "employee",
} as const;
export type PersonType = (typeof PersonType)[keyof typeof PersonType];

export const PayInterval = {
  annual: "annual",
  monthly: "monthly",
  hourly: "hourly",
  unknown: "unknown",
} as const;
export type PayInterval = (typeof PayInterval)[keyof typeof PayInterval];

export const SummaryType = {
  company_brief: "company_brief",
  people_brief: "people_brief",
  interview_angles: "interview_angles",
} as const;
export type SummaryType = (typeof SummaryType)[keyof typeof SummaryType];

export const TimelineEventType = {
  dossier_created: "dossier_created",
  job_linked: "job_linked",
  run_started: "run_started",
  run_completed: "run_completed",
  run_partial_failed: "run_partial_failed",
  run_failed: "run_failed",
  source_saved: "source_saved",
  source_reviewed: "source_reviewed",
  person_saved: "person_saved",
  salary_saved: "salary_saved",
  summary_saved: "summary_saved",
  status_changed: "status_changed",
  dossier_merged: "dossier_merged",
} as const;
export type TimelineEventType =
  (typeof TimelineEventType)[keyof typeof TimelineEventType];

export const ConfidenceLabel = {
  high: "high",
  medium: "medium",
  low: "low",
  unknown: "unknown",
} as const;
export type ConfidenceLabel =
  (typeof ConfidenceLabel)[keyof typeof ConfidenceLabel];

export const LinkReason = {
  seeded: "seeded",
  manual: "manual",
  suggested: "suggested",
} as const;
export type LinkReason = (typeof LinkReason)[keyof typeof LinkReason];

// ---------------------------------------------------------------------------
// Summary review state (simpler two-value classification used on summaries)
// ---------------------------------------------------------------------------

export const SummaryReviewState = {
  draft: "draft",
  reviewed: "reviewed",
} as const;
export type SummaryReviewState =
  (typeof SummaryReviewState)[keyof typeof SummaryReviewState];

// ---------------------------------------------------------------------------
// Source-traceable fact / hypothesis element (spec §9.3)
// ---------------------------------------------------------------------------

export interface InvestigatorStatement {
  statement: string;
  sourceIds: string[];
}

// ---------------------------------------------------------------------------
// Domain DTOs
// ---------------------------------------------------------------------------

export interface InvestigatorDossier {
  id: string;
  tenantId: string;
  companyName: string;
  canonicalCompanyKey: string;
  companyUrl: string | null;
  normalizedDomain: string | null;
  status: DossierStatus;
  tags: string[];
  lastResearchedAt: number | null;
  createdFromJobId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Lightweight projection used in list views — no heavy nested arrays. */
export interface InvestigatorDossierListItem {
  id: string;
  tenantId: string;
  companyName: string;
  status: DossierStatus;
  tags: string[];
  lastResearchedAt: number | null;
  linkedJobCount: number;
  createdAt: string;
}

export interface InvestigatorResearchRun {
  id: string;
  tenantId: string;
  dossierId: string;
  runKind: RunKind;
  status: RunStatus;
  initiatedBy: "user" | "system";
  seedContext: Record<string, unknown> | null;
  startedAt: number | null;
  completedAt: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvestigatorSource {
  id: string;
  tenantId: string;
  dossierId: string;
  runId: string | null;
  sourceType: SourceType;
  title: string;
  url: string | null;
  sourceHost: string | null;
  capturedExcerpt: string;
  retrievedAt: number;
  reviewState: ReviewState;
  reviewerNote: string | null;
  contentHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvestigatorPerson {
  id: string;
  tenantId: string;
  dossierId: string;
  runId: string | null;
  fullName: string;
  personType: PersonType;
  title: string | null;
  profileUrl: string | null;
  roleContext: string | null;
  notes: string | null;
  confidenceLabel: ConfidenceLabel;
  sourceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InvestigatorSalaryObservation {
  id: string;
  tenantId: string;
  dossierId: string;
  runId: string | null;
  roleScope: string | null;
  geoScope: string | null;
  currency: string | null;
  payInterval: PayInterval | null;
  minAmount: number | null;
  maxAmount: number | null;
  equityText: string | null;
  bonusText: string | null;
  confidenceLabel: ConfidenceLabel;
  sourceId: string | null;
  observedAt: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvestigatorSummary {
  id: string;
  tenantId: string;
  dossierId: string;
  runId: string | null;
  summaryType: SummaryType;
  title: string;
  bodyMarkdown: string;
  factsJson: InvestigatorStatement[];
  hypothesesJson: InvestigatorStatement[];
  reviewState: SummaryReviewState;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvestigatorTimelineEvent {
  id: string;
  tenantId: string;
  dossierId: string;
  runId: string | null;
  eventType: TimelineEventType;
  payload: Record<string, unknown>;
  occurredAt: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Request / filter input types
// ---------------------------------------------------------------------------

export interface CreateInvestigatorDossierInput {
  companyName: string;
  companyUrl?: string | null;
  sourceJobId?: string | null;
  status?: DossierStatus;
  tags?: string[];
}

export interface UpdateInvestigatorDossierInput {
  companyName?: string;
  companyUrl?: string | null;
  status?: DossierStatus;
  tags?: string[];
}

export interface StartInvestigatorRunInput {
  runKind: RunKind;
  seedContext?: Record<string, unknown> | null;
}

export interface InvestigatorDossierListFilters {
  q?: string;
  status?: DossierStatus;
  tag?: string;
  linkedJobId?: string;
  hasPeople?: boolean;
  stale?: boolean;
  sort?: string;
}

export interface CreateInvestigatorSourceInput {
  runId?: string | null;
  sourceType: SourceType;
  title: string;
  url?: string | null;
  capturedExcerpt: string;
  retrievedAt: number;
  reviewState?: ReviewState;
  reviewerNote?: string | null;
}

export interface CreateInvestigatorPersonInput {
  runId?: string | null;
  fullName: string;
  personType: PersonType;
  title?: string | null;
  profileUrl?: string | null;
  roleContext?: string | null;
  notes?: string | null;
  confidenceLabel: ConfidenceLabel;
  sourceIds?: string[];
}

export interface CreateInvestigatorSalaryObservationInput {
  runId?: string | null;
  roleScope?: string | null;
  geoScope?: string | null;
  currency?: string | null;
  payInterval?: PayInterval | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  equityText?: string | null;
  bonusText?: string | null;
  confidenceLabel: ConfidenceLabel;
  sourceId?: string | null;
  observedAt?: number | null;
  notes?: string | null;
}

export interface RegenerateInvestigatorSummaryInput {
  summaryType: SummaryType;
  runId?: string | null;
}

// ---------------------------------------------------------------------------
// Zod validation schemas for Create / Update inputs
// ---------------------------------------------------------------------------

const dossierStatusValues = Object.values(DossierStatus) as [
  string,
  ...string[],
];
const runKindValues = Object.values(RunKind) as [string, ...string[]];
const sourceTypeValues = Object.values(SourceType) as [string, ...string[]];
const reviewStateValues = Object.values(ReviewState) as [string, ...string[]];
const personTypeValues = Object.values(PersonType) as [string, ...string[]];
const payIntervalValues = Object.values(PayInterval) as [string, ...string[]];
const summaryTypeValues = Object.values(SummaryType) as [string, ...string[]];
const confidenceLabelValues = Object.values(ConfidenceLabel) as [
  string,
  ...string[],
];

export const CreateInvestigatorDossierInputSchema = z
  .object({
    companyName: z.string().min(1),
    companyUrl: z.string().url().nullish(),
    sourceJobId: z.string().nullish(),
    status: z
      .enum(dossierStatusValues as [DossierStatus, ...DossierStatus[]])
      .optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict();

export const UpdateInvestigatorDossierInputSchema = z
  .object({
    companyName: z.string().min(1).optional(),
    companyUrl: z.string().url().nullish(),
    status: z
      .enum(dossierStatusValues as [DossierStatus, ...DossierStatus[]])
      .optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict();

export const StartInvestigatorRunInputSchema = z
  .object({
    runKind: z.enum(runKindValues as [RunKind, ...RunKind[]]),
    seedContext: z.record(z.unknown()).nullish(),
  })
  .strict();

export const CreateInvestigatorSourceInputSchema = z
  .object({
    runId: z.string().nullish(),
    sourceType: z.enum(sourceTypeValues as [SourceType, ...SourceType[]]),
    title: z.string().min(1),
    url: z.string().url().nullish(),
    capturedExcerpt: z.string().min(1),
    retrievedAt: z.number().int(),
    reviewState: z
      .enum(reviewStateValues as [ReviewState, ...ReviewState[]])
      .optional(),
    reviewerNote: z.string().nullish(),
  })
  .strict();

export const CreateInvestigatorPersonInputSchema = z
  .object({
    runId: z.string().nullish(),
    fullName: z.string().min(1),
    personType: z.enum(personTypeValues as [PersonType, ...PersonType[]]),
    title: z.string().nullish(),
    profileUrl: z.string().url().nullish(),
    roleContext: z.string().nullish(),
    notes: z.string().nullish(),
    confidenceLabel: z.enum(
      confidenceLabelValues as [ConfidenceLabel, ...ConfidenceLabel[]],
    ),
    sourceIds: z.array(z.string()).optional(),
  })
  .strict();

export const CreateInvestigatorSalaryObservationInputSchema = z
  .object({
    runId: z.string().nullish(),
    roleScope: z.string().nullish(),
    geoScope: z.string().nullish(),
    currency: z.string().nullish(),
    payInterval: z
      .enum(payIntervalValues as [PayInterval, ...PayInterval[]])
      .nullish(),
    minAmount: z.number().nullish(),
    maxAmount: z.number().nullish(),
    equityText: z.string().nullish(),
    bonusText: z.string().nullish(),
    confidenceLabel: z.enum(
      confidenceLabelValues as [ConfidenceLabel, ...ConfidenceLabel[]],
    ),
    sourceId: z.string().nullish(),
    observedAt: z.number().int().nullish(),
    notes: z.string().nullish(),
  })
  .strict();

export const RegenerateInvestigatorSummaryInputSchema = z
  .object({
    summaryType: z.enum(summaryTypeValues as [SummaryType, ...SummaryType[]]),
    runId: z.string().nullish(),
  })
  .strict();

export interface UpdateInvestigatorSourceInput {
  sourceType?: SourceType;
  title?: string;
  url?: string | null;
  capturedExcerpt?: string;
  retrievedAt?: number;
  reviewState?: ReviewState;
  reviewerNote?: string | null;
}

export const UpdateInvestigatorSourceInputSchema = z
  .object({
    sourceType: z
      .enum(sourceTypeValues as [SourceType, ...SourceType[]])
      .optional(),
    title: z.string().min(1).optional(),
    url: z.string().url().nullish(),
    capturedExcerpt: z.string().min(1).optional(),
    retrievedAt: z.number().int().optional(),
    reviewState: z
      .enum(reviewStateValues as [ReviewState, ...ReviewState[]])
      .optional(),
    reviewerNote: z.string().nullish(),
  })
  .strict();

export interface UpdateInvestigatorPersonInput {
  fullName?: string;
  personType?: PersonType;
  title?: string | null;
  profileUrl?: string | null;
  roleContext?: string | null;
  notes?: string | null;
  confidenceLabel?: ConfidenceLabel;
  sourceIds?: string[];
}

export const UpdateInvestigatorPersonInputSchema = z
  .object({
    fullName: z.string().min(1).optional(),
    personType: z
      .enum(personTypeValues as [PersonType, ...PersonType[]])
      .optional(),
    title: z.string().nullish(),
    profileUrl: z
      .string()
      .url()
      .describe("public professional profile only")
      .nullish(),
    roleContext: z.string().nullish(),
    notes: z.string().nullish(),
    confidenceLabel: z
      .enum(confidenceLabelValues as [ConfidenceLabel, ...ConfidenceLabel[]])
      .optional(),
    sourceIds: z.array(z.string()).optional(),
  })
  .strict();
