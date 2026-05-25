import { logger } from "@infra/logger";
import { sanitizeError } from "@infra/sanitize";
import type { InvestigatorGatherContext } from "../types";
import { companySiteProvider } from "./companySiteProvider";
import { linkedJobsProvider } from "./linkedJobsProvider";
import { webSearchProvider } from "./webSearchProvider";

const log = logger.child({ service: "investigatorSources" });

const SOURCE_PROVIDERS = [
  linkedJobsProvider,
  companySiteProvider,
  webSearchProvider,
];

const PROVIDER_ALIASES = new Map([[
  "bing_search",
  "web_search",
]]);

function resolveEnabledProviders(context: InvestigatorGatherContext) {
  const enabled = new Set(
    context.settings.sourceProviders.map((value) => value.toLowerCase()),
  );
  for (const [legacy, modern] of PROVIDER_ALIASES) {
    if (enabled.has(legacy)) enabled.add(modern);
  }
  return SOURCE_PROVIDERS.filter((provider) =>
    enabled.has(provider.id.toLowerCase()),
  );
}

export async function runSourceProviders(
  context: InvestigatorGatherContext,
): Promise<{ createdCount: number; failures: string[] }> {
  const providers = resolveEnabledProviders(context);
  const failures: string[] = [];
  let createdCount = 0;

  if (providers.length === 0) {
    log.info("No source providers enabled", {
      runId: context.runId,
      dossierId: context.dossierId,
    });
    return { createdCount, failures };
  }

  for (const provider of providers) {
    try {
      const result = await provider.run(context);
      if (result.status === "failed") {
        failures.push(result.message || provider.id);
      }
      createdCount += result.createdCount ?? 0;

      context.reportProgress({
        runId: context.runId,
        dossierId: context.dossierId,
        status: "running",
        phase: "sources",
        message: result.message ?? `${provider.displayName} complete`,
      });
    } catch (error) {
      failures.push(provider.id);
      context.reportProgress({
        runId: context.runId,
        dossierId: context.dossierId,
        status: "running",
        phase: "sources",
        message: `${provider.displayName} failed`,
      });
      log.warn("Source provider failed", {
        runId: context.runId,
        dossierId: context.dossierId,
        provider: provider.id,
        error: sanitizeError(error instanceof Error ? error : new Error(String(error))),
      });
    }
  }

  return { createdCount, failures };
}
