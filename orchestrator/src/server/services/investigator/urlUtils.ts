const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

const BARE_HOST_RE =
  /^(?:www\.|localhost(?::\d+)?(?:[/?#]|$)|(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:[/?#]|$)|(?:[a-z0-9-]+\.)+[a-z0-9-]{2,}(?::\d+)?(?:[/?#]|$))/i;

function toCandidateUrl(input: string): string {
  if (input.startsWith("//")) {
    return `https:${input}`;
  }

  if (!/^[a-z][a-z\d+.-]*:/i.test(input) && BARE_HOST_RE.test(input)) {
    return `https://${input}`;
  }

  return input;
}

export function normalizeHttpUrl(input: string | null | undefined): URL | null {
  const trimmed = input?.trim();
  if (!trimmed) return null;

  const candidate = toCandidateUrl(trimmed);

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
    return null;
  }

  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";
  return parsed;
}

export function normalizeHttpUrlString(
  input: string | null | undefined,
): string | null {
  return normalizeHttpUrl(input)?.toString() ?? null;
}

export function extractNormalizedHostname(
  input: string | null | undefined,
): string | null {
  const hostname = normalizeHttpUrl(input)?.hostname;
  if (!hostname) return null;
  return hostname.replace(/^www\./, "");
}

export function buildCompanySiteCandidateUrls(
  input: string | null | undefined,
  paths: readonly string[],
): string[] {
  const normalized = normalizeHttpUrl(input);
  if (!normalized) return [];

  const siteRoot = new URL("/", normalized);
  const urls = new Set<string>();

  for (const path of paths) {
    urls.add(new URL(path, siteRoot).toString());
  }

  return Array.from(urls);
}
