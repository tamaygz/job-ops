import { PeoplePanel } from "@client/components/investigator/PeoplePanel";
import { RunProgressPanel } from "@client/components/investigator/RunProgressPanel";
import { activeInvestigatorRunStatuses } from "@client/components/investigator/runMetadata";
import { SalaryPanel } from "@client/components/investigator/SalaryPanel";
import { SourceReviewPanel } from "@client/components/investigator/SourceReviewPanel";
import { SummaryPanel } from "@client/components/investigator/SummaryPanel";
import { dossierStatusConfig } from "@client/components/investigator/statusConfig";
import { TimelinePanel } from "@client/components/investigator/TimelinePanel";
import { PageHeader, PageMain } from "@client/components/layout";
import {
  useDossier,
  useRuns,
} from "@client/hooks/queries/useInvestigatorQueries";
import { showErrorToast } from "@client/lib/error-toast";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ExternalLink,
  Loader2,
  Play,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { EditDossierDialog } from "./detail/EditDossierDialog";
import { RunHistorySection } from "./detail/RunHistorySection";
import { StartRunDialog } from "./detail/StartRunDialog";

// ---------------------------------------------------------------------------
// Run status helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Detail page
// ---------------------------------------------------------------------------

type ActiveTab = "summary" | "sources" | "people" | "salary" | "timeline";

export const InvestigatorDetailPage: React.FC = () => {
  const { dossierId = "" } = useParams<{ dossierId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const sourceJobId = (location.state as { sourceJobId?: string } | null)
    ?.sourceJobId;
  const [activeTab, setActiveTab] = useState<ActiveTab>("summary");
  const [startRunOpen, setStartRunOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data: dossier, isLoading, error } = useDossier(dossierId);

  const { data: runs, isLoading: runsLoading } = useRuns(dossierId);

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

  const activeRun = runs?.find((r) =>
    activeInvestigatorRunStatuses.has(r.status),
  );

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

        {/* Run progress banner */}
        {dossierId && (
          <RunProgressPanel
            dossierId={dossierId}
            onStartRun={() => setStartRunOpen(true)}
          />
        )}

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
            <SummaryPanel dossierId={dossierId} sourceJobId={sourceJobId} />
          </TabsContent>

          <TabsContent value="sources" className="space-y-4">
            <SourceReviewPanel dossierId={dossierId} />
          </TabsContent>

          <TabsContent value="people" className="space-y-4">
            <PeoplePanel dossierId={dossierId} />
          </TabsContent>

          <TabsContent value="salary" className="space-y-4">
            <SalaryPanel dossierId={dossierId} />
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <TimelinePanel dossierId={dossierId} />
          </TabsContent>
        </Tabs>

        <RunHistorySection
          dossierId={dossierId}
          runs={runs}
          runsLoading={runsLoading}
        />
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
