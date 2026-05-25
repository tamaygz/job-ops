export type WebSearchProviderId = "bing" | "searxng" | "brave";

export type WebSearchResult = {
  providerId: WebSearchProviderId;
  title: string;
  url: string | null;
  snippet: string | null;
  rank: number | null;
};

export type WebSearchProviderResult = {
  status: "success" | "skipped" | "failed";
  message?: string;
  results?: WebSearchResult[];
};

export type WebSearchSettings = {
  providers: WebSearchProviderId[];
  resultLimit: number;
  market: string;
  bingApiKey: string | null;
  bingEndpoint: string;
  searxngBaseUrl: string | null;
  searxngApiKey: string | null;
  braveApiKey: string | null;
};

export type WebSearchProvider = {
  id: WebSearchProviderId;
  displayName: string;
  search: (
    query: string,
    settings: WebSearchSettings,
  ) => Promise<WebSearchProviderResult>;
};
