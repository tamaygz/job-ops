import { describe, expect, it } from "vitest";
import { normalizeCanonicalKey } from "./dossierService";

describe("normalizeCanonicalKey", () => {
  it("strips punctuation and lowercases", () => {
    expect(normalizeCanonicalKey("Acme, Inc.")).toBe("acme inc");
  });

  it("trims leading and trailing whitespace and uppercases", () => {
    expect(normalizeCanonicalKey("  GOOGLE LLC  ")).toBe("google llc");
  });

  it("handles multi-word names with comma and period", () => {
    expect(normalizeCanonicalKey("Meta Platforms, Inc.")).toBe(
      "meta platforms inc",
    );
  });

  it("passes through a plain single word", () => {
    expect(normalizeCanonicalKey("DeepMind")).toBe("deepmind");
  });

  it("strips non-word characters like +", () => {
    expect(normalizeCanonicalKey("C++ Corp")).toBe("c corp");
  });

  it("returns empty string for blank input", () => {
    expect(normalizeCanonicalKey("")).toBe("");
    expect(normalizeCanonicalKey("   ")).toBe("");
  });

  it("collapses multiple internal spaces", () => {
    expect(normalizeCanonicalKey("Foo   Bar")).toBe("foo bar");
  });

  it("strips apostrophes and quotes", () => {
    expect(normalizeCanonicalKey("O'Reilly Media")).toBe("oreilly media");
  });
});