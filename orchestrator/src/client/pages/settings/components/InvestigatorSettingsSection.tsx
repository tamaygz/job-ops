import { SettingsInput } from "@client/pages/settings/components/SettingsInput";
import { SettingsSectionFrame } from "@client/pages/settings/components/SettingsSectionFrame";
import type { InvestigatorValues } from "@client/pages/settings/types";
import type { UpdateSettingsInput } from "@shared/settings-schema.js";
import type React from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type InvestigatorSettingsSectionProps = {
  values: InvestigatorValues;
  isLoading: boolean;
  isSaving: boolean;
  layoutMode?: "accordion" | "panel";
};

export const InvestigatorSettingsSection: React.FC<
  InvestigatorSettingsSectionProps
> = ({ values, isLoading, isSaving, layoutMode }) => {
  const { control } = useFormContext<UpdateSettingsInput>();

  return (
    <SettingsSectionFrame
      mode={layoutMode}
      title="Investigator"
      value="investigator"
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Configure how dossier summaries choose supporting evidence and how
          the investigator summary prompt is framed.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Controller
            name="investigatorSummarySourceLimit"
            control={control}
            render={({ field }) => (
              <SettingsInput
                label="Sources Per Summary"
                type="number"
                inputProps={{
                  ...field,
                  inputMode: "numeric",
                  min: 1,
                  max: 25,
                  step: 1,
                  value: field.value ?? values.summarySourceLimit.default,
                  onChange: (event) => {
                    const parsed = parseInt(event.target.value, 10);
                    field.onChange(
                      Number.isNaN(parsed)
                        ? null
                        : Math.min(25, Math.max(1, parsed)),
                    );
                  },
                }}
                disabled={isLoading || isSaving}
                helper="How many verified or low-confidence sources the investigator includes in a summary prompt."
                current={`Effective: ${values.summarySourceLimit.effective} | Default: ${values.summarySourceLimit.default}`}
              />
            )}
          />

          <Controller
            name="investigatorSummaryExcerptMaxChars"
            control={control}
            render={({ field }) => (
              <SettingsInput
                label="Excerpt Characters Per Source"
                type="number"
                inputProps={{
                  ...field,
                  inputMode: "numeric",
                  min: 100,
                  max: 2000,
                  step: 50,
                  value: field.value ?? values.excerptMaxChars.default,
                  onChange: (event) => {
                    const parsed = parseInt(event.target.value, 10);
                    field.onChange(
                      Number.isNaN(parsed)
                        ? null
                        : Math.min(2000, Math.max(100, parsed)),
                    );
                  },
                }}
                disabled={isLoading || isSaving}
                helper="Trim each captured excerpt before it is sent to the investigator summary prompt."
                current={`Effective: ${values.excerptMaxChars.effective} | Default: ${values.excerptMaxChars.default}`}
              />
            )}
          />
        </div>

        <Separator />

        <div className="space-y-3">
          <label
            htmlFor="investigatorSummarySystemPromptTemplate"
            className="text-sm font-medium leading-none"
          >
            Summary System Prompt
          </label>
          <Controller
            name="investigatorSummarySystemPromptTemplate"
            control={control}
            render={({ field }) => (
              <div className="space-y-2">
                <Textarea
                  id="investigatorSummarySystemPromptTemplate"
                  value={field.value ?? values.systemPromptTemplate.default}
                  onChange={(event) => field.onChange(event.target.value)}
                  disabled={isLoading || isSaving}
                  maxLength={12000}
                  placeholder="You are an expert business intelligence analyst..."
                />
                <div className="text-xs text-muted-foreground">
                  Overrides the system prompt used when generating investigator
                  summaries.
                </div>
                <div className="text-xs text-muted-foreground">
                  Current: <span className="font-mono">{values.systemPromptTemplate.effective}</span>
                </div>
              </div>
            )}
          />
        </div>
      </div>
    </SettingsSectionFrame>
  );
};