import {
  sectionWorkspaceItemMatchesSearch,
  type SectionWorkspaceItem,
} from "@client/components/section-workspace/SectionWorkspace";
import type { UpdateSettingsInput } from "@shared/settings-schema.js";

export type SettingsSectionId =
  | "model"
  | "chat"
  | "prompt-templates"
  | "investigator"
  | "scoring"
  | "reactive-resume"
  | "web-search"
  | "webhooks"
  | "tracer-links"
  | "logs"
  | "environment"
  | "display"
  | "typst-style"
  | "backup"
  | "danger-zone";

export type SettingsGroupId =
  | "ai"
  | "scoring"
  | "integrations"
  | "observability"
  | "workspaces"
  | "display"
  | "backups"
  | "danger";

export type SettingsSectionDescriptor = SectionWorkspaceItem & {
  id: SettingsSectionId;
};

export type SettingsNavGroup = {
  id: SettingsGroupId;
  items: SettingsSectionDescriptor[];
  label: string;
};

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    id: "ai",
    label: "AI",
    items: [
      {
        id: "model",
        label: "Models",
        description: "Provider, API credentials, and task-specific overrides.",
        searchTerms: [
          "llm",
          "provider",
          "openai",
          "glm",
          "gemini",
          "gemini_cli",
          "ollama",
          "codex",
        ],
      },
      {
        id: "chat",
        label: "Writing Style",
        description: "Tone, language, presets, and writing constraints.",
        searchTerms: ["ghostwriter", "language", "tone", "formality"],
      },
      {
        id: "prompt-templates",
        label: "Prompt Templates",
        description:
          "Base AI instructions for Ghostwriter, tailoring, and scoring.",
        searchTerms: ["prompt", "templates", "system prompt", "instructions"],
      },
      {
        id: "investigator",
        label: "Investigator",
        description: "Summary prompt defaults and evidence limits.",
        searchTerms: ["investigator", "dossier", "research", "summary"],
      },
    ],
  },
  {
    id: "scoring",
    label: "Scoring",
    items: [
      {
        id: "scoring",
        label: "Rules & Filters",
        description:
          "Salary penalties, thresholds, keywords, and scorer hints.",
        searchTerms: ["threshold", "salary", "keywords", "instructions"],
      },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    items: [
      {
        id: "reactive-resume",
        label: "Reactive Resume",
        description: "Resume sync, templates, and project selection.",
        searchTerms: ["rxresume", "resume", "projects", "template"],
      },
      {
        id: "web-search",
        label: "Web Search",
        description: "Search providers, credentials, and result tuning.",
        searchTerms: ["bing", "searxng", "brave", "search", "web"],
      },
      {
        id: "webhooks",
        label: "Webhooks",
        description: "Pipeline and job completion event destinations.",
        searchTerms: ["hooks", "notifications", "pipeline", "applied"],
      },
      {
        id: "tracer-links",
        label: "Tracer Links",
        description: "Public URL readiness and verification state.",
        searchTerms: ["public url", "verify", "readiness", "health"],
      },
    ],
  },
  {
    id: "observability",
    label: "Observability",
    items: [
      {
        id: "logs",
        label: "Logs",
        description: "Live server log output with streaming updates.",
        searchTerms: ["logs", "stdout", "console", "events", "debug"],
      },
    ],
  },
  {
    id: "workspaces",
    label: "Workspaces & Security",
    items: [
      {
        id: "environment",
        label: "Workspace Access",
        description: "Service credentials and authentication protection.",
        searchTerms: ["security", "auth", "adzuna", "ukvisajobs"],
      },
    ],
  },
  {
    id: "display",
    label: "Display",
    items: [
      {
        id: "display",
        label: "Display Preferences",
        description: "Sponsor badges and markdown rendering behavior.",
        searchTerms: ["markdown", "sponsor", "rendering", "appearance"],
      },
      {
        id: "typst-style",
        label: "Typst Theme Style",
        description:
          "Override fonts and colors for Typst-rendered PDF resumes.",
        searchTerms: [
          "typst",
          "font",
          "color",
          "typography",
          "primary",
          "text",
          "background",
          "heading",
          "body",
        ],
      },
    ],
  },
  {
    id: "backups",
    label: "Backups",
    items: [
      {
        id: "backup",
        label: "Backups",
        description: "Automatic schedules, retention, and manual snapshots.",
        searchTerms: ["recovery", "database", "restore", "schedule"],
      },
    ],
  },
  {
    id: "danger",
    label: "Danger Zone",
    items: [
      {
        id: "danger-zone",
        label: "Danger Zone",
        description: "Delete jobs, runs, or the full local database.",
        searchTerms: ["delete", "clear", "cleanup", "destructive"],
      },
    ],
  },
];

export const SECTION_FIELD_MAP: Record<
  SettingsSectionId,
  Array<keyof UpdateSettingsInput>
> = {
  model: [
    "llmProvider",
    "llmBaseUrl",
    "llmApiKey",
    "llmPurposeOverrides",
    "llmPurposeApiKeys",
    "model",
    "modelScorer",
    "modelTailoring",
    "modelProjectSelection",
  ],
  chat: [
    "chatStyleTone",
    "chatStyleFormality",
    "chatStyleConstraints",
    "chatStyleDoNotUse",
    "ghostwriterStopSlopEnabled",
    "chatStyleLanguageMode",
    "chatStyleManualLanguage",
  ],
  "prompt-templates": [
    "ghostwriterSystemPromptTemplate",
    "tailoringPromptTemplate",
    "scoringPromptTemplate",
  ],
  investigator: [
    "investigatorSummarySystemPromptTemplate",
    "investigatorSummarySourceLimit",
    "investigatorSummaryExcerptMaxChars",
  ],
  scoring: [
    "penalizeMissingSalary",
    "missingSalaryPenalty",
    "autoSkipScoreThreshold",
    "blockedCompanyKeywords",
    "scoringInstructions",
  ],
  "reactive-resume": [
    "pdfRenderer",
    "rxresumeBaseResumeId",
    "rxresumeApiKey",
    "rxresumeUrl",
    "resumeProjects",
  ],
  "web-search": [
    "webSearchProviders",
    "webSearchResultLimit",
    "webSearchMarket",
    "webSearchBingEndpoint",
    "webSearchSearxngBaseUrl",
    "webSearchBingApiKey",
    "webSearchSearxngApiKey",
    "webSearchBraveApiKey",
  ],
  webhooks: ["pipelineWebhookUrl", "jobCompleteWebhookUrl", "webhookSecret"],
  "tracer-links": [],
  logs: [],
  environment: [
    "ukvisajobsEmail",
    "ukvisajobsPassword",
    "adzunaAppId",
    "adzunaAppKey",
  ],
  display: ["showSponsorInfo", "renderMarkdownInJobDescriptions"],
  "typst-style": [
    "typstBodyFont",
    "typstHeadingFont",
    "typstPrimaryColor",
    "typstTextColor",
    "typstBackgroundColor",
    "typstSecondaryBackgroundColor",
  ],
  backup: ["backupEnabled", "backupHour", "backupMaxCount"],
  "danger-zone": [],
};

export function matchesSettingsSearch(
  searchTerm: string,
  item: SettingsSectionDescriptor,
): boolean {
  return sectionWorkspaceItemMatchesSearch(searchTerm, item);
}

export function getAllSettingsSectionIds(): SettingsSectionId[] {
  return SETTINGS_NAV_GROUPS.flatMap((group) =>
    group.items.map((item) => item.id),
  );
}

export function findSettingsSectionDescriptor(
  sectionId: SettingsSectionId,
): SettingsSectionDescriptor | undefined {
  return SETTINGS_NAV_GROUPS.flatMap((group) => group.items).find(
    (item) => item.id === sectionId,
  );
}

export function findSettingsGroupBySection(
  sectionId: SettingsSectionId,
): SettingsNavGroup | undefined {
  return SETTINGS_NAV_GROUPS.find((group) =>
    group.items.some((item) => item.id === sectionId),
  );
}