import { JobDescriptionMarkdown } from "@client/components/JobDescriptionMarkdown";
import {
  useEditSummary,
  useRegenerateSummary,
} from "@client/hooks/queries/useInvestigatorMutations";
import { useSummaries } from "@client/hooks/queries/useInvestigatorQueries";
import { showErrorToast } from "@client/lib/error-toast";
import type {
  InvestigatorStatement,
  InvestigatorSummary,
  SummaryType,
} from "@shared/types";
import {
  Check,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Loader2,
  Pencil,
  RefreshCw,
  X,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const SUMMARY_TYPE_ORDER: SummaryType[] = [
  "company_brief",
  "people_brief",
  "interview_angles",
];

const SUMMARY_TYPE_CONFIG: Record<SummaryType, { label: string }> = {
  company_brief: { label: "Company Brief" },
  people_brief: { label: "People Brief" },
  interview_angles: { label: "Interview Prep & Questions" },
};

function formatDate(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface StatementListProps {
  items: InvestigatorStatement[];
  icon: "check" | "help";
  label: string;
}

const StatementList: React.FC<StatementListProps> = ({
  items,
  icon,
  label,
}) => {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {label} ({items.length})
      </button>
      {expanded && (
        <ul className="mt-2 space-y-1.5">
          {items.map((item) => (
            <li
              key={item.statement}
              className={
                icon === "check"
                  ? "flex gap-2 text-sm text-foreground"
                  : "flex gap-2 text-sm text-muted-foreground italic"
              }
            >
              {icon === "check" ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              )}
              <span>{item.statement}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface SummaryCardProps {
  dossierId: string;
  summaryType: SummaryType;
  summary: InvestigatorSummary | undefined;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  dossierId,
  summaryType,
  summary,
}) => {
  const [editing, setEditing] = useState(false);
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const config = SUMMARY_TYPE_CONFIG[summaryType];

  const regenerateMutation = useRegenerateSummary();
  const editMutation = useEditSummary();

  const handleRegenerate = async () => {
    try {
      await regenerateMutation.mutateAsync({
        dossierId,
        input: { summaryType, runId: null },
      });
    } catch (err) {
      showErrorToast(err, "Failed to regenerate summary");
    }
  };

  const handleEditStart = () => {
    setDraftMarkdown(summary?.bodyMarkdown ?? "");
    setEditing(true);
  };

  const handleEditSave = async () => {
    if (!summary) return;
    try {
      await editMutation.mutateAsync({
        dossierId,
        summaryId: summary.id,
        data: { bodyMarkdown: draftMarkdown },
      });
      setEditing(false);
    } catch (err) {
      showErrorToast(err, "Failed to save summary");
    }
  };

  const handleEditCancel = () => {
    setEditing(false);
    setDraftMarkdown("");
  };

  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold leading-tight">
          {config.label}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          {summary && !editing && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={handleEditStart}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => void handleRegenerate()}
            disabled={regenerateMutation.isPending}
          >
            {regenerateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {regenerateMutation.isPending ? "Generating…" : "Regenerate"}
          </Button>
        </div>
      </div>

      {!summary ? (
        <p className="text-sm text-muted-foreground">
          No summary yet — click Regenerate to generate one.
        </p>
      ) : editing ? (
        <div className="space-y-2">
          <textarea
            rows={12}
            value={draftMarkdown}
            onChange={(e) => setDraftMarkdown(e.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
          />
          <div className="flex items-center gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5"
              onClick={handleEditCancel}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7"
              onClick={() => void handleEditSave()}
              disabled={editMutation.isPending}
            >
              {editMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="prose dark:prose-invert prose-sm max-w-none text-foreground">
            <JobDescriptionMarkdown description={summary.bodyMarkdown} />
          </div>
          <StatementList
            items={summary.factsJson}
            icon="check"
            label="Key Facts"
          />
          <StatementList
            items={summary.hypothesesJson}
            icon="help"
            label="Hypotheses"
          />
        </>
      )}

      {summary && (
        <div className="pt-2 flex items-center gap-3 border-t text-xs text-muted-foreground">
          <span>v{summary.version}</span>
          <span>Last updated {formatDate(summary.updatedAt)}</span>
        </div>
      )}
    </div>
  );
};

interface SummaryPanelProps {
  dossierId: string;
}

export const SummaryPanel: React.FC<SummaryPanelProps> = ({ dossierId }) => {
  const { data: summaries, isLoading } = useSummaries(
    dossierId,
    { latestOnly: true },
    { enabled: true },
  );

  const summaryByType = new Map<SummaryType, InvestigatorSummary>();
  for (const s of summaries ?? []) {
    summaryByType.set(s.summaryType, s);
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-48 rounded-xl bg-muted/40" />
        <div className="h-48 rounded-xl bg-muted/40" />
        <div className="h-48 rounded-xl bg-muted/40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {SUMMARY_TYPE_ORDER.map((summaryType) => (
        <SummaryCard
          key={summaryType}
          dossierId={dossierId}
          summaryType={summaryType}
          summary={summaryByType.get(summaryType)}
        />
      ))}
    </div>
  );
};
