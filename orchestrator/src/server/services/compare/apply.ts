/**
 * Quick-action service for copying sections from the Other Profile
 * into the user's local Design Resume.
 *
 * - "copy": Verbatim copy of the other profile's section
 * - "copy_rewrite": Copy then LLM rewrite in the user's writing style
 */

import { randomUUID } from "node:crypto";
import { logger } from "@infra/logger";
import {
  requireCurrentDesignResume,
  updateCurrentDesignResume,
} from "@server/services/design-resume";
import { getEffectiveSettings } from "@server/services/settings";
import type {
  CompareSectionKey,
  NormalisedCompareProfile,
} from "@shared/types";
import type { JsonSchemaDefinition } from "../llm/types";
import { createConfiguredLlmService, resolveLlmModel } from "../modelSelection";

const REWRITE_SCHEMA: JsonSchemaDefinition = {
  name: "rewritten_section",
  schema: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "The rewritten section content",
      },
    },
    required: ["content"],
    additionalProperties: false,
  },
};

function sectionToText(
  profile: NormalisedCompareProfile,
  section: CompareSectionKey,
): string {
  if (section === "basics") {
    const b = profile.basics;
    return [b.name, b.headline, b.location, b.summary]
      .filter(Boolean)
      .join("\n");
  }

  const items = profile.sections[section as keyof typeof profile.sections];
  if (!items || !Array.isArray(items)) return "";

  return (items as unknown as Record<string, unknown>[])
    .map((item) =>
      Object.values(item)
        .filter((v) => typeof v === "string" || Array.isArray(v))
        .map((v) => (Array.isArray(v) ? v.join(", ") : String(v)))
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n");
}

async function rewriteWithLlm(
  content: string,
  section: CompareSectionKey,
): Promise<string> {
  const settings = await getEffectiveSettings();
  const tone = settings.chatStyleTone?.value ?? "professional";
  const formality = settings.chatStyleFormality?.value ?? "formal";
  const constraints = settings.chatStyleConstraints?.value ?? "";
  const doNotUse = settings.chatStyleDoNotUse?.value ?? "";

  const model = await resolveLlmModel("tailoring");
  const llm = await createConfiguredLlmService("tailoring");

  const styleContext = [
    `Tone: ${tone}`,
    `Formality: ${formality}`,
    constraints && `Additional constraints: ${constraints}`,
    doNotUse && `Do not use: ${doNotUse}`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await llm.callJson<{ content: string }>({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a professional resume writer. Rewrite the provided section content to match the specified writing style while preserving all factual information.",
      },
      {
        role: "user",
        content: `Rewrite the following "${section}" section content to match this writing style:

${styleContext}

Original content:
${content.slice(0, 3000)}

Preserve all factual information (companies, dates, degrees, skills, etc.) but adapt the language, tone, and phrasing to match the style guidelines above. Return the rewritten content as a single string.`,
      },
    ],
    jsonSchema: REWRITE_SCHEMA,
  });

  if (result.success && result.data?.content) {
    return result.data.content;
  }

  logger.warn("LLM rewrite failed, using original content", {
    section,
    error: result.success ? "No content in response" : result.error,
  });
  return content;
}

function buildSectionPatchOperations(
  section: CompareSectionKey,
  otherProfile: NormalisedCompareProfile,
  rewrittenContent?: string,
): Array<{ op: "replace"; path: string; value: unknown }> {
  const ops: Array<{ op: "replace"; path: string; value: unknown }> = [];

  if (section === "basics") {
    ops.push({
      op: "replace",
      path: "/basics/headline",
      value: otherProfile.basics.headline,
    });
    if (otherProfile.basics.summary) {
      ops.push({
        op: "replace",
        path: "/summary/content",
        value: rewrittenContent ?? otherProfile.basics.summary,
      });
    }
    return ops;
  }

  if (section === "experience") {
    const items = otherProfile.sections.experience.map((exp) => ({
      id: randomUUID(),
      visible: true,
      company: exp.company,
      position: exp.position,
      location: "",
      date: exp.period,
      summary: rewrittenContent ? "" : exp.description,
      url: { label: "", href: "" },
      website: { url: "", label: "" },
    }));
    ops.push({
      op: "replace",
      path: "/sections/experience/items",
      value: items,
    });
    return ops;
  }

  if (section === "education") {
    const items = otherProfile.sections.education.map((edu) => ({
      id: randomUUID(),
      visible: true,
      institution: edu.school,
      studyType: edu.degree,
      area: edu.area,
      date: edu.period,
      summary: "",
      score: "",
      url: { label: "", href: "" },
      website: { url: "", label: "" },
    }));
    ops.push({
      op: "replace",
      path: "/sections/education/items",
      value: items,
    });
    return ops;
  }

  if (section === "skills") {
    const items = otherProfile.sections.skills.map((skill) => ({
      id: randomUUID(),
      visible: true,
      name: skill.name,
      proficiency: "",
      level: 1,
      keywords: skill.keywords,
    }));
    ops.push({ op: "replace", path: "/sections/skills/items", value: items });
    return ops;
  }

  return ops;
}

export async function applySection(
  section: CompareSectionKey,
  action: "copy" | "copy_rewrite",
  otherProfile: NormalisedCompareProfile,
): Promise<void> {
  const current = await requireCurrentDesignResume();
  const content = sectionToText(otherProfile, section);

  let rewrittenContent: string | undefined;
  if (action === "copy_rewrite" && content) {
    rewrittenContent = await rewriteWithLlm(content, section);
  }

  const operations = buildSectionPatchOperations(
    section,
    otherProfile,
    rewrittenContent,
  );

  if (operations.length > 0) {
    await updateCurrentDesignResume({
      baseRevision: current.revision,
      operations,
    });
  }

  logger.info("Applied compare section to Design Resume", {
    section,
    action,
    operationCount: operations.length,
  });
}
