import { notFound } from "@infra/errors";
import { sanitizeUnknown } from "@infra/sanitize";
import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import * as sourceRepo from "@server/repositories/investigatorSourceRepository";
import * as summaryRepo from "@server/repositories/investigatorSummaryRepository";
import * as timelineRepo from "@server/repositories/investigatorTimelineRepository";
import * as settingsRepo from "@server/repositories/settings";
import {
  createConfiguredLlmService,
  resolveLlmModel,
} from "@server/services/modelSelection";
import {
  DEFAULT_INVESTIGATOR_SUMMARY_EXCERPT_MAX_CHARS,
  DEFAULT_INVESTIGATOR_SUMMARY_SOURCE_LIMIT,
  DEFAULT_INVESTIGATOR_SUMMARY_SYSTEM_PROMPT,
  settingsRegistry,
} from "@shared/settings-registry";
import type {
  InvestigatorSource,
  InvestigatorSummary,
  SummaryReviewState,
  SummaryType,
} from "@shared/types";
import type { JsonSchemaDefinition } from "../llm/types";

const SUMMARY_TITLE: Record<SummaryType, string> = {
  company_brief: "Company Brief",
  people_brief: "People Brief",
  interview_angles: "Interview Angles",
};

interface LlmSummaryResponse {
  summary: string;
  facts: string[];
  hypotheses: string[];
}

type InvestigatorSummarySettings = {
  excerptMaxChars: number;
  sourceLimit: number;
  systemPromptTemplate: string;
};

const SUMMARY_SCHEMA: JsonSchemaDefinition = {
  name: "investigator_summary",
  schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "Detailed markdown analysis" },
      facts: {
        type: "array",
        items: { type: "string" },
        description: "Verifiable factual claims",
      },
      hypotheses: {
        type: "array",
        items: { type: "string" },
        description: "Plausible inferences not stated directly in the sources",
      },
    },
    required: ["summary", "facts", "hypotheses"],
    additionalProperties: false,
  },
};

const DEFAULT_SUMMARY_SETTINGS: InvestigatorSummarySettings = {
  excerptMaxChars: DEFAULT_INVESTIGATOR_SUMMARY_EXCERPT_MAX_CHARS,
  sourceLimit: DEFAULT_INVESTIGATOR_SUMMARY_SOURCE_LIMIT,
  systemPromptTemplate: DEFAULT_INVESTIGATOR_SUMMARY_SYSTEM_PROMPT,
};

async function loadInvestigatorSummarySettings(): Promise<InvestigatorSummarySettings> {
  const [rawSystemPromptTemplate, rawSourceLimit, rawExcerptMaxChars] =
    await Promise.all([
      settingsRepo.getSetting("investigatorSummarySystemPromptTemplate"),
      settingsRepo.getSetting("investigatorSummarySourceLimit"),
      settingsRepo.getSetting("investigatorSummaryExcerptMaxChars"),
    ]);

  return {
    systemPromptTemplate:
      settingsRegistry.investigatorSummarySystemPromptTemplate.parse(
        rawSystemPromptTemplate ?? undefined,
      ) ?? DEFAULT_SUMMARY_SETTINGS.systemPromptTemplate,
    sourceLimit:
      settingsRegistry.investigatorSummarySourceLimit.parse(
        rawSourceLimit ?? undefined,
      ) ?? DEFAULT_SUMMARY_SETTINGS.sourceLimit,
    excerptMaxChars:
      settingsRegistry.investigatorSummaryExcerptMaxChars.parse(
        rawExcerptMaxChars ?? undefined,
      ) ?? DEFAULT_SUMMARY_SETTINGS.excerptMaxChars,
  };
}

export function buildSummaryPrompt(
  companyName: string,
  companyUrl: string | null,
  sources: InvestigatorSource[],
  summaryType: SummaryType,
  options: Pick<
    InvestigatorSummarySettings,
    "excerptMaxChars" | "sourceLimit"
  > = DEFAULT_SUMMARY_SETTINGS,
  researchQuestion?: string | null,
): string {
  const typeName = summaryType.replace(/_/g, " ");
  const header = `Generate a ${typeName} for ${companyName}${companyUrl ? ` (${companyUrl})` : ""}.`;
  const questionSection = researchQuestion
    ? `\n\n## Driving Research Question\n${researchQuestion}\n\nPrioritise answering this question in your analysis while still covering the general ${typeName}.`
    : "";
  const excerpts = sources
    .slice(0, options.sourceLimit)
    .map(
      (s, i) =>
        `[${i + 1}] ${s.title}: ${s.capturedExcerpt.slice(0, options.excerptMaxChars)}`,
    )
    .join("\n\n");

  return `${header}${questionSection}\n\n## Sources\n${excerpts || "No sources available."}`;
}

export async function regenerateSummary(
  dossierId: string,
  summaryType: SummaryType,
  runId?: string | null,
  researchQuestion?: string | null,
): Promise<InvestigatorSummary> {
  const dossier = await dossierRepo.findById(dossierId);
  if (!dossier) throw notFound("Dossier not found");

  const allSources = await sourceRepo.findByDossier(dossierId);
  const sources = allSources.filter(
    (s) => s.reviewState === "verified" || s.reviewState === "low_confidence",
  );
  const summarySettings = await loadInvestigatorSummarySettings();

  const existing = await summaryRepo.findLatest(dossierId, summaryType);
  const version = (existing?.version ?? 0) + 1;

  const prompt = buildSummaryPrompt(
    dossier.companyName,
    dossier.companyUrl,
    sources,
    summaryType,
    summarySettings,
    researchQuestion,
  );

  let bodyMarkdown = "(Generation failed)";
  let factsJson: { statement: string; sourceIds: string[] }[] = [];
  let hypothesesJson: { statement: string; sourceIds: string[] }[] = [];
  let generationFailed = false;

  try {
    const [model, llm] = await Promise.all([
      resolveLlmModel("default"),
      createConfiguredLlmService("default"),
    ]);

    const result = await llm.callJson<LlmSummaryResponse>({
      model,
      messages: [
        { role: "system", content: summarySettings.systemPromptTemplate },
        { role: "user", content: prompt },
      ],
      jsonSchema: SUMMARY_SCHEMA,
      maxRetries: 1,
    });

    if (result.success && result.data) {
      const sanitized = sanitizeUnknown(result.data) as Record<string, unknown>;
      const summaryText =
        typeof sanitized.summary === "string" ? sanitized.summary : "";
      const facts = Array.isArray(sanitized.facts) ? sanitized.facts : [];
      const hypotheses = Array.isArray(sanitized.hypotheses)
        ? sanitized.hypotheses
        : [];

      bodyMarkdown = summaryText || "(Generation failed)";
      generationFailed = !summaryText;
      factsJson = (facts as string[])
        .filter((f) => typeof f === "string")
        .map((f) => ({ statement: f, sourceIds: [] }));
      hypothesesJson = (hypotheses as string[])
        .filter((h) => typeof h === "string")
        .map((h) => ({ statement: h, sourceIds: [] }));
    } else {
      generationFailed = true;
    }
  } catch {
    generationFailed = true;
  }

  const summary = await summaryRepo.create({
    dossierId,
    runId: runId ?? null,
    summaryType,
    title: SUMMARY_TITLE[summaryType],
    bodyMarkdown,
    factsJson,
    hypothesesJson,
    version,
  });

  await timelineRepo.insertEvent({
    dossierId,
    runId: runId ?? null,
    eventType: "summary_saved",
    payload: { summaryId: summary.id, generationFailed },
    occurredAt: Math.floor(Date.now() / 1000),
  });

  return summary;
}

export async function editSummary(
  summaryId: string,
  data: { bodyMarkdown?: string; reviewState?: SummaryReviewState },
): Promise<InvestigatorSummary> {
  const existing = await summaryRepo.findById(summaryId);
  if (!existing) throw notFound("Summary not found");

  const updated = await summaryRepo.update(summaryId, {
    ...data,
    version: existing.version + 1,
  });
  if (!updated) throw notFound("Summary not found after update");

  await timelineRepo.insertEvent({
    dossierId: existing.dossierId,
    runId: null,
    eventType: "summary_saved",
    payload: { summaryId, editedByUser: true },
    occurredAt: Math.floor(Date.now() / 1000),
  });

  return updated;
}

export async function listSummaries(
  dossierId: string,
): Promise<InvestigatorSummary[]> {
  const dossier = await dossierRepo.findById(dossierId);
  if (!dossier) throw notFound("Dossier not found");
  return summaryRepo.findByDossier(dossierId);
}

export async function getSummaryById(
  summaryId: string,
  dossierId: string,
): Promise<InvestigatorSummary | null> {
  const s = await summaryRepo.findById(summaryId);
  if (!s || s.dossierId !== dossierId) return null;
  return s;
}
