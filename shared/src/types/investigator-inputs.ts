import { z } from "zod";
import {
  ConfidenceLabel,
  DossierStatus,
  PayInterval,
  PersonType,
  ReviewState,
  SourceType,
  SummaryType,
  RunKind,
  type ConfidenceLabel as ConfidenceLabelType,
  type DossierStatus as DossierStatusType,
  type PayInterval as PayIntervalType,
  type PersonType as PersonTypeType,
  type ReviewState as ReviewStateType,
  type RunKind as RunKindType,
  type SourceType as SourceTypeType,
  type SummaryType as SummaryTypeType,
} from "./investigator-domain";

// ---------------------------------------------------------------------------
// Request / filter input types
// ---------------------------------------------------------------------------

export interface CreateInvestigatorDossierInput {
  companyName: string;
  companyUrl?: string | null;
  sourceJobId?: string | null;
  status?: DossierStatusType;
  tags?: string[];
}

export interface UpdateInvestigatorDossierInput {
  companyName?: string;
  companyUrl?: string | null;
  status?: DossierStatusType;
  tags?: string[];
}

export interface StartInvestigatorRunInput {
  runKind: RunKindType;
  seedContext?: Record<string, unknown> | null;
}

export interface InvestigatorDossierListFilters {
  q?: string;
  status?: DossierStatusType;
  tag?: string;
  linkedJobId?: string;
  hasPeople?: boolean;
  stale?: boolean;
  sort?: string;
}

export interface CreateInvestigatorSourceInput {
  runId?: string | null;
  sourceType: SourceTypeType;
  title: string;
  url?: string | null;
  capturedExcerpt: string;
  retrievedAt: number;
  reviewState?: ReviewStateType;
  reviewerNote?: string | null;
}

export interface CreateInvestigatorPersonInput {
  runId?: string | null;
  fullName: string;
  personType: PersonTypeType;
  title?: string | null;
  profileUrl?: string | null;
  roleContext?: string | null;
  notes?: string | null;
  confidenceLabel: ConfidenceLabelType;
  sourceIds?: string[];
}

export interface CreateInvestigatorSalaryObservationInput {
  runId?: string | null;
  roleScope?: string | null;
  geoScope?: string | null;
  currency?: string | null;
  payInterval?: PayIntervalType | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  equityText?: string | null;
  bonusText?: string | null;
  confidenceLabel: ConfidenceLabelType;
  sourceId?: string | null;
  observedAt?: number | null;
  notes?: string | null;
}

export interface RegenerateInvestigatorSummaryInput {
  summaryType: SummaryTypeType;
  runId?: string | null;
}

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
      .enum(dossierStatusValues as [DossierStatusType, ...DossierStatusType[]])
      .optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict();

export const UpdateInvestigatorDossierInputSchema = z
  .object({
    companyName: z.string().min(1).optional(),
    companyUrl: z.string().url().nullish(),
    status: z
      .enum(dossierStatusValues as [DossierStatusType, ...DossierStatusType[]])
      .optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict();

export const StartInvestigatorRunInputSchema = z
  .object({
    runKind: z.enum(runKindValues as [RunKindType, ...RunKindType[]]),
    seedContext: z.record(z.unknown()).nullish(),
  })
  .strict();

export const CreateInvestigatorSourceInputSchema = z
  .object({
    runId: z.string().nullish(),
    sourceType: z.enum(sourceTypeValues as [SourceTypeType, ...SourceTypeType[]]),
    title: z.string().min(1),
    url: z.string().url().nullish(),
    capturedExcerpt: z.string().min(1),
    retrievedAt: z.number().int(),
    reviewState: z
      .enum(reviewStateValues as [ReviewStateType, ...ReviewStateType[]])
      .optional(),
    reviewerNote: z.string().nullish(),
  })
  .strict();

export const CreateInvestigatorPersonInputSchema = z
  .object({
    runId: z.string().nullish(),
    fullName: z.string().min(1),
    personType: z.enum(personTypeValues as [PersonTypeType, ...PersonTypeType[]]),
    title: z.string().nullish(),
    profileUrl: z.string().url().nullish(),
    roleContext: z.string().nullish(),
    notes: z.string().nullish(),
    confidenceLabel: z.enum(
      confidenceLabelValues as [ConfidenceLabelType, ...ConfidenceLabelType[]],
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
      .enum(payIntervalValues as [PayIntervalType, ...PayIntervalType[]])
      .nullish(),
    minAmount: z.number().nullish(),
    maxAmount: z.number().nullish(),
    equityText: z.string().nullish(),
    bonusText: z.string().nullish(),
    confidenceLabel: z.enum(
      confidenceLabelValues as [ConfidenceLabelType, ...ConfidenceLabelType[]],
    ),
    sourceId: z.string().nullish(),
    observedAt: z.number().int().nullish(),
    notes: z.string().nullish(),
  })
  .strict();

export const RegenerateInvestigatorSummaryInputSchema = z
  .object({
    summaryType: z.enum(summaryTypeValues as [SummaryTypeType, ...SummaryTypeType[]]),
    runId: z.string().nullish(),
  })
  .strict();

export interface UpdateInvestigatorSourceInput {
  sourceType?: SourceTypeType;
  title?: string;
  url?: string | null;
  capturedExcerpt?: string;
  retrievedAt?: number;
  reviewState?: ReviewStateType;
  reviewerNote?: string | null;
}

export const UpdateInvestigatorSourceInputSchema = z
  .object({
    sourceType: z
      .enum(sourceTypeValues as [SourceTypeType, ...SourceTypeType[]])
      .optional(),
    title: z.string().min(1).optional(),
    url: z.string().url().nullish(),
    capturedExcerpt: z.string().min(1).optional(),
    retrievedAt: z.number().int().optional(),
    reviewState: z
      .enum(reviewStateValues as [ReviewStateType, ...ReviewStateType[]])
      .optional(),
    reviewerNote: z.string().nullish(),
  })
  .strict();

export interface UpdateInvestigatorPersonInput {
  fullName?: string;
  personType?: PersonTypeType;
  title?: string | null;
  profileUrl?: string | null;
  roleContext?: string | null;
  notes?: string | null;
  confidenceLabel?: ConfidenceLabelType;
  sourceIds?: string[];
}

export const UpdateInvestigatorPersonInputSchema = z
  .object({
    fullName: z.string().min(1).optional(),
    personType: z
      .enum(personTypeValues as [PersonTypeType, ...PersonTypeType[]])
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
      .enum(confidenceLabelValues as [ConfidenceLabelType, ...ConfidenceLabelType[]])
      .optional(),
    sourceIds: z.array(z.string()).optional(),
  })
  .strict();

export interface UpdateInvestigatorSalaryObservationInput {
  roleScope?: string | null;
  geoScope?: string | null;
  currency?: string | null;
  payInterval?: PayIntervalType | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  equityText?: string | null;
  bonusText?: string | null;
  confidenceLabel?: ConfidenceLabelType;
  sourceId?: string | null;
  observedAt?: number | null;
  notes?: string | null;
}

export const UpdateInvestigatorSalaryObservationInputSchema = z
  .object({
    roleScope: z.string().nullish(),
    geoScope: z.string().nullish(),
    currency: z.string().nullish(),
    payInterval: z
      .enum(payIntervalValues as [PayIntervalType, ...PayIntervalType[]])
      .nullish(),
    minAmount: z.number().nullish(),
    maxAmount: z.number().nullish(),
    equityText: z.string().nullish(),
    bonusText: z.string().nullish(),
    confidenceLabel: z
      .enum(confidenceLabelValues as [ConfidenceLabelType, ...ConfidenceLabelType[]])
      .optional(),
    sourceId: z.string().nullish(),
    observedAt: z.number().int().nullish(),
    notes: z.string().nullish(),
  })
  .strict();