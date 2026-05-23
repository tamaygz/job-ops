/**
 * Normalises raw LinkedIn HTML into a NormalisedCompareProfile.
 * Extracts structured data from JSON-LD and falls back to CSS-selector heuristics.
 * Strips HTML, truncates fields, and drops contact information.
 */

import { unprocessableEntity } from "@infra/errors";
import { logger } from "@infra/logger";
import type {
  CompareAwardItem,
  CompareCertificationItem,
  CompareEducationItem,
  CompareExperienceItem,
  CompareLanguageItem,
  CompareProjectItem,
  CompareSkillItem,
  NormalisedCompareProfile,
} from "@shared/types";

const MAX_DESCRIPTION_LENGTH = 800;
const MAX_SUMMARY_LENGTH = 600;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function safeString(value: unknown, maxLength?: number): string {
  const raw = typeof value === "string" ? value : "";
  const cleaned = stripHtml(raw);
  return maxLength ? truncate(cleaned, maxLength) : cleaned;
}

function extractJsonLd(html: string): Record<string, unknown> | null {
  const pattern =
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      const parsed = JSON.parse(match[1]);
      if (
        parsed &&
        typeof parsed === "object" &&
        parsed["@type"] === "Person"
      ) {
        return parsed as Record<string, unknown>;
      }
    } catch {}
  }
  return null;
}

function extractName(
  html: string,
  jsonLd: Record<string, unknown> | null,
): string {
  if (jsonLd?.name && typeof jsonLd.name === "string")
    return safeString(jsonLd.name);
  const match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  return match ? safeString(match[1]) : "";
}

function extractHeadline(
  html: string,
  jsonLd: Record<string, unknown> | null,
): string {
  if (jsonLd?.jobTitle && typeof jsonLd.jobTitle === "string")
    return safeString(jsonLd.jobTitle);
  const match =
    /<div[^>]*class="[^"]*top-card-layout__headline[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(
      html,
    );
  return match ? safeString(match[1]) : "";
}

function extractLocation(
  html: string,
  jsonLd: Record<string, unknown> | null,
): string {
  if (jsonLd?.address && typeof jsonLd.address === "object") {
    const addr = jsonLd.address as Record<string, unknown>;
    const parts = [
      addr.addressLocality,
      addr.addressRegion,
      addr.addressCountry,
    ]
      .filter((p) => typeof p === "string" && p.trim())
      .map((p) => safeString(p as string));
    if (parts.length > 0) return parts.join(", ");
  }
  const match =
    /<div[^>]*class="[^"]*top-card-layout__(?:first-)?subline[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(
      html,
    );
  return match ? safeString(match[1]) : "";
}

function extractSummary(
  html: string,
  jsonLd: Record<string, unknown> | null,
): string {
  if (jsonLd?.description && typeof jsonLd.description === "string") {
    return safeString(jsonLd.description, MAX_SUMMARY_LENGTH);
  }
  const match =
    /<section[^>]*class="[^"]*summary[^"]*"[^>]*>([\s\S]*?)<\/section>/i.exec(
      html,
    );
  if (match) return truncate(stripHtml(match[1]), MAX_SUMMARY_LENGTH);
  return "";
}

function extractExperience(html: string): CompareExperienceItem[] {
  const items: CompareExperienceItem[] = [];
  const sectionMatch =
    /<section[^>]*(?:id="experience|class="[^"]*experience)[^>]*>([\s\S]*?)<\/section>/i.exec(
      html,
    );
  if (!sectionMatch) return items;
  const section = sectionMatch[1];

  const itemPattern =
    /<li[^>]*class="[^"]*experience-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  for (const itemMatch of section.matchAll(itemPattern)) {
    const block = itemMatch[1];
    const position = safeString(
      (/<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(block) ?? [])[1] ?? "",
    );
    const company = safeString(
      (/<h4[^>]*>([\s\S]*?)<\/h4>/i.exec(block) ?? [])[1] ??
        (/<p[^>]*class="[^"]*subtitle[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(
          block,
        ) ?? [])[1] ??
        "",
    );
    const period = safeString(
      (/<span[^>]*class="[^"]*date-range[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(
        block,
      ) ?? [])[1] ?? "",
    );
    const description = safeString(
      (/<p[^>]*class="[^"]*(?:description|show-more)[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(
        block,
      ) ?? [])[1] ?? "",
      MAX_DESCRIPTION_LENGTH,
    );
    if (position || company) {
      items.push({ company, position, period, description });
    }
  }
  return items;
}

function extractEducation(html: string): CompareEducationItem[] {
  const items: CompareEducationItem[] = [];
  const sectionMatch =
    /<section[^>]*(?:id="education|class="[^"]*education)[^>]*>([\s\S]*?)<\/section>/i.exec(
      html,
    );
  if (!sectionMatch) return items;
  const section = sectionMatch[1];

  const itemPattern =
    /<li[^>]*class="[^"]*education[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  for (const itemMatch of section.matchAll(itemPattern)) {
    const block = itemMatch[1];
    const school = safeString(
      (/<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(block) ?? [])[1] ?? "",
    );
    const degreeRaw = safeString(
      (/<h4[^>]*>([\s\S]*?)<\/h4>/i.exec(block) ?? [])[1] ??
        (/<span[^>]*class="[^"]*degree[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(
          block,
        ) ?? [])[1] ??
        "",
    );
    const parts = degreeRaw.split(",").map((s) => s.trim());
    const degree = parts[0] ?? "";
    const area = parts.slice(1).join(", ");
    const period = safeString(
      (/<span[^>]*class="[^"]*date-range[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(
        block,
      ) ?? [])[1] ?? "",
    );
    if (school) {
      items.push({ school, degree, area, period });
    }
  }
  return items;
}

function extractSkills(html: string): CompareSkillItem[] {
  const items: CompareSkillItem[] = [];
  const sectionMatch =
    /<section[^>]*(?:id="skills|class="[^"]*skills)[^>]*>([\s\S]*?)<\/section>/i.exec(
      html,
    );
  if (!sectionMatch) return items;
  const section = sectionMatch[1];

  const skillPattern =
    /<span[^>]*class="[^"]*skill-[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  for (const skillMatch of section.matchAll(skillPattern)) {
    const name = safeString(skillMatch[1]);
    if (name) {
      items.push({ name, keywords: [] });
    }
  }

  if (items.length === 0) {
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    for (const liMatch of section.matchAll(liPattern)) {
      const name = safeString(liMatch[1]);
      if (name && name.length < 100) {
        items.push({ name, keywords: [] });
      }
    }
  }
  return items;
}

function extractCertifications(_html: string): CompareCertificationItem[] {
  return [];
}

function extractProjects(_html: string): CompareProjectItem[] {
  return [];
}

function extractLanguages(_html: string): CompareLanguageItem[] {
  return [];
}

function extractAwards(_html: string): CompareAwardItem[] {
  return [];
}

export function normaliseLinkedInHtml(
  html: string,
  sourceUrl: string,
): NormalisedCompareProfile {
  const jsonLd = extractJsonLd(html);
  const name = extractName(html, jsonLd);

  if (!name) {
    logger.warn(
      "LinkedIn normalisation produced no name — likely login-wall or empty page",
      {
        sourceUrl,
      },
    );
    throw unprocessableEntity(
      "Could not extract profile data. The profile may be private or unavailable.",
    );
  }

  const profile: NormalisedCompareProfile = {
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    basics: {
      name,
      headline: extractHeadline(html, jsonLd),
      location: extractLocation(html, jsonLd),
      summary: extractSummary(html, jsonLd),
    },
    sections: {
      experience: extractExperience(html),
      education: extractEducation(html),
      skills: extractSkills(html),
      certifications: extractCertifications(html),
      projects: extractProjects(html),
      languages: extractLanguages(html),
      awards: extractAwards(html),
    },
  };

  return profile;
}
