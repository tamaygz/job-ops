import type { WebSearchProvider, WebSearchProviderId } from "../types";
import { bingProvider } from "./bing";
import { braveProvider } from "./brave";
import { searxngProvider } from "./searxng";

const PROVIDERS: WebSearchProvider[] = [
  bingProvider,
  searxngProvider,
  braveProvider,
];

export const webSearchProvidersById: Record<
  WebSearchProviderId,
  WebSearchProvider
> = PROVIDERS.reduce(
  (acc, provider) => {
    acc[provider.id] = provider;
    return acc;
  },
  {} as Record<WebSearchProviderId, WebSearchProvider>,
);

export const webSearchProviders = PROVIDERS;
