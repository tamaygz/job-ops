import * as settingsRepo from "@server/repositories/settings";
import { settingsRegistry } from "@shared/settings-registry";

export type InvestigatorGatherSettings = {
  sourceProviders: string[];
  peopleProviders: string[];
  salaryProviders: string[];
};

function shouldRestoreLegacyWebSearchSource(input: {
  sourceProviders: string[];
  rawSourceProviders: string | null;
  rawWebSearchProviders: string | null;
}): boolean {
  if (!input.rawSourceProviders || !input.rawWebSearchProviders) {
    return false;
  }

  const lower = input.sourceProviders.map((value) => value.toLowerCase());
  const hasWebSearchSource =
    lower.includes("web_search") || lower.includes("bing_search");
  if (hasWebSearchSource) {
    return false;
  }

  const hasLegacyPair =
    input.sourceProviders.length === 2 &&
    lower.includes("linked_jobs") &&
    lower.includes("company_site");

  if (!hasLegacyPair) {
    return false;
  }

  const configuredWebSearchProviders =
    settingsRegistry.webSearchProviders.parse(
      input.rawWebSearchProviders ?? undefined,
    ) ?? [];

  return configuredWebSearchProviders.length > 0;
}

export async function loadInvestigatorGatherSettings(): Promise<
  InvestigatorGatherSettings
> {
  const [
    rawSourceProviders,
    rawPeopleProviders,
    rawSalaryProviders,
    rawWebSearchProviders,
  ] = await Promise.all([
    settingsRepo.getSetting("investigatorSourceProviders"),
    settingsRepo.getSetting("investigatorPeopleProviders"),
    settingsRepo.getSetting("investigatorSalaryProviders"),
    settingsRepo.getSetting("webSearchProviders"),
  ]);

  const parsedSourceProviders =
    settingsRegistry.investigatorSourceProviders.parse(
      rawSourceProviders ?? undefined,
    ) ?? settingsRegistry.investigatorSourceProviders.default();

  const sourceProviders = shouldRestoreLegacyWebSearchSource({
    sourceProviders: parsedSourceProviders,
    rawSourceProviders,
    rawWebSearchProviders,
  })
    ? [...parsedSourceProviders, "web_search"]
    : parsedSourceProviders;

  return {
    sourceProviders,
    peopleProviders:
      settingsRegistry.investigatorPeopleProviders.parse(
        rawPeopleProviders ?? undefined,
      ) ?? settingsRegistry.investigatorPeopleProviders.default(),
    salaryProviders:
      settingsRegistry.investigatorSalaryProviders.parse(
        rawSalaryProviders ?? undefined,
      ) ?? settingsRegistry.investigatorSalaryProviders.default(),
  };
}
