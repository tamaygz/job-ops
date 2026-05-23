/**
 * Client API functions for the Profile Compare feature.
 */

import type {
	CompareSectionKey,
	NormalisedCompareProfile,
	SectionEvaluation,
} from "@shared/types";
import { fetchApi, streamSseEvents } from "./core";

export async function scrapeProfile(
	url: string,
): Promise<NormalisedCompareProfile> {
	return fetchApi<NormalisedCompareProfile>("/compare/scrape", {
		method: "POST",
		body: JSON.stringify({ url }),
	});
}

export type CompareEvaluationEvent =
	| ({ type: "section_eval" } & SectionEvaluation)
	| { type: "overall_scores"; ownScore: number; otherScore: number }
	| { type: "done" }
	| { type: "error"; code: string; message: string };

export async function streamEvaluate(
	otherProfileUrl: string,
	jobId?: string | null,
	handlers?: {
		onEvent: (event: CompareEvaluationEvent) => void;
		signal?: AbortSignal;
	},
): Promise<void> {
	if (!handlers) return;

	return streamSseEvents<CompareEvaluationEvent>(
		"/compare/evaluate",
		{
			otherProfileUrl,
			jobId: jobId ?? undefined,
			stream: true,
		} as Parameters<typeof streamSseEvents>[1],
		{
			onEvent: handlers.onEvent,
			signal: handlers.signal,
		},
	);
}

export async function applySectionApi(
	otherProfileUrl: string,
	section: CompareSectionKey,
	action: "copy" | "copy_rewrite",
): Promise<{ updatedSection: string }> {
	return fetchApi<{ updatedSection: string }>("/compare/apply", {
		method: "POST",
		body: JSON.stringify({ otherProfileUrl, section, action }),
	});
}
