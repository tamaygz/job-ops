import { JobDescriptionMarkdown } from "@client/components/JobDescriptionMarkdown";
import {
  useEditSummary,
  useRegenerateSummary,
} from "@client/hooks/queries/useInvestigatorMutations";
import {
  useLinkedJobs,
  useSummaries,
} from "@client/hooks/queries/useInvestigatorQueries";
import { useCreateJobNoteMutation } from "@client/hooks/queries/useJobMutations";
import { showErrorToast } from "@client/lib/error-toast";
import type {
  InvestigatorLinkedJob,
  InvestigatorStatement,
  InvestigatorSummary,
  SummaryType,
} from "@shared/types";
import {
  BookmarkPlus,
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
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  linkedJobs: InvestigatorLinkedJob[];
  sourceJobId?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  dossierId,
  summaryType,
  summary,
  linkedJobs,
  sourceJobId,
}) => {
  const [editing, setEditing] = useState(false);
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [promoJobId, setPromoJobId] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const config = SUMMARY_TYPE_CONFIG[summaryType];

  const regenerateMutation = useRegenerateSummary();
  const editMutation = useEditSummary();
  const createNoteMutation = useCreateJobNoteMutation();

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

  const handleSelectionChange = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !containerRef.current) return;
    if (containerRef.current.contains(sel.anchorNode)) {
      const text = sel.toString().trim();
      if (text) setSelectedText(text);
    }
  };

  const handleOpenPromoDialog = () => {
    const defaultJobId =
      sourceJobId && linkedJobs.some((j) => j.jobId === sourceJobId)
        ? sourceJobId
        : (linkedJobs[0]?.jobId ?? "");
    setPromoJobId(defaultJobId);
    setPromoDialogOpen(true);
  };

  const handlePromote = async () => {
    if (!selectedText || !promoJobId) return;
    try {
      await createNoteMutation.mutateAsync({
        jobId: promoJobId,
        input: {
          title: "Promoted from Investigator",
          content: `---\n${selectedText}`,
        },
      });
      setPromoDialogOpen(false);
      setSelectedText("");
      window.getSelection()?.removeAllRanges();
    } catch (err) {
      showErrorToast(err, "Failed to promote to job notes");
    }
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
          {summary && !editing && linkedJobs.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={handleOpenPromoDialog}
              disabled={!selectedText}
              title={
                selectedText
                  ? "Promote selected text to job notes"
                  : "Select text to promote to job notes"
              }
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              Promote
            </Button>
          )}
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
          {/* biome-ignore lint/a11y/noStaticElementInteractions: selection detection only, no keyboard interaction intended */}
          <div
            ref={containerRef}
            className="prose dark:prose-invert prose-sm max-w-none text-foreground"
            onMouseUp={handleSelectionChange}
            onKeyUp={handleSelectionChange}
          >
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

      {/* Promote to job notes dialog */}
      <Dialog open={promoDialogOpen} onOpenChange={setPromoDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Promote to Job Notes</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Append the selected text as a new note.
            </p>
            {linkedJobs.length > 1 && (
              <Select value={promoJobId} onValueChange={setPromoJobId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a job" />
                </SelectTrigger>
                <SelectContent>
                  {linkedJobs.map((j) => (
                    <SelectItem key={j.jobId} value={j.jobId}>
                      {j.title} — {j.employer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {linkedJobs.length === 1 && (
              <p className="text-sm font-medium">
                {linkedJobs[0].title} — {linkedJobs[0].employer}
              </p>
            )}
            <blockquote className="border-l-2 pl-3 text-xs text-muted-foreground italic line-clamp-4">
              {selectedText}
            </blockquote>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPromoDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handlePromote()}
              disabled={createNoteMutation.isPending || !promoJobId}
            >
              {createNoteMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" />
              )}
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface SummaryPanelProps {
  dossierId: string;
  sourceJobId?: string;
}

export const SummaryPanel: React.FC<SummaryPanelProps> = ({
  dossierId,
  sourceJobId,
}) => {
  const { data: summaries, isLoading } = useSummaries(
    dossierId,
    { latestOnly: true },
    { enabled: true },
  );
  const { data: linkedJobs = [] } = useLinkedJobs(dossierId);

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
          linkedJobs={linkedJobs}
          sourceJobId={sourceJobId}
        />
      ))}
    </div>
  );
};
