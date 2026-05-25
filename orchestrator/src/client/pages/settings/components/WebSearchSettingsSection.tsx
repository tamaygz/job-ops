import { SettingsInput } from "@client/pages/settings/components/SettingsInput";
import { SettingsSectionFrame } from "@client/pages/settings/components/SettingsSectionFrame";
import type { WebSearchValues } from "@client/pages/settings/types";
import { formatSecretHint } from "@client/pages/settings/utils";
import type { UpdateSettingsInput } from "@shared/settings-schema.js";
import type { WebSearchProviderId } from "@shared/types.js";
import type React from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const PROVIDER_OPTIONS: Array<{
  id: WebSearchProviderId;
  label: string;
  description: string;
}> = [
  {
    id: "bing",
    label: "Bing Search",
    description: "Microsoft Bing Web Search API.",
  },
  {
    id: "searxng",
    label: "SearXNG",
    description: "Self-hosted meta-search instance (JSON API).",
  },
  {
    id: "brave",
    label: "Brave Search",
    description: "Brave Search API via subscription token.",
  },
];

function normalizeProviderList(
  value: WebSearchProviderId[] | null | undefined,
): WebSearchProviderId[] {
  const current = new Set(value ?? []);
  return PROVIDER_OPTIONS.filter((option) => current.has(option.id)).map(
    (option) => option.id,
  );
}

function toggleProvider(
  current: WebSearchProviderId[],
  providerId: WebSearchProviderId,
): WebSearchProviderId[] {
  const next = new Set(current);
  if (next.has(providerId)) {
    next.delete(providerId);
  } else {
    next.add(providerId);
  }
  return PROVIDER_OPTIONS.filter((option) => next.has(option.id)).map(
    (option) => option.id,
  );
}

type WebSearchSettingsSectionProps = {
  values: WebSearchValues;
  isLoading: boolean;
  isSaving: boolean;
  layoutMode?: "accordion" | "panel";
};

export const WebSearchSettingsSection: React.FC<
  WebSearchSettingsSectionProps
> = ({ values, isLoading, isSaving, layoutMode }) => {
  const { control, setValue } = useFormContext<UpdateSettingsInput>();
  const selectedProviders = normalizeProviderList(
    useWatch({ control, name: "webSearchProviders" }) ??
      values.providers.default,
  );
  const disabled = isLoading || isSaving;

  return (
    <SettingsSectionFrame
      mode={layoutMode}
      title="Web Search"
      value="web-search"
    >
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Choose which search providers feed investigator web research. Provider
          order controls result priority.
        </p>

        <div className="space-y-2">
          <div className="text-sm font-medium">Providers</div>
          <div className="grid gap-3 md:grid-cols-3">
            {PROVIDER_OPTIONS.map((provider) => {
              const checked = selectedProviders.includes(provider.id);
              return (
                <label
                  key={provider.id}
                  className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => {
                      const next = toggleProvider(
                        selectedProviders,
                        provider.id,
                      );
                      setValue("webSearchProviders", next, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                      if (value === false && next.length === 0) {
                        setValue("webSearchProviders", [], {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }
                    }}
                    disabled={disabled}
                  />
                  <div className="space-y-1">
                    <div className="font-medium">{provider.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {provider.description}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground">
            Effective: {values.providers.effective.join(", ") || "none"} | Default: {values.providers.default.join(", ") || "none"}
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          <Controller
            name="webSearchResultLimit"
            control={control}
            render={({ field }) => (
              <SettingsInput
                label="Results Per Provider"
                type="number"
                inputProps={{
                  ...field,
                  inputMode: "numeric",
                  min: 1,
                  max: 25,
                  step: 1,
                  value: field.value ?? values.resultLimit.default,
                  onChange: (event) => {
                    const parsed = parseInt(event.target.value, 10);
                    field.onChange(
                      Number.isNaN(parsed)
                        ? null
                        : Math.min(25, Math.max(1, parsed)),
                    );
                  },
                }}
                disabled={disabled}
                helper="Caps how many results are pulled from each provider."
                current={`Effective: ${values.resultLimit.effective} | Default: ${values.resultLimit.default}`}
              />
            )}
          />

          <Controller
            name="webSearchMarket"
            control={control}
            render={({ field }) => (
              <SettingsInput
                label="Market / Locale"
                inputProps={{
                  ...field,
                  value: field.value ?? values.market.default,
                  onChange: (event) => field.onChange(event.target.value),
                }}
                disabled={disabled}
                placeholder="en-US"
                helper="Used for Bing and Brave language/region targeting."
                current={`Effective: ${values.market.effective} | Default: ${values.market.default}`}
              />
            )}
          />
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="text-sm font-semibold">Bing</div>
          <div className="grid gap-4 md:grid-cols-2">
            <Controller
              name="webSearchBingApiKey"
              control={control}
              render={({ field }) => (
                <SettingsInput
                  label="Bing API Key"
                  type="password"
                  inputProps={{
                    ...field,
                    value: field.value ?? "",
                    onChange: (event) => field.onChange(event.target.value),
                  }}
                  disabled={disabled}
                  helper="Uses Ocp-Apim-Subscription-Key header."
                  current={`Current: ${formatSecretHint(values.bingApiKeyHint)}`}
                />
              )}
            />

            <Controller
              name="webSearchBingEndpoint"
              control={control}
              render={({ field }) => (
                <SettingsInput
                  label="Bing Endpoint"
                  inputProps={{
                    ...field,
                    value: field.value ?? values.bingEndpoint.default,
                    onChange: (event) => field.onChange(event.target.value),
                  }}
                  disabled={disabled}
                  placeholder={values.bingEndpoint.default}
                  helper="Default: https://api.bing.microsoft.com/v7.0/search"
                  current={`Effective: ${values.bingEndpoint.effective}`}
                />
              )}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="text-sm font-semibold">SearXNG</div>
          <div className="grid gap-4 md:grid-cols-2">
            <Controller
              name="webSearchSearxngBaseUrl"
              control={control}
              render={({ field }) => (
                <SettingsInput
                  label="SearXNG Base URL"
                  inputProps={{
                    ...field,
                    value: field.value ?? values.searxngBaseUrl.default,
                    onChange: (event) => field.onChange(event.target.value),
                  }}
                  disabled={disabled}
                  placeholder="https://searx.example.com"
                  helper="Base URL for your SearXNG instance (no /search needed)."
                  current={`Effective: ${values.searxngBaseUrl.effective || "Not set"}`}
                />
              )}
            />

            <Controller
              name="webSearchSearxngApiKey"
              control={control}
              render={({ field }) => (
                <SettingsInput
                  label="SearXNG API Key"
                  type="password"
                  inputProps={{
                    ...field,
                    value: field.value ?? "",
                    onChange: (event) => field.onChange(event.target.value),
                  }}
                  disabled={disabled}
                  helper="Sent as X-API-Key header when configured."
                  current={`Current: ${formatSecretHint(values.searxngApiKeyHint)}`}
                />
              )}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="text-sm font-semibold">Brave</div>
          <div className="grid gap-4 md:grid-cols-2">
            <Controller
              name="webSearchBraveApiKey"
              control={control}
              render={({ field }) => (
                <SettingsInput
                  label="Brave API Key"
                  type="password"
                  inputProps={{
                    ...field,
                    value: field.value ?? "",
                    onChange: (event) => field.onChange(event.target.value),
                  }}
                  disabled={disabled}
                  helper="Uses X-Subscription-Token header."
                  current={`Current: ${formatSecretHint(values.braveApiKeyHint)}`}
                />
              )}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium">Brave Notes</label>
              <div className="text-xs text-muted-foreground">
                Brave Search requires a subscription token. Keep your result
                limit within 1-20 for best compatibility.
              </div>
              <Input disabled value="https://api.search.brave.com/res/v1/web/search" />
            </div>
          </div>
        </div>
      </div>
    </SettingsSectionFrame>
  );
};
