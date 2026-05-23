import * as investigatorApi from "@client/api/investigator";
import {
  useCreateSource,
  useDeleteSource,
} from "@client/hooks/queries/useInvestigatorMutations";
import { useSources } from "@client/hooks/queries/useInvestigatorQueries";
import { showErrorToast } from "@client/lib/error-toast";
import type {
  CreateInvestigatorSourceInput,
  InvestigatorSource,
  ReviewState,
  SourceType,
  UpdateInvestigatorSourceInput,
} from "@shared/types";
import { SourceType as SourceTypeValues } from "@shared/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { queryKeys } from "@/client/lib/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EmptyState } from "../layout";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REVIEW_STATE_CONFIG: Record<
  ReviewState,
  { label: string; className: string }
> = {
  unreviewed: {
    label: "Unreviewed",
    className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
  },
  verified: {
    label: "Verified",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  low_confidence: {
    label: "Low confidence",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  outdated: {
    label: "Outdated",
    className: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  },
  rejected: {
    label: "Rejected",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  },
};

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  company_site: "Company site",
  news_article: "News",
  public_profile: "Public profile",
  github_profile: "GitHub",
  review_site: "Review site",
  salary_site: "Salary site",
  job_metadata: "Job metadata",
  manual_note: "Manual note",
  other_web_page: "Web page",
};

const REVIEW_STATE_ORDER: ReviewState[] = [
  "unreviewed",
  "verified",
  "low_confidence",
  "outdated",
  "rejected",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(text: string, max: number): [string, boolean] {
  if (text.length <= max) return [text, false];
  return [text.slice(0, max), true];
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Optimistic update source mutation hook
// ---------------------------------------------------------------------------

function useOptimisticUpdateSource(dossierId: string) {
  const queryClient = useQueryClient();
  const sourcesKey = queryKeys.investigator.sources(dossierId);

  return useMutation({
    mutationFn: ({
      sourceId,
      data,
    }: {
      sourceId: string;
      data: UpdateInvestigatorSourceInput;
    }) => investigatorApi.updateSource(dossierId, sourceId, data),
    onMutate: async ({ sourceId, data }) => {
      await queryClient.cancelQueries({ queryKey: sourcesKey });
      const previous =
        queryClient.getQueryData<InvestigatorSource[]>(sourcesKey);
      queryClient.setQueryData<InvestigatorSource[]>(sourcesKey, (old) =>
        old ? old.map((s) => (s.id === sourceId ? { ...s, ...data } : s)) : old,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(sourcesKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: sourcesKey });
    },
  });
}

// ---------------------------------------------------------------------------
// Debounce hook
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ---------------------------------------------------------------------------
// Source card
// ---------------------------------------------------------------------------

interface SourceCardProps {
  source: InvestigatorSource;
  dossierId: string;
}

const SourceCard: React.FC<SourceCardProps> = ({ source, dossierId }) => {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reviewerNote, setReviewerNote] = useState(source.reviewerNote ?? "");
  const noteRef = useRef(reviewerNote);
  noteRef.current = reviewerNote;

  const updateMutation = useOptimisticUpdateSource(dossierId);
  const deleteMutation = useDeleteSource();

  const [truncated, wasTruncated] = truncate(source.capturedExcerpt, 200);
  const isVerified = source.reviewState === "verified";

  const handleReviewStateChange = (value: string) => {
    updateMutation.mutate({
      sourceId: source.id,
      data: { reviewState: value as ReviewState },
    });
  };

  // Debounced note save — 800 ms
  const debouncedNote = useDebounce(reviewerNote, 800);
  const initialNote = useRef(source.reviewerNote ?? "");
  useEffect(() => {
    if (debouncedNote === initialNote.current) return;
    updateMutation.mutate({
      sourceId: source.id,
      data: { reviewerNote: debouncedNote || null },
    });
    initialNote.current = debouncedNote;
  }, [debouncedNote, source.id, updateMutation]);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ dossierId, sourceId: source.id });
    } catch (err) {
      showErrorToast(err, "Failed to delete source");
    }
  };

  const reviewCfg =
    REVIEW_STATE_CONFIG[source.reviewState] ?? REVIEW_STATE_CONFIG.unreviewed;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 space-y-3 transition-colors",
        isVerified && "border-emerald-500/40",
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium leading-tight">
              {source.title}
            </span>
            <Badge
              variant="outline"
              className={cn("text-xs shrink-0", reviewCfg.className)}
            >
              {isVerified && "✓ "}
              {reviewCfg.label}
            </Badge>
          </div>
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              <span className="truncate max-w-xs">
                {source.sourceHost ?? source.url}
              </span>
            </a>
          )}
        </div>

        {/* Review state selector */}
        <Select
          value={source.reviewState}
          onValueChange={handleReviewStateChange}
        >
          <SelectTrigger className="h-7 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REVIEW_STATE_ORDER.map((state) => (
              <SelectItem key={state} value={state} className="text-xs">
                {REVIEW_STATE_CONFIG[state].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Delete */}
        {confirmDelete ? (
          <div className="flex items-center gap-1 text-xs">
            <Button
              variant="destructive"
              size="sm"
              className="h-7"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setConfirmDelete(false)}
            >
              Keep
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-rose-400"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Excerpt */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {expanded ? source.capturedExcerpt : truncated}
          {!expanded && wasTruncated && "…"}
        </p>
        {wasTruncated && (
          <button
            type="button"
            className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> Show more
              </>
            )}
          </button>
        )}
      </div>

      {/* Reviewer note */}
      <textarea
        rows={1}
        placeholder="Add a reviewer note…"
        value={reviewerNote}
        onChange={(e) => setReviewerNote(e.target.value)}
        className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-1.5 text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />

      {/* Footer */}
      <p className="text-xs text-muted-foreground/70">
        Captured {formatDate(source.retrievedAt)}
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Add source dialog
// ---------------------------------------------------------------------------

interface AddSourceDialogProps {
  dossierId: string;
  open: boolean;
  onClose: () => void;
}

const AddSourceDialog: React.FC<AddSourceDialogProps> = ({
  dossierId,
  open,
  onClose,
}) => {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("manual_note");
  const createMutation = useCreateSource();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !excerpt.trim()) return;
    const input: CreateInvestigatorSourceInput = {
      sourceType,
      title: title.trim(),
      url: url.trim() || null,
      capturedExcerpt: excerpt.trim(),
      retrievedAt: Math.floor(Date.now() / 1000),
    };
    try {
      await createMutation.mutateAsync({ dossierId, input });
      setTitle("");
      setUrl("");
      setExcerpt("");
      setSourceType("manual_note");
      onClose();
    } catch (err) {
      showErrorToast(err, "Failed to add source");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Manual Source</DialogTitle>
        </DialogHeader>
        <form id="add-source-form" onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="src-type">Type</Label>
              <Select
                value={sourceType}
                onValueChange={(v) => setSourceType(v as SourceType)}
              >
                <SelectTrigger id="src-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SourceTypeValues) as SourceType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {SOURCE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="src-title">Title</Label>
              <input
                id="src-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Article title or description"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="src-url">URL (optional)</Label>
              <input
                id="src-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="src-excerpt">Excerpt / notes</Label>
              <textarea
                id="src-excerpt"
                required
                rows={4}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Paste the relevant excerpt or write your notes…"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-source-form"
            disabled={
              !title.trim() || !excerpt.trim() || createMutation.isPending
            }
          >
            {createMutation.isPending ? "Adding…" : "Add source"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface SourceReviewPanelProps {
  dossierId: string;
}

export const SourceReviewPanel: React.FC<SourceReviewPanelProps> = ({
  dossierId,
}) => {
  const [addOpen, setAddOpen] = useState(false);
  const { data: sources, isLoading } = useSources(dossierId, { enabled: true });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-lg bg-muted/40" />
        ))}
      </div>
    );
  }

  if (!sources || sources.length === 0) {
    return (
      <>
        <EmptyState
          title="No sources yet"
          description="Sources are added automatically during research runs, or you can add them manually."
          action={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add manual source
            </Button>
          }
        />
        <AddSourceDialog
          dossierId={dossierId}
          open={addOpen}
          onClose={() => setAddOpen(false)}
        />
      </>
    );
  }

  // Group by sourceType
  const groups = sources.reduce<Record<string, InvestigatorSource[]>>(
    (acc, src) => {
      const key = src.sourceType;
      if (!acc[key]) acc[key] = [];
      acc[key].push(src);
      return acc;
    },
    {},
  );

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add source
        </Button>
      </div>

      <div className="space-y-6">
        {Object.entries(groups).map(([type, group]) => (
          <div key={type} className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {SOURCE_TYPE_LABELS[type as SourceType] ?? type}
              <span className="rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] font-normal normal-case tracking-normal">
                {group.length}
              </span>
            </h3>
            {group.map((src) => (
              <SourceCard key={src.id} source={src} dossierId={dossierId} />
            ))}
          </div>
        ))}
      </div>

      <AddSourceDialog
        dossierId={dossierId}
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />
    </>
  );
};
