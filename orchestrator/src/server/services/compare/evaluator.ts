/**
 * LLM section-level evaluator for profile comparison.
 * Evaluates each section independently and yields SectionEvaluation objects.
 */

import { logger } from "@infra/logger";
import type {
	CompareSectionKey,
	NormalisedCompareProfile,
	SectionEvaluation,
	SectionVerdict,
} from "@shared/types";
import type { ResumeProfile } from "@shared/types";
import type { JsonSchemaDefinition } from "../llm/types";
import { createConfiguredLlmService, resolveLlmModel } from "../modelSelection";

const VALID_VERDICTS = new Set<SectionVerdict>(["stronger", "weaker", "comparable"]);

const SECTION_EVAL_SCHEMA: JsonSchemaDefinition = {
	name: "section_evaluation",
	schema: {
		type: "object",
		properties: {
			verdict: {
				type: "string",
				enum: ["stronger", "weaker", "comparable"],
				description:
					"Whether the first profile's section is stronger, weaker, or comparable to the second",
			},
			rationale: {
				type: "string",
				description: "Brief plain-text explanation (60 words max) of why this verdict was chosen",
			},
		},
		required: ["verdict", "rationale"],
		additionalProperties: false,
	},
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

function getOwnSectionContent(
	profile: ResumeProfile,
	section: CompareSectionKey,
): string {
	if (section === "basics") {
		const b = profile.basics;
		if (!b) return "(empty)";
		return [
			b.name && `Name: ${b.name}`,
			b.headline && `Headline: ${b.headline}`,
			b.summary && `Summary: ${b.summary}`,
			b.location?.city && `Location: ${b.location.city}`,
		]
			.filter(Boolean)
			.join("\n") || "(empty)";
	}

	const sectionData = profile.sections?.[section];
	if (!sectionData) return "(empty)";

	if (section === "experience" && typeof sectionData === "object" && "items" in sectionData) {
		const items = (sectionData as { items?: unknown[] }).items ?? [];
		return items
			.map((item: unknown) => {
				const i = item as Record<string, unknown>;
				return [i.position, i.company, i.date, i.summary].filter(Boolean).join(" | ");
			})
			.join("\n") || "(empty)";
	}

	if (typeof sectionData === "object" && "content" in sectionData) {
		return String((sectionData as { content?: unknown }).content ?? "(empty)");
	}

	if (typeof sectionData === "object" && "items" in sectionData) {
		const items = (sectionData as { items?: unknown[] }).items ?? [];
		return items
			.map((item: unknown) => {
				const i = item as Record<string, unknown>;
				return Object.values(i).filter((v) => typeof v === "string").join(" | ");
			})
			.join("\n") || "(empty)";
	}

	return "(empty)";
}

function getOtherSectionContent(
	profile: NormalisedCompareProfile,
	section: CompareSectionKey,
): string {
	if (section === "basics") {
		const b = profile.basics;
		return [
			b.name && `Name: ${b.name}`,
			b.headline && `Headline: ${b.headline}`,
			b.summary && `Summary: ${b.summary}`,
			b.location && `Location: ${b.location}`,
		]
			.filter(Boolean)
			.join("\n") || "(empty)";
	}

	const items = profile.sections[section as keyof typeof profile.sections];
	if (!items || (Array.isArray(items) && items.length === 0)) return "(empty)";

	return (items as Record<string, unknown>[])
		.map((item) =>
			Object.values(item)
				.filter((v) => typeof v === "string" || Array.isArray(v))
				.map((v) => (Array.isArray(v) ? v.join(", ") : String(v)))
				.join(" | "),
		)
		.join("\n");
}

function buildEvaluationPrompt(
	section: CompareSectionKey,
	ownContent: string,
	otherContent: string,
	jobDescription?: string,
): string {
	const jobContext = jobDescription
		? `\n\nJob context for evaluation:\n${jobDescription.slice(0, 2000)}`
		: "";

	return `Compare the "${section}" section of two professional profiles. Determine which profile's section is stronger.

Profile A (Own Profile) — ${section}:
${ownContent.slice(0, 2000)}

Profile B (Other Profile) — ${section}:
${otherContent.slice(0, 2000)}
${jobContext}

Evaluate which profile's "${section}" section is stronger. Consider depth, specificity, relevance${jobDescription ? " to the job description" : ""}, and overall quality.

Return "stronger" if Profile A is better, "weaker" if Profile B is better, or "comparable" if they are roughly equal.
The rationale must be plain text, 60 words or fewer.`;
}

export async function* evaluateSections(
	ownProfile: ResumeProfile,
	otherProfile: NormalisedCompareProfile,
	jobDescription?: string,
): AsyncGenerator<SectionEvaluation> {
	const model = await resolveLlmModel("scoring");
	const llm = await createConfiguredLlmService("scoring");

	for (const section of COMPARE_SECTIONS) {
		try {
			const ownContent = getOwnSectionContent(ownProfile, section);
			const otherContent = getOtherSectionContent(otherProfile, section);

			if (ownContent === "(empty)" && otherContent === "(empty)") {
				yield { section, verdict: "comparable", rationale: "Both profiles have no content in this section." };
				continue;
			}

			const prompt = buildEvaluationPrompt(section, ownContent, otherContent, jobDescription);

			const result = await llm.callJson<{ verdict: string; rationale: string }>({
				model,
				messages: [
					{
						role: "system",
						content: "You are a professional profile comparison assistant. Return structured JSON.",
					},
					{ role: "user", content: prompt },
				],
				jsonSchema: SECTION_EVAL_SCHEMA,
			});

			if (result.success && result.data) {
				let verdict: SectionVerdict = "comparable";
				if (VALID_VERDICTS.has(result.data.verdict as SectionVerdict)) {
					verdict = result.data.verdict as SectionVerdict;
				} else {
					logger.warn("Unexpected verdict from LLM, clamping to 'comparable'", {
						section,
						rawVerdict: result.data.verdict,
					});
				}
				yield {
					section,
					verdict,
					rationale: result.data.rationale?.slice(0, 300) ?? "",
				};
			} else {
				logger.warn("LLM evaluation failed for section", { section, error: result.error });
				yield { section, verdict: "comparable", rationale: "Evaluation unavailable." };
			}
		} catch (error) {
			logger.error("Error evaluating section", {
				section,
				error: error instanceof Error ? error.message : String(error),
			});
			yield { section, verdict: "comparable", rationale: "Evaluation failed." };
		}
	}
}
