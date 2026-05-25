import * as settingsRepo from "@server/repositories/settings";
import { settingsRegistry } from "@shared/settings-registry";

export type InvestigatorGatherSettings = {
  sourceProviders: string[];
  peopleProviders: string[];
  salaryProviders: string[];
};

export async function loadInvestigatorGatherSettings(): Promise<InvestigatorGatherSettings> {
  const [rawSourceProviders, rawPeopleProviders, rawSalaryProviders] =
    await Promise.all([
      settingsRepo.getSetting("investigatorSourceProviders"),
      settingsRepo.getSetting("investigatorPeopleProviders"),
      settingsRepo.getSetting("investigatorSalaryProviders"),
    ]);

  return {
    sourceProviders:
      settingsRegistry.investigatorSourceProviders.parse(
        rawSourceProviders ?? undefined,
      ) ?? settingsRegistry.investigatorSourceProviders.default(),
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
