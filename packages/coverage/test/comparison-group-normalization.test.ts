import { describe, expect, it } from "vitest";
import { normalizeComparisonProfile } from "../src/comparison-group";

describe("comparison profile normalization", () => {
  it("normalizes presentation-only differences", () => {
    expect(normalizeComparisonProfile("Mixed Assets Fund – Global [Maximum Equity: 65%]"))
      .toBe("mixed assets fund - global maximum equity 65%");
  });

  it("does not erase substantive allocation numbers", () => {
    expect(normalizeComparisonProfile("Maximum equity 65%")).not.toBe(
      normalizeComparisonProfile("Maximum equity 25%"),
    );
  });
});
