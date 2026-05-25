import * as salaryRepo from "@server/repositories/investigatorSalaryRepository";
import * as sourceRepo from "@server/repositories/investigatorSourceRepository";
import * as salaryService from "@server/services/investigator/salaryService";
import type { PayInterval } from "@shared/types";
import type { InvestigatorProvider } from "../types";
import {
  extractSalaryRanges,
  inferPayInterval,
  normalizeWhitespace,
} from "../utils/text";

function buildKey(
  minAmount: number | null,
  maxAmount: number | null,
  currency: string | null,
  payInterval: PayInterval | null,
): string {
  return `${minAmount ?? ""}|${maxAmount ?? ""}|${currency ?? ""}|${payInterval ?? ""}`;
}

export const sourceTextSalaryProvider: InvestigatorProvider = {
  id: "source_text",
  displayName: "Source text salary extraction",
  phase: "salary",
  async run(context) {
    const sources = await sourceRepo.findByDossier(context.dossierId);
    if (sources.length === 0) {
      return { status: "skipped", message: "No sources to parse" };
    }

    const existing = await salaryRepo.findByDossier(context.dossierId);
    const existingKeys = new Set(
      existing.map((obs) =>
        buildKey(obs.minAmount, obs.maxAmount, obs.currency, obs.payInterval),
      ),
    );

    let created = 0;

    for (const source of sources) {
      if (source.reviewState === "rejected") continue;

      const text = normalizeWhitespace(source.capturedExcerpt);
      if (!text) continue;

      const ranges = extractSalaryRanges(text);
      for (const range of ranges) {
        const payInterval = range.payInterval ?? inferPayInterval(text);
        const key = buildKey(
          range.minAmount,
          range.maxAmount,
          range.currency,
          payInterval,
        );
        if (existingKeys.has(key)) continue;

        await salaryService.createObservation(context.dossierId, {
          runId: context.runId,
          roleScope: null,
          geoScope: null,
          currency: range.currency ?? "USD",
          payInterval: payInterval ?? "unknown",
          minAmount: range.minAmount,
          maxAmount: range.maxAmount,
          confidenceLabel: "medium",
          sourceId: source.id,
          observedAt: Math.floor(Date.now() / 1000),
          notes: "Parsed from source text",
        });

        existingKeys.add(key);
        created += 1;
      }
    }

    return {
      status: "success",
      createdCount: created,
      message: `Saved ${created} salary observations`,
    };
  },
};
