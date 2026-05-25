import { describe, expect, it } from "vitest";

import {
  buildCompanySiteCandidateUrls,
  extractNormalizedHostname,
  normalizeHttpUrlString,
} from "./urlUtils";

describe("investigator urlUtils", () => {
  it("normalizes bare company domains to https", () => {
    expect(normalizeHttpUrlString("example.com")).toBe("https://example.com/");
    expect(normalizeHttpUrlString("www.example.com/careers")).toBe(
      "https://www.example.com/careers",
    );
  });

  it("normalizes protocol-relative company URLs", () => {
    expect(normalizeHttpUrlString("//example.com/about")).toBe(
      "https://example.com/about",
    );
  });

  it("rejects non-http protocols and invalid input", () => {
    expect(normalizeHttpUrlString("mailto:jobs@example.com")).toBeNull();
    expect(normalizeHttpUrlString("not a url")).toBeNull();
    expect(normalizeHttpUrlString("   ")).toBeNull();
  });

  it("extracts a normalized hostname for bare host inputs", () => {
    expect(extractNormalizedHostname("www.example.com/jobs")).toBe(
      "example.com",
    );
  });

  it("builds company-site candidates from the site root instead of a deep path", () => {
    expect(
      buildCompanySiteCandidateUrls("example.com/careers/role-123", [
        "",
        "/about",
        "/jobs",
      ]),
    ).toEqual([
      "https://example.com/",
      "https://example.com/about",
      "https://example.com/jobs",
    ]);
  });
});