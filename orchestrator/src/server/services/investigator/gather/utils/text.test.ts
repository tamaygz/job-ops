import { describe, expect, it } from "vitest";
import { extractSalaryRanges } from "./text";

describe("extractSalaryRanges", () => {
  it("does not duplicate single-amount matches inside range matches", () => {
    const matches = extractSalaryRanges(
      "Compensation range is $120k - $150k per year.",
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      currency: "USD",
      minAmount: 120,
      maxAmount: 150,
      payInterval: null,
    });
  });

  it("still captures standalone salary amounts", () => {
    const matches = extractSalaryRanges(
      "This role pays $95k per year with bonus.",
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      currency: "USD",
      minAmount: 95,
      maxAmount: 95,
      payInterval: "annual",
    });
  });
});
