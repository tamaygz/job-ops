import { investigatorRunKindLabels } from "@client/components/investigator/runMetadata";
import { useCancelRun } from "@client/hooks/queries/useInvestigatorMutations";
import { showErrorToast } from "@client/lib/error-toast";
import type { InvestigatorResearchRun } from "@shared/types";
import { XCircle } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const activeRunStatuses = new Set(["queued", "running"]);

const RunRow: React.FC<{
  run: InvestigatorResearchRun;
  dossierId: string;
}> = ({ run, dossierId }) => {
  const cancelMutation = useCancelRun();
  const isActive = activeRunStatuses.has(run.status);

  const statusColor =
    {
      queued: "text-blue-400",
      running: "text-amber-400",
      completed: "text-emerald-400",
      partial_failed: "text-orange-400",
      failed: "text-rose-400",
      cancelled: "text-zinc-400",
    }[run.status] ?? "text-muted-foreground";

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync({ dossierId, runId: run.id });
    } catch (err) {
      showErrorToast(err, "Failed to cancel run");
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium">
          {investigatorRunKindLabels[run.runKind] ?? run.runKind}
        </span>
        <div className="mt-0.5 flex items-center gap-2">
          <span className={cn("text-xs font-medium capitalize", statusColor)}>
            {run.status.replace(/_/g, " ")}
          </span>
          {run.errorMessage && (
            <span className="truncate text-xs text-rose-400">
              — {run.errorMessage}
            </span>
          )}
        </div>
      </div>
      {isActive && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={handleCancel}
          disabled={cancelMutation.isPending}
        >
          <XCircle className="h-3.5 w-3.5" />
          Cancel
        </Button>
      )}
    </div>
  );
};

interface RunHistorySectionProps {
  dossierId: string;
  runs: InvestigatorResearchRun[] | undefined;
  runsLoading: boolean;
}

export const RunHistorySection: React.FC<RunHistorySectionProps> = ({
  dossierId,
  runs,
  runsLoading,
}) => {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Research runs
      </h2>
      {runsLoading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-12 rounded-lg bg-muted/40" />
          <div className="h-12 rounded-lg bg-muted/40" />
        </div>
      ) : runs && runs.length > 0 ? (
        runs.map((run) => (
          <RunRow key={run.id} run={run} dossierId={dossierId} />
        ))
      ) : (
        <p className="text-sm text-muted-foreground">
          No research runs yet. Click "Start Research" to begin.
        </p>
      )}
    </div>
  );
};