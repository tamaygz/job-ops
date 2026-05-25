import { useTimeline } from "@client/hooks/queries/useInvestigatorQueries";
import type {
  InvestigatorTimelineEvent,
  TimelineEventType,
} from "@shared/types";
import { AlertCircle, Clock3, RefreshCw } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState } from "../layout";

const EVENT_LABELS: Record<TimelineEventType, string> = {
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
};

function formatOccurredAt(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizePayload(payload: Record<string, unknown>): string | null {
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
    .slice(0, 3)
    .map(([key, value]) => `${startCase(key)}: ${formatValue(value)}`)
    .join(" • ");
}

function startCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return "View details";
}

function getEventTone(eventType: TimelineEventType): string {
  switch (eventType) {
    case "run_failed":
      return "border-rose-500/30 bg-rose-500/5";
    case "run_partial_failed":
      return "border-orange-500/30 bg-orange-500/5";
    case "run_completed":
    case "summary_saved":
      return "border-emerald-500/30 bg-emerald-500/5";
    default:
      return "border-border bg-card";
  }
}

const TimelineRow: React.FC<{ event: InvestigatorTimelineEvent }> = ({ event }) => {
  const payloadSummary = summarizePayload(event.payload);

  return (
    <div className={cn("rounded-lg border px-4 py-3", getEventTone(event.eventType))}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">
            {EVENT_LABELS[event.eventType] ?? startCase(event.eventType)}
          </p>
          {payloadSummary ? (
            <p className="text-xs text-muted-foreground">{payloadSummary}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          <span>{formatOccurredAt(event.occurredAt)}</span>
        </div>
      </div>
    </div>
  );
};

export const TimelinePanel: React.FC<{ dossierId: string }> = ({ dossierId }) => {
  const {
    data: events,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useTimeline(dossierId, { limit: 50 }, { enabled: Boolean(dossierId) });

  if (isLoading) {
    return (
      <div className="space-y-2" data-testid="timeline-loading">
        <div className="h-16 animate-pulse rounded-lg bg-muted/40" />
        <div className="h-16 animate-pulse rounded-lg bg-muted/40" />
        <div className="h-16 animate-pulse rounded-lg bg-muted/40" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium text-rose-200">
              Timeline events could not be loaded.
            </p>
            <p className="text-xs text-muted-foreground">
              Retry to refresh the dossier activity feed.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <EmptyState
        title="No timeline events yet"
        description="Run research or save dossier findings to build an audit trail here."
      />
    );
  }

  return (
    <div className="space-y-3" data-testid="timeline-panel">
      {events.map((event) => (
        <TimelineRow key={event.id} event={event} />
      ))}
    </div>
  );
};