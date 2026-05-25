import type { Logger } from "@infra/logger";
import type {
  InvestigatorDossier,
  RunKind,
} from "@shared/types";
import type { RunProgressEvent } from "../runProgress";
import type { InvestigatorGatherSettings } from "./settings";

export type InvestigatorPhase = "sources" | "people" | "salary" | "summary";

export type ProviderResult = {
  status: "success" | "skipped" | "failed";
  message?: string;
  createdCount?: number;
  warnings?: string[];
};

export type InvestigatorGatherContext = {
  runId: string;
  dossierId: string;
  runKind: RunKind;
  dossier: InvestigatorDossier;
  seedContext: Record<string, unknown> | null;
  settings: InvestigatorGatherSettings;
  log: Logger;
  reportProgress: (event: RunProgressEvent) => void;
};

export type InvestigatorProvider = {
  id: string;
  displayName: string;
  phase: Exclude<InvestigatorPhase, "summary">;
  requiredSettings?: Array<keyof InvestigatorGatherSettings>;
  run: (context: InvestigatorGatherContext) => Promise<ProviderResult>;
};
