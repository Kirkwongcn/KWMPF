import { describe, expect, it } from "vitest";
import {
  comparisonGroupFor,
  comparisonGroupSourceOf,
} from "../src/comparison-group";

describe("comparison group", () => {
  it("uses the Lipper category as the primary comparison group", () => {
    expect(
      comparisonGroupFor({
        lipperCategory: "Hong Kong Equity",
        fundType: "Equity Fund - Hong Kong Equity Fund",
        fundCategory: "Equity Fund (Hong Kong)",
      }),
    ).toEqual({ name: "Hong Kong Equity", source: "lipper" });
  });

  it("never merges an unclassified fund into a same-named Lipper category", () => {
    const lipper = comparisonGroupFor({ lipperCategory: "Guaranteed Fund" });
    const platform = comparisonGroupFor({ fundType: "Guaranteed Fund" });

    expect(platform.source).toBe("platform");
    expect(platform.name).not.toBe(lipper.name);
  });

  it("falls back to the platform descriptor when no fund type is published", () => {
    expect(
      comparisonGroupFor({ fundCategory: "Equity Fund (North America)" }),
    ).toEqual({
      name: "平台分類：Equity Fund (North America)",
      source: "platform",
    });
  });

  it("labels a fund with neither classification rather than dropping it", () => {
    expect(comparisonGroupFor({})).toEqual({
      name: "平台分類：未分類",
      source: "platform",
    });
  });

  it("recovers the source from a group name alone", () => {
    expect(comparisonGroupSourceOf("Hong Kong Equity")).toBe("lipper");
    expect(comparisonGroupSourceOf("平台分類：Bond Fund")).toBe("platform");
  });
});
