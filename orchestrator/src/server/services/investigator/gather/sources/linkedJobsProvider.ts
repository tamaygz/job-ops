import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import * as jobsRepo from "@server/repositories/jobs";
import * as sourceService from "@server/services/investigator/sourceService";
import type { InvestigatorProvider } from "../types";
import { truncateText } from "../utils/text";

const MAX_EXCERPT_CHARS = 8000;

function buildJobExcerpt(job: Awaited<ReturnType<typeof jobsRepo.getJobById>>) {
  if (!job) return null;
  const lines = [
    `Job Title: ${job.title}`,
    `Company: ${job.employer}`,
  ];
  if (job.location) lines.push(`Location: ${job.location}`);
  if (job.salary) lines.push(`Salary: ${job.salary}`);
  if (job.jobDescription) {
    lines.push("\n---\n", job.jobDescription);
  }
  return truncateText(lines.join("\n"), MAX_EXCERPT_CHARS);
}

export const linkedJobsProvider: InvestigatorProvider = {
  id: "linked_jobs",
  displayName: "Linked jobs",
  phase: "sources",
  async run(context) {
    const linked = await dossierRepo.listLinkedJobs(context.dossierId);
    if (linked.length === 0) {
      return { status: "skipped", message: "No linked jobs" };
    }

    let created = 0;

    for (const item of linked) {
      const job = await jobsRepo.getJobById(item.jobId);
      if (!job) continue;

      const excerpt = buildJobExcerpt(job);
      if (!excerpt) continue;

      const title = `${job.title} (${job.employer})`;
      const url = job.jobUrl || job.applicationLink || job.jobUrlDirect || null;

      const result = await sourceService.saveSource(context.dossierId, {
        runId: context.runId,
        sourceType: "job_metadata",
        title,
        url,
        capturedExcerpt: excerpt,
        retrievedAt: Math.floor(Date.now() / 1000),
      });

      if (!result.deduplicated) created += 1;
    }

    return {
      status: "success",
      createdCount: created,
      message: `Saved ${created} job sources`,
    };
  },
};
