import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import * as salaryRepo from "@server/repositories/investigatorSalaryRepository";
import * as jobsRepo from "@server/repositories/jobs";
import * as salaryService from "@server/services/investigator/salaryService";
import type { PayInterval } from "@shared/types";
import type { InvestigatorProvider } from "../types";

function normalizePayInterval(raw?: string | null): PayInterval | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("hour")) return "hourly";
  if (lower.includes("month")) return "monthly";
  if (lower.includes("year") || lower.includes("annum")) return "annual";
  return "unknown";
}

function buildKey(
  minAmount: number | null,
  maxAmount: number | null,
  currency: string | null,
  payInterval: PayInterval | null,
): string {
  return `${minAmount ?? ""}|${maxAmount ?? ""}|${currency ?? ""}|${payInterval ?? ""}`;
}

export const jobMetadataSalaryProvider: InvestigatorProvider = {
  id: "job_metadata",
  displayName: "Job metadata salary",
  phase: "salary",
  async run(context) {
    const linked = await dossierRepo.listLinkedJobs(context.dossierId);
    if (linked.length === 0) {
      return { status: "skipped", message: "No linked jobs" };
    }

    const existing = await salaryRepo.findByDossier(context.dossierId);
    const existingKeys = new Set(
      existing.map((obs) =>
        buildKey(obs.minAmount, obs.maxAmount, obs.currency, obs.payInterval),
      ),
    );

    let created = 0;

    for (const item of linked) {
      const job = await jobsRepo.getJobById(item.jobId);
      if (!job) continue;

      const minAmount = job.salaryMinAmount ?? null;
      const maxAmount = job.salaryMaxAmount ?? null;
      const currency = job.salaryCurrency ?? null;
      const payInterval = normalizePayInterval(job.salaryInterval);

      if (!minAmount && !maxAmount) continue;

      const key = buildKey(minAmount, maxAmount, currency, payInterval);
      if (existingKeys.has(key)) continue;

      await salaryService.createObservation(context.dossierId, {
        runId: context.runId,
        roleScope: job.title,
        geoScope: job.location ?? null,
        currency: currency ?? "USD",
        payInterval: payInterval ?? "unknown",
        minAmount,
        maxAmount,
        confidenceLabel: "high",
        sourceId: null,
        observedAt: Math.floor(Date.now() / 1000),
        notes: "From linked job metadata",
      });

      existingKeys.add(key);
      created += 1;
    }

    return {
      status: "success",
      createdCount: created,
      message: `Saved ${created} salary observations`,
    };
  },
};
