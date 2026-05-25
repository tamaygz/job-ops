import { logger } from "@infra/logger";
import { sanitizeError } from "@infra/sanitize";
import type { InvestigatorGatherContext } from "../types";
import { jobMetadataSalaryProvider } from "./jobMetadataProvider";
import { sourceTextSalaryProvider } from "./sourceTextProvider";

const log = logger.child({ service: "investigatorSalary" });

const SALARY_PROVIDERS = [jobMetadataSalaryProvider, sourceTextSalaryProvider];

function resolveEnabledProviders(context: InvestigatorGatherContext) {
  const enabled = new Set(
    context.settings.salaryProviders.map((value) => value.toLowerCase()),
  );
  return SALARY_PROVIDERS.filter((provider) =>
    enabled.has(provider.id.toLowerCase()),
  );
}

export async function runSalaryProviders(
  context: InvestigatorGatherContext,
): Promise<{ createdCount: number; failures: string[] }> {
  const providers = resolveEnabledProviders(context);
  const failures: string[] = [];
  let createdCount = 0;

  if (providers.length === 0) {
    log.info("No salary providers enabled", {
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
        phase: "salary",
        message: result.message ?? `${provider.displayName} complete`,
      });
    } catch (error) {
      failures.push(provider.id);
      context.reportProgress({
        runId: context.runId,
        dossierId: context.dossierId,
        status: "running",
        phase: "salary",
        message: `${provider.displayName} failed`,
      });
      log.warn("Salary provider failed", {
        runId: context.runId,
        dossierId: context.dossierId,
        provider: provider.id,
        error: sanitizeError(error instanceof Error ? error : new Error(String(error))),
      });
    }
  }

  return { createdCount, failures };
}
