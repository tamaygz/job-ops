import type { PayInterval, PersonType } from "@shared/types";

export type PersonCandidate = {
  fullName: string;
  title: string;
};

export type SalaryRange = {
  minAmount: number | null;
  maxAmount: number | null;
  currency: string | null;
  payInterval: PayInterval | null;
};

const TITLE_KEYWORDS = [
  "ceo",
  "cto",
  "cfo",
  "coo",
  "chief",
  "founder",
  "co-founder",
  "president",
  "vp",
  "vice president",
  "director",
  "head",
  "lead",
  "manager",
  "hiring",
  "recruiter",
  "talent",
  "engineering",
  "product",
  "people",
] as const;

const NAME_TITLE_REGEX =
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*(?:-|,|–|—|\(|\|)\s*([^\n\r]{3,80})/g;

const TITLE_PREFIX_REGEX =
  /(CEO|CTO|CFO|COO|Chief[^\n,]{0,40}|Founder|Co-Founder|President|VP|Vice President|Director|Head|Manager|Recruiter|Talent|Hiring Manager)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/gi;

export function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars).trimEnd();
}

export function normalizeWhitespace(value: string): string {
  return value
    .replace(/[\t ]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .trim();
}

export function extractPeopleCandidates(text: string): PersonCandidate[] {
  const candidates: PersonCandidate[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(NAME_TITLE_REGEX)) {
    const fullName = match[1]?.trim() ?? "";
    const title = match[2]?.trim() ?? "";
    if (!fullName || !title) continue;
    if (!looksLikePersonTitle(title)) continue;

    const key = `${fullName.toLowerCase()}|${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ fullName, title });
  }

  for (const match of text.matchAll(TITLE_PREFIX_REGEX)) {
    const title = match[1]?.trim() ?? "";
    const fullName = match[2]?.trim() ?? "";
    if (!fullName || !title) continue;
    if (!looksLikePersonTitle(title)) continue;

    const key = `${fullName.toLowerCase()}|${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ fullName, title });
  }

  return candidates;
}

function looksLikePersonTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return TITLE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export function inferPersonType(title: string): PersonType {
  const lower = title.toLowerCase();
  if (lower.includes("founder")) return "founder";
  if (lower.includes("recruit") || lower.includes("talent")) {
    return "recruiter";
  }
  if (lower.includes("hiring manager") || lower.includes("hiring")) {
    return "hiring_manager";
  }
  if (lower.includes("interviewer")) return "interviewer";
  if (
    lower.includes("chief") ||
    lower.includes("ceo") ||
    lower.includes("cto") ||
    lower.includes("cfo") ||
    lower.includes("coo") ||
    lower.includes("vp") ||
    lower.includes("director") ||
    lower.includes("head")
  ) {
    return "executive";
  }
  return "employee";
}

export function extractSalaryRanges(text: string): SalaryRange[] {
  const ranges: SalaryRange[] = [];
  const normalized = text.replace(/\s+/g, " ");
  const matchedRangeSpans: Array<{ start: number; end: number }> = [];

  const rangeRegex =
    /(\$|USD|GBP|EUR)\s*(\d{2,3}(?:[,\d]{0,6})|\d{2,6})(?:\s*[kK])?\s*(?:-|to|–|—)\s*(\$|USD|GBP|EUR)?\s*(\d{2,3}(?:[,\d]{0,6})|\d{2,6})(?:\s*[kK])?/g;

  for (const match of normalized.matchAll(rangeRegex)) {
    if (typeof match.index === "number") {
      matchedRangeSpans.push({
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    const currency = normalizeCurrency(match[1] || match[3]);
    const minAmount = parseMoney(match[2], match[0]);
    const maxAmount = parseMoney(match[4], match[0]);
    ranges.push({
      currency,
      minAmount,
      maxAmount,
      payInterval: inferPayInterval(match[0]),
    });
  }

  const singleRegex =
    /(\$|USD|GBP|EUR)\s*(\d{2,3}(?:[,\d]{0,6})|\d{2,6})(?:\s*[kK])?\s*(per year|yearly|annum|per hour|hourly|per month|monthly)?/g;

  for (const match of normalized.matchAll(singleRegex)) {
    if (
      typeof match.index === "number" &&
      matchedRangeSpans.some(
        (span) =>
          match.index < span.end && match.index + match[0].length > span.start,
      )
    ) {
      continue;
    }

    const currency = normalizeCurrency(match[1]);
    const amount = parseMoney(match[2], match[0]);
    ranges.push({
      currency,
      minAmount: amount,
      maxAmount: amount,
      payInterval: inferPayInterval(match[0]),
    });
  }

  return ranges;
}

function parseMoney(rawNumber: string, context: string): number | null {
  const normalized = rawNumber.replace(/,/g, "");
  let value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return null;
  if (/\b\d{2,3}\b\s*[kK]/.test(context)) {
    value *= 1000;
  }
  return Math.round(value);
}

function normalizeCurrency(raw?: string | null): string | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper.includes("$")) return "USD";
  if (upper.includes("USD")) return "USD";
  if (upper.includes("GBP")) return "GBP";
  if (upper.includes("EUR")) return "EUR";
  return null;
}

export function inferPayInterval(text: string): PayInterval | null {
  const lower = text.toLowerCase();
  if (lower.includes("hour")) return "hourly";
  if (lower.includes("month")) return "monthly";
  if (lower.includes("year") || lower.includes("annum")) return "annual";
  return null;
}
