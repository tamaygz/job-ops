import * as settingsRepo from "@server/repositories/settings";
import { settingsRegistry } from "@shared/settings-registry";

export type InvestigatorGatherSettings = {
  sourceProviders: string[];
  peopleProviders: string[];
  salaryProviders: string[];
  bingSearchApiKey: string | null;
  bingSearchEndpoint: string;
  bingSearchMarket: string;
  bingSearchResultLimit: number;
};

export async function loadInvestigatorGatherSettings(): Promise<
  InvestigatorGatherSettings
> {
  const [
    rawSourceProviders,
    rawPeopleProviders,
    rawSalaryProviders,
    rawBingApiKey,
    rawBingEndpoint,
    rawBingMarket,
    rawBingLimit,
  ] = await Promise.all([
    settingsRepo.getSetting("investigatorSourceProviders"),
    settingsRepo.getSetting("investigatorPeopleProviders"),
    settingsRepo.getSetting("investigatorSalaryProviders"),
    settingsRepo.getSetting("investigatorBingSearchApiKey"),
    settingsRepo.getSetting("investigatorBingSearchEndpoint"),
    settingsRepo.getSetting("investigatorBingSearchMarket"),
    settingsRepo.getSetting("investigatorBingSearchResultLimit"),
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
    bingSearchApiKey:
      settingsRegistry.investigatorBingSearchApiKey.parse(
        rawBingApiKey ?? undefined,
      ) ?? settingsRegistry.investigatorBingSearchApiKey.default(),
    bingSearchEndpoint:
      settingsRegistry.investigatorBingSearchEndpoint.parse(
        rawBingEndpoint ?? undefined,
      ) ?? settingsRegistry.investigatorBingSearchEndpoint.default(),
    bingSearchMarket:
      settingsRegistry.investigatorBingSearchMarket.parse(
        rawBingMarket ?? undefined,
      ) ?? settingsRegistry.investigatorBingSearchMarket.default(),
    bingSearchResultLimit:
      settingsRegistry.investigatorBingSearchResultLimit.parse(
        rawBingLimit ?? undefined,
      ) ?? settingsRegistry.investigatorBingSearchResultLimit.default(),
  };
}
