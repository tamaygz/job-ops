import { requestTimeout } from "@infra/errors";
import { JSDOM } from "jsdom";

export type PageTextContent = {
  title: string;
  description: string;
  text: string;
};

const BLOCKED_HOSTS = ["linkedin.com", "indeed.com"] as const;

function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isBlockedHost(url: string): boolean {
  const hostname = getHostname(url);
  if (!hostname) return false;
  return BLOCKED_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

export async function fetchPageText(
  url: string,
  opts: { timeoutMs?: number; maxChars?: number } = {},
): Promise<PageTextContent | null> {
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxChars = opts.maxChars ?? 40_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const extracted = extractTextFromHtml(html);
    if (!extracted.text) return null;

    return {
      title: extracted.title,
      description: extracted.description,
      text: extracted.text.slice(0, maxChars),
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "AbortError"
    ) {
      throw requestTimeout(
        `Investigator fetch timed out after ${timeoutMs}ms for ${url}.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function extractTextFromHtml(html: string): PageTextContent {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const title = document.querySelector("title")?.textContent?.trim() ?? "";
  const description =
    document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content")
      ?.trim() ?? "";

  const elementsToRemove = document.querySelectorAll(
    "script, style, nav, header, footer, aside, iframe, noscript, " +
      '[role="navigation"], [role="banner"], [role="contentinfo"], ' +
      ".nav, .navbar, .header, .footer, .sidebar, .menu, .cookie, .popup, .modal, .ad, .advertisement",
  );
  elementsToRemove.forEach((el) => {
    el.remove();
  });

  const mainContent =
    document.querySelector(
      'main, [role="main"], article, ' +
        ".content, .post, .article, .story, .press-release, .team, .about, .careers, " +
        "#content, #main, #about, #team, #careers",
    ) || document.body;

  let text = mainContent?.textContent || "";
  text = text
    .replace(/[\t ]+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, description, text };
}
