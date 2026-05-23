import { PageHeader, PageMain } from "@client/components/layout";
import {
  useCancelRun,
  useStartRun,
  useUpdateDossier,
} from "@client/hooks/queries/useInvestigatorMutations";
import {
  useDossier,
  useRuns,
  useSources,
  useSummaries,
  useTimeline,
} from "@client/hooks/queries/useInvestigatorQueries";
import { showErrorToast } from "@client/lib/error-toast";
import type {
  DossierStatus,
  InvestigatorResearchRun,
  StartInvestigatorRunInput,
  UpdateInvestigatorDossierInput,
} from "@shared/types";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ExternalLink,
  Loader2,
  Play,
  XCircle,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { dossierStatusConfig } from "./InvestigatorListPage";

// ---------------------------------------------------------------------------
// Run status helpers
// ---------------------------------------------------------------------------

const RUN_KIND_LABELS: Record<string, string> = {
  company_brief: "Company Brief",
  people_scan: "People Scan",
  dossier_refresh: "Dossier Refresh",
};

const activeRunStatuses = new Set(["queued", "running"]);

// ---------------------------------------------------------------------------
// Start research dialog
// ---------------------------------------------------------------------------

interface StartRunDialogProps {
  dossierId: string;
  open: boolean;
  onClose: () => void;
}

const StartRunDialog: React.FC<StartRunDialogProps> = ({
  dossierId,
  open,
  onClose,
}) => {
  const [runKind, setRunKind] = useState<string>("company_brief");
  const mutation = useStartRun();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input: StartInvestigatorRunInput = {
      runKind: runKind as StartInvestigatorRunInput["runKind"],
    };
    try {
      await mutation.mutateAsync({ dossierId, input });
      onClose();
    } catch (err) {
      showErrorToast(err, "Failed to start research run");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Start Research</DialogTitle>
        </DialogHeader>
        <form id="start-run-form" onSubmit={handleSubmit}>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="run-kind">Research type</Label>
              <Select value={runKind} onValueChange={setRunKind}>
                <SelectTrigger id="run-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RUN_KIND_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="start-run-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Edit dossier dialog
// ---------------------------------------------------------------------------

interface EditDossierDialogProps {
  dossierId: string;
  currentName: string;
  currentUrl: string | null;
  currentStatus: DossierStatus;
  currentTags: string[];
  open: boolean;
  onClose: () => void;
}

const EditDossierDialog: React.FC<EditDossierDialogProps> = ({
  dossierId,
  currentName,
  currentUrl,
  currentStatus,
  currentTags,
  open,
  onClose,
}) => {
  const [companyName, setCompanyName] = useState(currentName);
  const [companyUrl, setCompanyUrl] = useState(currentUrl ?? "");
  const [status, setStatus] = useState<DossierStatus>(currentStatus);
  const [tagsInput, setTagsInput] = useState(currentTags.join(", "));
  const mutation = useUpdateDossier();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const input: UpdateInvestigatorDossierInput = {
      companyName: companyName.trim() || undefined,
      companyUrl: companyUrl.trim() || null,
      status,
      tags,
    };
    try {
      await mutation.mutateAsync({ id: dossierId, input });
      onClose();
    } catch (err) {
      showErrorToast(err, "Failed to update dossier");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Dossier</DialogTitle>
        </DialogHeader>
        <form id="edit-dossier-form" onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-company-name">Company name</Label>
              <input
                id="edit-company-name"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-company-url">Website</Label>
              <input
                id="edit-company-url"
                type="url"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="https://"
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as DossierStatus)}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(dossierStatusConfig) as DossierStatus[]).map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {dossierStatusConfig[s].label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
              <input
                id="edit-tags"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="fintech, startup, remote"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
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
            form="edit-dossier-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Run history row
// ---------------------------------------------------------------------------

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
          {RUN_KIND_LABELS[run.runKind] ?? run.runKind}
        </span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("text-xs font-medium capitalize", statusColor)}>
            {run.status.replace(/_/g, " ")}
          </span>
          {run.errorMessage && (
            <span className="text-xs text-rose-400 truncate">
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

// ---------------------------------------------------------------------------
// Tab stubs
// ---------------------------------------------------------------------------

const TabStub: React.FC<{ message?: string }> = ({
  message = "Coming soon in a future release.",
}) => (
  <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
    {message}
  </div>
);

// ---------------------------------------------------------------------------
// Detail page
// ---------------------------------------------------------------------------

type ActiveTab = "summary" | "sources" | "people" | "salary" | "timeline";

export const InvestigatorDetailPage: React.FC = () => {
  const { dossierId = "" } = useParams<{ dossierId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>("summary");
  const [startRunOpen, setStartRunOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data: dossier, isLoading, error } = useDossier(dossierId);

  // Lazy-load sources and timeline only when their tab is first activated
  const sourcesEnabled = activeTab === "sources";
  const timelineEnabled = activeTab === "timeline";

  const { data: runs, isLoading: runsLoading } = useRuns(dossierId);
  useSources(dossierId, { enabled: sourcesEnabled });
  useSummaries(dossierId, undefined, { enabled: activeTab === "summary" });
  useTimeline(dossierId, undefined, { enabled: timelineEnabled });

  // 404 / error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-base font-semibold">Dossier not found</p>
        <p className="text-sm text-muted-foreground">
          This dossier may have been deleted or the URL is incorrect.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/investigator")}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Investigator
        </Button>
      </div>
    );
  }

  const statusCfg = dossier
    ? (dossierStatusConfig[dossier.status] ?? dossierStatusConfig.active)
    : null;

  const activeRun = runs?.find((r) => activeRunStatuses.has(r.status));

  const handleArchive = async () => {
    if (!dossier) return;
    try {
      // useUpdateDossier is a hook — we need a mutation instance in scope
      // The EditDossierDialog handles the full edit flow; for quick archive we open it pre-filled
      setEditOpen(true);
    } catch (err) {
      showErrorToast(err, "Failed to archive dossier");
    }
  };

  return (
    <>
      <PageHeader
        icon={Building2}
        title={isLoading ? "Loading…" : (dossier?.companyName ?? "Dossier")}
        subtitle="Company intelligence dossier"
        actions={
          <div className="flex items-center gap-2">
            {dossier?.companyUrl && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={dossier.companyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Website
                </a>
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setStartRunOpen(true)}
              disabled={!!activeRun || isLoading}
            >
              {activeRun ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-3.5 w-3.5" />
              )}
              {activeRun ? "Running…" : "Start Research"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ChevronDown className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  Edit dossier
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => void handleArchive()}
                  className="text-muted-foreground"
                >
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <PageMain>
        {/* Back nav + meta */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground -ml-1"
            onClick={() => navigate("/investigator")}
          >
            <ArrowLeft className="h-4 w-4" />
            All dossiers
          </Button>

          {dossier && statusCfg && (
            <Badge
              variant="outline"
              className={cn("text-xs", statusCfg.className)}
            >
              {statusCfg.label}
            </Badge>
          )}

          {dossier?.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as ActiveTab)}
        >
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="salary">Salary</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            <TabStub message="Summaries will appear here once a research run completes." />
          </TabsContent>

          <TabsContent value="sources" className="space-y-4">
            <TabStub message="Sources will appear here after a research run." />
          </TabsContent>

          <TabsContent value="people" className="space-y-4">
            <TabStub message="People discovered during research will appear here." />
          </TabsContent>

          <TabsContent value="salary" className="space-y-4">
            <TabStub message="Salary observations will appear here." />
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <TabStub message="Research timeline events will appear here." />
          </TabsContent>
        </Tabs>

        {/* Run history */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
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
      </PageMain>

      {dossierId && (
        <StartRunDialog
          dossierId={dossierId}
          open={startRunOpen}
          onClose={() => setStartRunOpen(false)}
        />
      )}

      {dossier && (
        <EditDossierDialog
          dossierId={dossierId}
          currentName={dossier.companyName}
          currentUrl={dossier.companyUrl}
          currentStatus={dossier.status}
          currentTags={dossier.tags}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
};
