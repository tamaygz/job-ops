import type {
  InvestigatorTimelineEvent,
  TimelineEventType,
} from "@shared/types";

export const EVENT_LABELS: Record<TimelineEventType, string> = {
  dossier_created: "Dossier created",
  job_linked: "Job linked",
  run_started: "Research run started",
  run_completed: "Research run completed",
  run_partial_failed: "Research run partially failed",
  run_failed: "Research run failed",
  source_saved: "Source saved",
  source_reviewed: "Source reviewed",
  person_saved: "Person saved",
  salary_saved: "Salary observation saved",
  summary_saved: "Summary saved",
  status_changed: "Status changed",
  dossier_merged: "Dossier merged",
  url_fetched: "URL fetched",
  search_queried: "Search queried",
};

function startCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

function formatProviderOutcome(item: Record<string, unknown>): string {
  const name =
    typeof item.name === "string" ? item.name : String(item.id ?? "");
  const status = typeof item.status === "string" ? item.status : "";
  const count = typeof item.resultCount === "number" ? item.resultCount : 0;
  if (status === "success") return `${name} ✓ (${count})`;
  if (status === "skipped") return `${name} skipped`;
  return `${name} ✗`;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (
      value.length > 0 &&
      typeof value[0] === "object" &&
      value[0] !== null &&
      ("id" in value[0] || "name" in value[0]) &&
      "status" in value[0] &&
      "resultCount" in value[0]
    ) {
      return value
        .map((item) => formatProviderOutcome(item as Record<string, unknown>))
        .join(", ");
    }
    return value.join(", ");
  }
  return "View details";
}

export function formatTimelineEventLabel(eventType: TimelineEventType): string {
  return EVENT_LABELS[eventType] ?? startCase(eventType);
}

export function formatTimelineOccurredAt(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function summarizeTimelinePayload(
  payload: Record<string, unknown>,
  maxEntries = 4,
): string | null {
  const entries = Object.entries(payload).filter(([, value]) => {
    if (value === null || value === undefined) {
      return false;
    }
    return !(typeof value === "string" && value.trim().length === 0);
  });

  if (entries.length === 0) {
    return null;
  }

  return entries
    .slice(0, maxEntries)
    .map(([key, value]) => `${startCase(key)}: ${formatValue(value)}`)
    .join(" • ");
}

export function compareTimelineEventsAscending(
  left: InvestigatorTimelineEvent,
  right: InvestigatorTimelineEvent,
): number {
  return left.occurredAt - right.occurredAt;
}
