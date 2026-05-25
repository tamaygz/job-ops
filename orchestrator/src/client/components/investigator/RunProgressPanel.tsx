import { useCancelRun } from "@client/hooks/queries/useInvestigatorMutations";
import { useRun, useRuns } from "@client/hooks/queries/useInvestigatorQueries";
import { showErrorToast } from "@client/lib/error-toast";
import type { InvestigatorResearchRun } from "@shared/types";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { queryKeys } from "@/client/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  activeInvestigatorRunStatuses,
  investigatorRunKindLabels,
} from "./runMetadata";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(startedAtSeconds: number | null): string {
  if (startedAtSeconds === null) return "";
  const elapsedMs = Date.now() - startedAtSeconds * 1000;
  const secs = Math.floor(elapsedMs / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

// ---------------------------------------------------------------------------
// Polling sub-component — only mounts when there is an active run
// ---------------------------------------------------------------------------

interface ActiveRunPanelProps {
  dossierId: string;
  run: InvestigatorResearchRun;
  onDismiss: () => void;
  onRetry: () => void;
}

const ActiveRunPanel: React.FC<ActiveRunPanelProps> = ({
  dossierId,
  run: initialRun,
  onDismiss,
  onRetry,
}) => {
  const [elapsed, setElapsed] = useState(() =>
    formatElapsed(initialRun.startedAt),
  );
  const [confirmCancel, setConfirmCancel] = useState(false);
  const cancelMutation = useCancelRun();
  const queryClient = useQueryClient();

  // Poll every 3 s while active
  const _isActive = activeInvestigatorRunStatuses.has(initialRun.status);
  const { data: run = initialRun } = useRun(dossierId, initialRun.id, {
    enabled: true,
  });

  // Update polling via refetchInterval — attach directly to the query
  const { refetch } = useRun(dossierId, run.id, { enabled: false });

  // Use a timer for polling while active
  useEffect(() => {
    if (!activeInvestigatorRunStatuses.has(run.status)) return;
    const interval = setInterval(() => {
      void refetch();
      setElapsed(formatElapsed(run.startedAt));
    }, 3000);
    return () => clearInterval(interval);
  }, [run.status, run.startedAt, refetch]);

  // Tick elapsed every second while running
  useEffect(() => {
    if (run.status !== "running") return;
    const tick = setInterval(
      () => setElapsed(formatElapsed(run.startedAt)),
      1000,
    );
    return () => clearInterval(tick);
  }, [run.status, run.startedAt]);

  // When run reaches a terminal state, invalidate all cached dossier data so
  // tabs (Timeline, Sources, People, Salary, Summary) show fresh results
  // without requiring a manual page reload.
  useEffect(() => {
    if (activeInvestigatorRunStatuses.has(run.status)) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.investigator.all,
    });
  }, [run.status, queryClient]);

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync({ dossierId, runId: run.id });
      setConfirmCancel(false);
    } catch (err) {
      showErrorToast(err, "Failed to cancel run");
    }
  };

  const runKindLabel = investigatorRunKindLabels[run.runKind] ?? run.runKind;

  // ---- queued / running ----
  if (run.status === "queued" || run.status === "running") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-400" />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-amber-200">
            {run.status === "queued" ? "Queued" : "Running"} — {runKindLabel}
          </span>
          {run.status === "running" && elapsed && (
            <span className="ml-2 text-xs text-muted-foreground">
              {elapsed} elapsed
            </span>
          )}
        </div>
        {confirmCancel ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Cancel run?</span>
            <Button
              variant="destructive"
              size="sm"
              className="h-7"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Yes, cancel"
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setConfirmCancel(false)}
            >
              Keep
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={() => setConfirmCancel(true)}
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancel
          </Button>
        )}
      </div>
    );
  }

  // ---- partial_failed ----
  if (run.status === "partial_failed") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium text-orange-200">
            Partial results available — {runKindLabel}
          </p>
          {run.errorMessage && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {run.errorMessage.slice(0, 200)}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 text-xs"
          onClick={onDismiss}
        >
          Dismiss
        </Button>
      </div>
    );
  }

  // ---- completed ----
  if (run.status === "completed") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
        <p className="min-w-0 flex-1 text-sm font-medium text-emerald-200">
          Research complete — view results below
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onDismiss}
        >
          Dismiss
        </Button>
      </div>
    );
  }

  // ---- failed / cancelled ----
  const isFailed = run.status === "failed";
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3",
        isFailed
          ? "border-rose-500/30 bg-rose-500/5"
          : "border-zinc-500/30 bg-zinc-500/5",
      )}
    >
      <XCircle
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          isFailed ? "text-rose-400" : "text-zinc-400",
        )}
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p
          className={cn(
            "text-sm font-medium",
            isFailed ? "text-rose-200" : "text-zinc-300",
          )}
        >
          {isFailed ? "Research failed" : "Run cancelled"} — {runKindLabel}
        </p>
        {isFailed && run.errorMessage && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {run.errorMessage.slice(0, 200)}
          </p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={onRetry}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onDismiss}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface RunProgressPanelProps {
  dossierId: string;
  /** Called when user wants to start a new run (e.g. Retry). */
  onStartRun: () => void;
}

export const RunProgressPanel: React.FC<RunProgressPanelProps> = ({
  dossierId,
  onStartRun,
}) => {
  const { data: runs } = useRuns(dossierId);
  const [dismissedRunId, setDismissedRunId] = useState<string | null>(null);

  if (!runs || runs.length === 0) return null;

  // Show the most recent run that isn't dismissed
  const run = runs[0];
  if (!run || run.id === dismissedRunId) return null;

  return (
    <ActiveRunPanel
      dossierId={dossierId}
      run={run}
      onDismiss={() => setDismissedRunId(run.id)}
      onRetry={onStartRun}
    />
  );
};
