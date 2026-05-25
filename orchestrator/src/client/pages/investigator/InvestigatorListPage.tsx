import { EmptyState, PageHeader, PageMain } from "@client/components/layout";
import { useCreateDossier } from "@client/hooks/queries/useInvestigatorMutations";
import { useDossiers } from "@client/hooks/queries/useInvestigatorQueries";
import { showErrorToast } from "@client/lib/error-toast";
import type {
  CreateInvestigatorDossierInput,
  DossierStatus,
  InvestigatorDossierListFilters,
  InvestigatorDossierListItem,
} from "@shared/types";
import { Building2, Plus, Search } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { dossierStatusConfig } from "@client/components/investigator/statusConfig";

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function formatLastResearched(ts: number | null): string {
  if (ts === null) return "Never";
  const diff = Date.now() - ts * 1000;
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months !== 1 ? "s" : ""} ago`;
}

function isStale(ts: number | null): boolean {
  if (ts === null) return true;
  return Date.now() - ts * 1000 > THIRTY_DAYS_MS;
}

// ---------------------------------------------------------------------------
// Create dossier dialog
// ---------------------------------------------------------------------------

interface CreateDossierDialogProps {
  open: boolean;
  onClose: () => void;
}

const CreateDossierDialog: React.FC<CreateDossierDialogProps> = ({
  open,
  onClose,
}) => {
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const mutation = useCreateDossier();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    const input: CreateInvestigatorDossierInput = {
      companyName: companyName.trim(),
      companyUrl: companyUrl.trim() || null,
    };
    try {
      await mutation.mutateAsync(input);
      setCompanyName("");
      setCompanyUrl("");
      onClose();
    } catch (err) {
      showErrorToast(err, "Failed to create dossier");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Dossier</DialogTitle>
        </DialogHeader>
        <form id="create-dossier-form" onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="company-name">Company name</Label>
              <Input
                id="company-name"
                placeholder="Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company-url">Website (optional)</Label>
              <Input
                id="company-url"
                type="url"
                placeholder="https://acme.com"
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
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
            form="create-dossier-form"
            disabled={!companyName.trim() || mutation.isPending}
          >
            {mutation.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------

const SkeletonRow: React.FC = () => (
  <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3 animate-pulse">
    <div className="h-4 w-40 rounded bg-muted/50" />
    <div className="h-5 w-20 rounded-full bg-muted/50" />
    <div className="ml-auto h-4 w-24 rounded bg-muted/50" />
  </div>
);

// ---------------------------------------------------------------------------
// Dossier row
// ---------------------------------------------------------------------------

interface DossierRowProps {
  dossier: InvestigatorDossierListItem;
  onClick: () => void;
}

const DossierRow: React.FC<DossierRowProps> = ({ dossier, onClick }) => {
  const statusCfg =
    dossierStatusConfig[dossier.status] ?? dossierStatusConfig.active;
  const stale = isStale(dossier.lastResearchedAt);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        stale && "border-amber-500/20",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{dossier.companyName}</span>
          <Badge
            variant="outline"
            className={cn("text-xs shrink-0", statusCfg.className)}
          >
            {statusCfg.label}
          </Badge>
          {stale && (
            <Badge
              variant="outline"
              className="text-xs shrink-0 border-amber-500/30 bg-amber-500/10 text-amber-400"
            >
              Stale
            </Badge>
          )}
        </div>
        {dossier.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {dossier.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0 text-xs text-muted-foreground">
        <span>{formatLastResearched(dossier.lastResearchedAt)}</span>
        <span>
          {dossier.linkedJobCount} job{dossier.linkedJobCount !== 1 ? "s" : ""}
        </span>
      </div>
    </button>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const ALL_STATUSES = "__all__";

export const InvestigatorListPage: React.FC = () => {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<DossierStatus | "">("");
  const [staleFilter, setStaleFilter] = useState(false);

  const filters: InvestigatorDossierListFilters = {
    q: q.trim() || undefined,
    status: statusFilter || undefined,
    stale: staleFilter || undefined,
  };

  const { data: dossiers, isLoading } = useDossiers(filters);

  return (
    <>
      <PageHeader
        icon={Building2}
        title="Investigator"
        subtitle="Company intelligence dossiers"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Dossier
          </Button>
        }
      />
      <PageMain>
        {/* Filter bar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search companies…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select
            value={statusFilter || ALL_STATUSES}
            onValueChange={(v) =>
              setStatusFilter(v === ALL_STATUSES ? "" : (v as DossierStatus))
            }
          >
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
              {(Object.keys(dossierStatusConfig) as DossierStatus[]).map(
                (s) => (
                  <SelectItem key={s} value={s}>
                    {dossierStatusConfig[s].label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-sm">
            <Switch
              id="stale-toggle"
              checked={staleFilter}
              onCheckedChange={setStaleFilter}
            />
            <Label
              htmlFor="stale-toggle"
              className="text-muted-foreground cursor-pointer"
            >
              Stale only
            </Label>
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          {isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : dossiers && dossiers.length > 0 ? (
            dossiers.map((d) => (
              <DossierRow
                key={d.id}
                dossier={d}
                onClick={() => navigate(`/investigator/${d.id}`)}
              />
            ))
          ) : (
            <EmptyState
              icon={Building2}
              title="No dossiers yet"
              description="Create a dossier to start researching companies and tracking insights."
              action={
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create your first dossier
                </Button>
              }
            />
          )}
        </div>
      </PageMain>

      <CreateDossierDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </>
  );
};
