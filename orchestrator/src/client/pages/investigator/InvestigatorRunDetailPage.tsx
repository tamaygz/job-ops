import { investigatorRunKindLabels } from "@client/components/investigator/runMetadata";
import { PageHeader, PageMain } from "@client/components/layout";
import {
  useDossier,
  usePeople,
  useRun,
  useSalary,
  useSources,
  useSummaries,
  useTimeline,
} from "@client/hooks/queries/useInvestigatorQueries";
import type { TimelineEventType } from "@shared/types";
import { ArrowLeft, Clock3, ExternalLink, Search } from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

const RUN_STATUS_STYLES: Record<string, string> = {
  queued: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  running: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  partial_failed: "border-orange-500/30 bg-orange-500/10 text-orange-200",
  failed: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  cancelled: "border-zinc-500/30 bg-zinc-500/10 text-zinc-200",
};

const RUN_PHASES: Record<
  string,
  {
    people: boolean;
    salary: boolean;
  }
> = {
  company_brief: { people: false, salary: false },
  people_scan: { people: true, salary: false },
  dossier_refresh: { people: true, salary: true },
};

function formatDateTime(timestampSeconds: number | null): string {
  if (timestampSeconds === null) return "—";
  return new Date(timestampSeconds * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatElapsed(
  startedAtSeconds: number | null,
  completedAtSeconds: number | null,
): string | null {
  if (startedAtSeconds === null) return null;
  const end = completedAtSeconds ?? Math.floor(Date.now() / 1000);
  const totalSeconds = Math.max(0, end - startedAtSeconds);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function startCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return value.join(", ");
  return "View details";
}

function summarizePayload(payload: Record<string, unknown>): string | null {
  const entries = Object.entries(payload).filter(([, value]) => {
    if (value === null || value === undefined) {
      return false;
    }
    return !(typeof value === "string" && value.trim().length === 0);
  });
  if (entries.length === 0) return null;
  return entries
    .slice(0, 4)
    .map(([key, value]) => `${startCase(key)}: ${formatValue(value)}`)
    .join(" • ");
}

function formatSalaryRange(
  minAmount: number | null,
  maxAmount: number | null,
  currency: string | null,
): string {
  const formatter = new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  });
  const prefix = currency ? `${currency} ` : "";
  if (minAmount !== null && maxAmount !== null) {
    return `${prefix}${formatter.format(minAmount)} - ${formatter.format(maxAmount)}`;
  }
  if (minAmount !== null) {
    return `From ${prefix}${formatter.format(minAmount)}`;
  }
  if (maxAmount !== null) {
    return `Up to ${prefix}${formatter.format(maxAmount)}`;
  }
  return "Range not recorded";
}

function EmptyStep({
  message = "Nothing has been recorded for this step yet.",
}: {
  message?: string;
}) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}

export const InvestigatorRunDetailPage: React.FC = () => {
  const { dossierId = "", runId = "" } = useParams<{
    dossierId: string;
    runId: string;
  }>();
  const navigate = useNavigate();
  const {
    data: dossier,
    isLoading: dossierLoading,
    error: dossierError,
  } = useDossier(dossierId, { enabled: Boolean(dossierId) });
  const {
    data: run,
    isLoading: runLoading,
    error: runError,
  } = useRun(dossierId, runId, {
    enabled: Boolean(dossierId && runId),
  });
  const { data: sources, isLoading: sourcesLoading } = useSources(dossierId, {
    enabled: Boolean(dossierId),
  });
  const { data: people, isLoading: peopleLoading } = usePeople(dossierId, {
    enabled: Boolean(dossierId),
  });
  const { data: salary, isLoading: salaryLoading } = useSalary(dossierId, {
    enabled: Boolean(dossierId),
  });
  const { data: summaries, isLoading: summariesLoading } = useSummaries(
    dossierId,
    undefined,
    {
      enabled: Boolean(dossierId),
    },
  );
  const { data: timeline, isLoading: timelineLoading } = useTimeline(
    dossierId,
    { limit: 200 },
    { enabled: Boolean(dossierId) },
  );

  const runSources = useMemo(
    () => (sources ?? []).filter((source) => source.runId === runId),
    [runId, sources],
  );
  const runPeople = useMemo(
    () => (people ?? []).filter((person) => person.runId === runId),
    [people, runId],
  );
  const runSalary = useMemo(
    () => (salary ?? []).filter((observation) => observation.runId === runId),
    [runId, salary],
  );
  const runSummaries = useMemo(
    () => (summaries ?? []).filter((summary) => summary.runId === runId),
    [runId, summaries],
  );
  const runTimeline = useMemo(
    () =>
      [...(timeline ?? [])]
        .filter((event) => event.runId === runId)
        .sort((left, right) => left.occurredAt - right.occurredAt),
    [runId, timeline],
  );

  const isLoading =
    dossierLoading ||
    runLoading ||
    sourcesLoading ||
    peopleLoading ||
    salaryLoading ||
    summariesLoading ||
    timelineLoading;

  if (dossierError || runError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <p className="text-base font-semibold">Research run not found</p>
        <p className="text-sm text-muted-foreground">
          The run may have been deleted or the URL is incorrect.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Go back
        </Button>
      </div>
    );
  }

  const runKindLabel = run
    ? (investigatorRunKindLabels[run.runKind] ?? run.runKind)
    : "Research run";
  const phasePlan =
    RUN_PHASES[run?.runKind ?? "company_brief"] ?? RUN_PHASES.company_brief;
  const elapsed = run ? formatElapsed(run.startedAt, run.completedAt) : null;

  return (
    <>
      <PageHeader
        icon={Search}
        title={isLoading ? "Loading…" : `${runKindLabel} details`}
        subtitle={
          dossier?.companyName
            ? `Auditable research log for ${dossier.companyName}`
            : "Auditable research log"
        }
        actions={
          <div className="flex items-center gap-2">
            {dossier?.companyUrl ? (
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
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/investigator/${dossierId}`)}
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to dossier
            </Button>
          </div>
        }
      />

      <PageMain>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Run overview</CardTitle>
              <CardDescription>
                See what this research run attempted and what it produced.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "capitalize",
                    RUN_STATUS_STYLES[run?.status ?? "queued"],
                  )}
                >
                  {(run?.status ?? "queued").replace(/_/g, " ")}
                </Badge>
                {run ? (
                  <span className="text-sm text-muted-foreground">
                    {runKindLabel}
                  </span>
                ) : null}
              </div>

              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Started
                  </dt>
                  <dd className="text-sm font-medium">
                    {formatDateTime(run?.startedAt ?? null)}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Finished
                  </dt>
                  <dd className="text-sm font-medium">
                    {formatDateTime(run?.completedAt ?? null)}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Duration
                  </dt>
                  <dd className="text-sm font-medium">
                    {elapsed ?? "In progress"}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Started by
                  </dt>
                  <dd className="text-sm font-medium capitalize">
                    {run?.initiatedBy ?? "user"}
                  </dd>
                </div>
              </dl>

              {run?.errorMessage ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3">
                  <p className="text-sm font-medium text-rose-200">
                    Failure details
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {run.errorMessage}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Results at a glance</CardTitle>
              <CardDescription>
                Outputs that were attached to this run.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-lg border px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Sources
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {runSources.length}
                </p>
              </div>
              {phasePlan.people ? (
                <div className="rounded-lg border px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    People
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {runPeople.length}
                  </p>
                </div>
              ) : null}
              {phasePlan.salary ? (
                <div className="rounded-lg border px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Salary signals
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {runSalary.length}
                  </p>
                </div>
              ) : null}
              <div className="rounded-lg border px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Summaries
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {runSummaries.length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Audit trail</CardTitle>
            <CardDescription>
              Chronological log of what happened during this run.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {runTimeline.length === 0 ? (
              <EmptyStep message="This run has not emitted any audit events yet." />
            ) : (
              runTimeline.map((event) => {
                const payloadSummary = summarizePayload(event.payload);
                return (
                  <div key={event.id} className="rounded-lg border px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium">
                          {EVENT_LABELS[event.eventType] ??
                            startCase(event.eventType)}
                        </p>
                        {payloadSummary ? (
                          <p className="text-xs text-muted-foreground">
                            {payloadSummary}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" />
                        <span>{formatDateTime(event.occurredAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sources collected</CardTitle>
              <CardDescription>
                Pages and snippets saved while gathering evidence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {runSources.length === 0 ? (
                <EmptyStep />
              ) : (
                runSources.map((source, index) => (
                  <div key={source.id} className="rounded-lg border px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium">
                          {index + 1}. {source.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {startCase(source.sourceType)}
                          {source.sourceHost ? ` • ${source.sourceHost}` : ""}
                        </p>
                      </div>
                      {source.url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          asChild
                        >
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open
                          </a>
                        </Button>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {source.capturedExcerpt}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>People found</CardTitle>
              <CardDescription>
                Contacts or stakeholders discovered from the run evidence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!phasePlan.people ? (
                <EmptyStep message="This run type does not include people extraction." />
              ) : runPeople.length === 0 ? (
                <EmptyStep />
              ) : (
                runPeople.map((person) => (
                  <div key={person.id} className="rounded-lg border px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{person.fullName}</p>
                      <Badge variant="outline" className="capitalize">
                        {person.personType.replace(/_/g, " ")}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {person.confidenceLabel}
                      </Badge>
                    </div>
                    {person.title ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {person.title}
                      </p>
                    ) : null}
                    {person.notes ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {person.notes}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Salary signals</CardTitle>
              <CardDescription>
                Compensation observations linked to this run.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!phasePlan.salary ? (
                <EmptyStep message="This run type does not include salary extraction." />
              ) : runSalary.length === 0 ? (
                <EmptyStep />
              ) : (
                runSalary.map((observation) => (
                  <div
                    key={observation.id}
                    className="rounded-lg border px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {observation.roleScope ?? "Compensation observation"}
                      </p>
                      <Badge variant="outline" className="capitalize">
                        {observation.confidenceLabel}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatSalaryRange(
                        observation.minAmount,
                        observation.maxAmount,
                        observation.currency,
                      )}
                      {observation.payInterval
                        ? ` • ${observation.payInterval}`
                        : ""}
                      {observation.geoScope ? ` • ${observation.geoScope}` : ""}
                    </p>
                    {observation.notes ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {observation.notes}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summaries generated</CardTitle>
              <CardDescription>
                Narrative outputs produced from the saved evidence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {runSummaries.length === 0 ? (
                <EmptyStep />
              ) : (
                runSummaries.map((summary) => (
                  <div key={summary.id} className="rounded-lg border px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{summary.title}</p>
                      <Badge variant="outline" className="capitalize">
                        {summary.summaryType.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {summary.bodyMarkdown}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </PageMain>
    </>
  );
};
