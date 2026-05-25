import { logger } from "@infra/logger";
import { sanitizeError } from "@infra/sanitize";
import type { InvestigatorGatherContext } from "../types";
import { sourceTextPeopleProvider } from "./sourceTextProvider";

const log = logger.child({ service: "investigatorPeople" });

const PEOPLE_PROVIDERS = [sourceTextPeopleProvider];

function resolveEnabledProviders(context: InvestigatorGatherContext) {
  const enabled = new Set(
    context.settings.peopleProviders.map((value) => value.toLowerCase()),
  );
  return PEOPLE_PROVIDERS.filter((provider) =>
    enabled.has(provider.id.toLowerCase()),
  );
}

export async function runPeopleProviders(
  context: InvestigatorGatherContext,
): Promise<{ createdCount: number; failures: string[] }> {
  const providers = resolveEnabledProviders(context);
  const failures: string[] = [];
  let createdCount = 0;

  if (providers.length === 0) {
    log.info("No people providers enabled", {
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
        phase: "people",
        message: result.message ?? `${provider.displayName} complete`,
      });
    } catch (error) {
      failures.push(provider.id);
      context.reportProgress({
        runId: context.runId,
        dossierId: context.dossierId,
        status: "running",
        phase: "people",
        message: `${provider.displayName} failed`,
      });
      log.warn("People provider failed", {
        runId: context.runId,
        dossierId: context.dossierId,
        provider: provider.id,
        error: sanitizeError(error instanceof Error ? error : new Error(String(error))),
      });
    }
  }

  return { createdCount, failures };
}
