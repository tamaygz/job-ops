/**
 * Compare Page — side-by-side LinkedIn profile comparison with LLM evaluation.
 */

import {
  applySectionApi,
  type CompareEvaluationEvent,
  scrapeProfile,
  streamEvaluate,
} from "@client/api/compare";
import { fetchApi } from "@client/api/core";
import { PageHeader, PageMain } from "@client/components/layout";
import type {
  CompareSectionKey,
  NormalisedCompareProfile,
  ResumeProfile,
  SectionEvaluation,
  SectionVerdict,
} from "@shared/types";
import { LINKEDIN_PROFILE_URL_PATTERN } from "@shared/types";
import {
  AlertTriangle,
  Check,
  Copy,
  FileText,
  GitCompareArrows,
  Loader2,
  Minus,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const SECTION_LABELS: Record<CompareSectionKey, string> = {
  basics: "Profile Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  projects: "Projects",
  languages: "Languages",
  awards: "Awards",
};

const COMPARE_SECTIONS: CompareSectionKey[] = [
  "basics",
  "experience",
  "education",
  "skills",
  "certifications",
  "projects",
  "languages",
  "awards",
];

type JobOption = { id: string; title: string; company: string };

// ============================================================================
// SectionVerdictBadge
// ============================================================================

const SectionVerdictBadge: React.FC<{
  verdict: SectionVerdict;
  rationale: string;
}> = ({ verdict, rationale }) => {
  const colorClass =
    verdict === "stronger"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : verdict === "weaker"
        ? "bg-red-500/15 text-red-400 border-red-500/30"
        : "bg-slate-500/15 text-slate-400 border-slate-500/30";

  const icon =
    verdict === "stronger" ? (
      <Check className="h-3 w-3" />
    ) : verdict === "weaker" ? (
      <X className="h-3 w-3" />
    ) : (
      <Minus className="h-3 w-3" />
    );

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            data-verdict={verdict}
            className={cn(
              "gap-1 border text-[11px] font-medium capitalize",
              colorClass,
            )}
          >
            {icon}
            {verdict}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {rationale}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ============================================================================
// CompareQuickActions
// ============================================================================

const CompareQuickActions: React.FC<{
  section: CompareSectionKey;
  otherProfileUrl: string;
  disabled: boolean;
  designResumeExists: boolean;
  onApplied: () => void;
}> = ({
  section,
  otherProfileUrl,
  disabled,
  designResumeExists,
  onApplied,
}) => {
  const [applying, setApplying] = useState<"copy" | "copy_rewrite" | null>(
    null,
  );

  const handleApply = async (action: "copy" | "copy_rewrite") => {
    setApplying(action);
    try {
      await applySectionApi(otherProfileUrl, section, action);
      toast.success(
        `${SECTION_LABELS[section]} ${action === "copy" ? "copied" : "copied & rewritten"} successfully`,
      );
      onApplied();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to apply section",
      );
    } finally {
      setApplying(null);
    }
  };

  if (!designResumeExists) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled className="text-xs">
                <Copy className="mr-1 h-3 w-3" />
                Copy
              </Button>
              <Button size="sm" variant="outline" disabled className="text-xs">
                <Sparkles className="mr-1 h-3 w-3" />
                Copy & Rewrite
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            Create a local Resume Studio first to copy sections
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || applying !== null}
        onClick={() => handleApply("copy")}
        className="text-xs"
      >
        {applying === "copy" ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <Copy className="mr-1 h-3 w-3" />
        )}
        Copy
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || applying !== null}
        onClick={() => handleApply("copy_rewrite")}
        className="text-xs"
      >
        {applying === "copy_rewrite" ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className="mr-1 h-3 w-3" />
        )}
        Copy &amp; Rewrite
      </Button>
    </div>
  );
};

// ============================================================================
// Section Content Renderers
// ============================================================================

function renderOwnSectionContent(
  profile: ResumeProfile,
  section: CompareSectionKey,
): React.ReactNode {
  if (section === "basics") {
    const b = profile.basics;
    if (!b)
      return (
        <p className="text-muted-foreground text-sm italic">No profile data</p>
      );
    return (
      <div className="space-y-1 text-sm">
        {b.name && <p className="font-medium">{b.name}</p>}
        {(b.headline || b.label) && (
          <p className="text-muted-foreground">{b.headline || b.label}</p>
        )}
        {b.summary && (
          <p className="text-muted-foreground line-clamp-3">{b.summary}</p>
        )}
        {b.location?.city && (
          <p className="text-muted-foreground text-xs">{b.location.city}</p>
        )}
      </div>
    );
  }

  const sectionData = profile.sections?.[section];
  if (!sectionData) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-400">
        <AlertTriangle className="h-4 w-4" />
        Missing from your profile
      </div>
    );
  }

  if (
    section === "experience" &&
    typeof sectionData === "object" &&
    "items" in sectionData
  ) {
    const items = (sectionData as { items?: unknown[] }).items ?? [];
    if (items.length === 0)
      return <p className="text-muted-foreground text-sm italic">No items</p>;
    return (
      <div className="space-y-2">
        {items.slice(0, 3).map((item: unknown, i) => {
          const it = item as Record<string, unknown>;
          return (
            <div key={String(it.id ?? i)} className="text-sm">
              <p className="font-medium">{String(it.position ?? "")}</p>
              <p className="text-xs text-muted-foreground">
                {String(it.company ?? "")}{" "}
                {it.date ? `· ${String(it.date)}` : ""}
              </p>
            </div>
          );
        })}
        {items.length > 3 && (
          <p className="text-xs text-muted-foreground">
            +{items.length - 3} more
          </p>
        )}
      </div>
    );
  }

  if (typeof sectionData === "object" && "content" in sectionData) {
    const content = String(
      (sectionData as { content?: unknown }).content ?? "",
    );
    return content ? (
      <p className="text-sm text-muted-foreground line-clamp-3">{content}</p>
    ) : (
      <p className="text-muted-foreground text-sm italic">No content</p>
    );
  }

  if (typeof sectionData === "object" && "items" in sectionData) {
    const items = (sectionData as { items?: unknown[] }).items ?? [];
    if (items.length === 0)
      return <p className="text-muted-foreground text-sm italic">No items</p>;
    return (
      <div className="flex flex-wrap gap-1">
        {items.slice(0, 8).map((item: unknown, i) => {
          const it = item as Record<string, unknown>;
          return (
            <Badge
              key={String(it.id ?? i)}
              variant="secondary"
              className="text-xs"
            >
              {String(it.name ?? it.title ?? "")}
            </Badge>
          );
        })}
        {items.length > 8 && (
          <Badge variant="outline" className="text-xs">
            +{items.length - 8}
          </Badge>
        )}
      </div>
    );
  }

  return <p className="text-muted-foreground text-sm italic">No data</p>;
}

function renderOtherSectionContent(
  profile: NormalisedCompareProfile,
  section: CompareSectionKey,
): React.ReactNode {
  if (section === "basics") {
    return (
      <div className="space-y-1 text-sm">
        {profile.basics.name && (
          <p className="font-medium">{profile.basics.name}</p>
        )}
        {profile.basics.headline && (
          <p className="text-muted-foreground">{profile.basics.headline}</p>
        )}
        {profile.basics.summary && (
          <p className="text-muted-foreground line-clamp-3">
            {profile.basics.summary}
          </p>
        )}
        {profile.basics.location && (
          <p className="text-muted-foreground text-xs">
            {profile.basics.location}
          </p>
        )}
      </div>
    );
  }

  const items = profile.sections[section as keyof typeof profile.sections];
  if (!items || !Array.isArray(items) || items.length === 0) {
    return <p className="text-muted-foreground text-sm italic">No data</p>;
  }

  if (section === "experience") {
    return (
      <div className="space-y-2">
        {(items as NormalisedCompareProfile["sections"]["experience"])
          .slice(0, 3)
          .map((item) => (
            <div
              key={`${item.company}-${item.position}-${item.period}`}
              className="text-sm"
            >
              <p className="font-medium">{item.position}</p>
              <p className="text-xs text-muted-foreground">
                {item.company} {item.period ? `· ${item.period}` : ""}
              </p>
            </div>
          ))}
        {items.length > 3 && (
          <p className="text-xs text-muted-foreground">
            +{items.length - 3} more
          </p>
        )}
      </div>
    );
  }

  if (section === "skills") {
    return (
      <div className="flex flex-wrap gap-1">
        {(items as NormalisedCompareProfile["sections"]["skills"])
          .slice(0, 8)
          .map((item) => (
            <Badge key={item.name} variant="secondary" className="text-xs">
              {item.name}
            </Badge>
          ))}
        {items.length > 8 && (
          <Badge variant="outline" className="text-xs">
            +{items.length - 8}
          </Badge>
        )}
      </div>
    );
  }

  if (section === "education") {
    return (
      <div className="space-y-2">
        {(items as NormalisedCompareProfile["sections"]["education"])
          .slice(0, 3)
          .map((item) => (
            <div
              key={`${item.school}-${item.degree}-${item.period}`}
              className="text-sm"
            >
              <p className="font-medium">{item.school}</p>
              <p className="text-xs text-muted-foreground">
                {[item.degree, item.area].filter(Boolean).join(", ")}{" "}
                {item.period ? `· ${item.period}` : ""}
              </p>
            </div>
          ))}
        {items.length > 3 && (
          <p className="text-xs text-muted-foreground">
            +{items.length - 3} more
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {items.slice(0, 6).map((item: Record<string, unknown>) => (
        <Badge
          key={String(item.name ?? item.title ?? item.language ?? "")}
          variant="secondary"
          className="text-xs"
        >
          {String(item.name ?? item.title ?? item.language ?? "")}
        </Badge>
      ))}
      {items.length > 6 && (
        <Badge variant="outline" className="text-xs">
          +{items.length - 6}
        </Badge>
      )}
    </div>
  );
}

// ============================================================================
// CompareSectionRow
// ============================================================================

const CompareSectionRow: React.FC<{
  section: CompareSectionKey;
  ownProfile: ResumeProfile;
  otherProfile: NormalisedCompareProfile;
  evaluation?: SectionEvaluation;
  evaluating: boolean;
  otherProfileUrl: string;
  designResumeExists: boolean;
  onApplied: () => void;
}> = ({
  section,
  ownProfile,
  otherProfile,
  evaluation,
  evaluating,
  otherProfileUrl,
  designResumeExists,
  onApplied,
}) => {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-lg border border-border/50 bg-card/50 p-4 md:grid-cols-[1fr_auto_1fr]">
      {/* Own Profile Column */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-muted-foreground">
            Your Profile
          </h4>
        </div>
        {renderOwnSectionContent(ownProfile, section)}
      </div>

      {/* Verdict Column */}
      <div className="flex flex-col items-center justify-center gap-2 px-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {SECTION_LABELS[section]}
        </p>
        {evaluating && !evaluation ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : evaluation ? (
          <SectionVerdictBadge
            verdict={evaluation.verdict}
            rationale={evaluation.rationale}
          />
        ) : null}
      </div>

      {/* Other Profile Column */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-muted-foreground">
            Other Profile
          </h4>
          <CompareQuickActions
            section={section}
            otherProfileUrl={otherProfileUrl}
            disabled={false}
            designResumeExists={designResumeExists}
            onApplied={onApplied}
          />
        </div>
        {renderOtherSectionContent(otherProfile, section)}
      </div>
    </div>
  );
};

// ============================================================================
// ComparePage
// ============================================================================

export const ComparePage: React.FC = () => {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [ownProfile, setOwnProfile] = useState<ResumeProfile | null>(null);
  const [otherProfile, setOtherProfile] =
    useState<NormalisedCompareProfile | null>(null);
  const [evaluations, setEvaluations] = useState<
    Map<CompareSectionKey, SectionEvaluation>
  >(new Map());
  const [designResumeExists, setDesignResumeExists] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Load own profile and design resume status on mount
  useEffect(() => {
    (async () => {
      try {
        const profile = await fetchApi<ResumeProfile>("/profile");
        setOwnProfile(profile);
      } catch {
        // Profile not available; continue without it
      }

      try {
        const status = await fetchApi<{ exists: boolean }>("/profile/status");
        setDesignResumeExists(status.exists);
      } catch {
        // Assume exists
      }
    })();
  }, []);

  // Load jobs for job picker
  useEffect(() => {
    (async () => {
      try {
        const response = await fetchApi<{
          jobs: Array<{ id: string; title: string; company: string }>;
        }>("/jobs?statuses=ready&view=list");
        setJobs(
          response.jobs.map((j) => ({
            id: j.id,
            title: j.title,
            company: j.company,
          })),
        );
      } catch {
        // Jobs not available
      }
    })();
  }, []);

  const runEvaluation = useCallback(
    async (profileUrl: string, jobId?: string | null) => {
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setEvaluating(true);
      setEvaluations(new Map());

      try {
        await streamEvaluate(profileUrl, jobId, {
          onEvent: (event: CompareEvaluationEvent) => {
            if (event.type === "section_eval") {
              setEvaluations((prev) => {
                const next = new Map(prev);
                next.set(event.section, {
                  section: event.section,
                  verdict: event.verdict,
                  rationale: event.rationale,
                });
                return next;
              });
            }
            if (event.type === "done") {
              setEvaluating(false);
            }
            if (event.type === "error") {
              toast.error(event.message || "Evaluation failed");
              setEvaluating(false);
            }
          },
          signal: controller.signal,
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast.error(
            error instanceof Error ? error.message : "Evaluation stream failed",
          );
        }
      } finally {
        setEvaluating(false);
      }
    },
    [],
  );

  const handleScrape = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError("Please enter a LinkedIn profile URL");
      return;
    }
    if (!LINKEDIN_PROFILE_URL_PATTERN.test(trimmed)) {
      setUrlError(
        "Please enter a valid LinkedIn profile URL (https://www.linkedin.com/in/...)",
      );
      return;
    }

    setUrlError(null);
    setScraping(true);

    try {
      const profile = await scrapeProfile(trimmed);
      setOtherProfile(profile);
      toast.success(`Profile loaded: ${profile.basics.name}`);

      // Start evaluation immediately
      await runEvaluation(trimmed, selectedJob);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to scrape profile",
      );
    } finally {
      setScraping(false);
    }
  };

  const handleClear = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setOtherProfile(null);
    setEvaluations(new Map());
    setUrl("");
    setUrlError(null);
    setEvaluating(false);
    setSelectedJob(null);
  };

  const handleJobChange = (jobId: string) => {
    const nextJobId = jobId === "none" ? null : jobId;
    setSelectedJob(nextJobId);
    if (otherProfile) {
      runEvaluation(otherProfile.sourceUrl, nextJobId);
    }
  };

  const handleApplied = async () => {
    // Refresh own profile after a section is applied
    try {
      const profile = await fetchApi<ResumeProfile>("/profile");
      setOwnProfile(profile);
    } catch {
      // Ignore refresh failure
    }
  };

  return (
    <>
      <PageHeader
        icon={GitCompareArrows}
        title="Compare"
        subtitle="Score your profile against another LinkedIn profile"
        actions={
          otherProfile ? (
            <Button variant="outline" size="sm" onClick={handleClear}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Clear comparison
            </Button>
          ) : undefined
        }
      />

      <PageMain>
        {/* URL Input */}
        {!otherProfile && (
          <Card className="p-6">
            <div className="mx-auto max-w-xl space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="h-5 w-5" />
                <p className="text-sm">
                  Enter a LinkedIn profile URL to compare against your profile
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://www.linkedin.com/in/username"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (urlError) setUrlError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !scraping) handleScrape();
                  }}
                  disabled={scraping}
                  className={cn(urlError && "border-destructive")}
                />
                <Button onClick={handleScrape} disabled={scraping}>
                  {scraping ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      Scraping...
                    </>
                  ) : (
                    "Compare"
                  )}
                </Button>
              </div>
              {urlError && (
                <p className="text-sm text-destructive">{urlError}</p>
              )}
            </div>
          </Card>
        )}

        {/* Job Picker */}
        {otherProfile && jobs.length > 0 && (
          <div className="flex items-center gap-3">
            <label
              htmlFor="job-picker"
              className="text-sm font-medium text-muted-foreground whitespace-nowrap"
            >
              Compare against a job (optional):
            </label>
            <Select
              value={selectedJob ?? "none"}
              onValueChange={handleJobChange}
            >
              <SelectTrigger className="w-80">
                <SelectValue placeholder="Select a job..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No job context</SelectItem>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title} — {job.company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Own Profile Only (no comparison yet) */}
        {!otherProfile && ownProfile && (
          <Card className="p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Your Profile
            </h3>
            <div className="space-y-3">
              {ownProfile.basics?.name && (
                <p className="text-lg font-medium">{ownProfile.basics.name}</p>
              )}
              {(ownProfile.basics?.headline || ownProfile.basics?.label) && (
                <p className="text-muted-foreground">
                  {ownProfile.basics.headline || ownProfile.basics.label}
                </p>
              )}
              {ownProfile.basics?.summary && (
                <p className="text-sm text-muted-foreground line-clamp-4">
                  {ownProfile.basics.summary}
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Comparison Grid */}
        {otherProfile && ownProfile && (
          <div className="space-y-4">
            {COMPARE_SECTIONS.map((section) => (
              <CompareSectionRow
                key={section}
                section={section}
                ownProfile={ownProfile}
                otherProfile={otherProfile}
                evaluation={evaluations.get(section)}
                evaluating={evaluating}
                otherProfileUrl={otherProfile.sourceUrl}
                designResumeExists={designResumeExists}
                onApplied={handleApplied}
              />
            ))}
          </div>
        )}
      </PageMain>
    </>
  );
};
