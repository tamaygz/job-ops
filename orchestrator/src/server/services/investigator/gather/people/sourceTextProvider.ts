import * as peopleRepo from "@server/repositories/investigatorPeopleRepository";
import * as sourceRepo from "@server/repositories/investigatorSourceRepository";
import * as peopleService from "@server/services/investigator/peopleService";
import type { ConfidenceLabel } from "@shared/types";
import type { InvestigatorProvider } from "../types";
import {
  extractPeopleCandidates,
  inferPersonType,
  normalizeWhitespace,
} from "../utils/text";

const MAX_PEOPLE = 25;

function confidenceFromReviewState(reviewState: string): ConfidenceLabel {
  if (reviewState === "verified") return "high";
  if (reviewState === "low_confidence") return "low";
  return "medium";
}

export const sourceTextPeopleProvider: InvestigatorProvider = {
  id: "source_text",
  displayName: "Source text people extraction",
  phase: "people",
  async run(context) {
    const sources = await sourceRepo.findByDossier(context.dossierId);
    if (sources.length === 0) {
      return { status: "skipped", message: "No sources to parse" };
    }

    const existing = await peopleRepo.findByDossier(context.dossierId);
    const existingKeys = new Set(
      existing.map(
        (person) =>
          `${person.fullName.toLowerCase()}|${person.title?.toLowerCase() ?? ""}`,
      ),
    );

    let created = 0;

    for (const source of sources) {
      if (created >= MAX_PEOPLE) break;
      if (source.reviewState === "rejected") continue;

      const text = normalizeWhitespace(source.capturedExcerpt);
      if (!text) continue;

      const candidates = extractPeopleCandidates(text);
      for (const candidate of candidates) {
        if (created >= MAX_PEOPLE) break;

        const key = `${candidate.fullName.toLowerCase()}|${candidate.title.toLowerCase()}`;
        if (existingKeys.has(key)) continue;

        await peopleService.createPerson(context.dossierId, {
          runId: context.runId,
          fullName: candidate.fullName,
          personType: inferPersonType(candidate.title),
          title: candidate.title,
          profileUrl: null,
          roleContext: null,
          notes: null,
          confidenceLabel: confidenceFromReviewState(source.reviewState),
          sourceIds: [source.id],
        });

        existingKeys.add(key);
        created += 1;
      }
    }

    return {
      status: "success",
      createdCount: created,
      message: `Saved ${created} people records`,
    };
  },
};
