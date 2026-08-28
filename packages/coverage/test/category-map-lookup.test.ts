import { describe, expect, it } from "vitest";
import {
  assertCategoryCoverage,
  toCategoryLookup,
  type CategoryMapFile,
} from "../src/category-map-lookup";

const file: CategoryMapFile = {
  lipperSource: "data/reference/lipper-hk-pension-categories.json",
  lipperCapturedAt: "2026-08-27",
  categoryCount: 25,
  entries: [
    {
      fundClassId: "mpfa-cf-1000",
      lipperCategory: "United States Equity",
      platformFundType: "Equity Fund - United States Equity Fund",
      matchMethod: "auto",
      lipperSourceName: "BOC-Pru Easy-Choice MPF-BOC-Pru N Amer Idx Trkg",
      score: 1,
    },
  ],
  unmappedFundClasses: [
    {
      fundClassId: "mpfa-cf-459",
      schemeName: "SHKP MPF Employer Sponsored Scheme",
      constituentFundName: "Manulife Career Average Guaranteed Fund - SHKP",
      fundClassName: "n.a.",
      platformFundType: "Guaranteed Fund",
      reason: "scheme_not_in_source",
    },
  ],
};

describe("category map lookup", () => {
  it("resolves a mapped fund class to its Lipper category", () => {
    const lookup = toCategoryLookup(file);

    expect(lookup.categoryOf("mpfa-cf-1000")).toBe("United States Equity");
    expect(lookup.capturedAt).toBe("2026-08-27");
  });

  it("returns no category for a fund class the source never covered", () => {
    const lookup = toCategoryLookup(file);

    expect(lookup.categoryOf("mpfa-cf-459")).toBeUndefined();
    expect(lookup.unmappedIds.has("mpfa-cf-459")).toBe(true);
  });

  it("accepts a snapshot whose fund classes are all mapped or listed", () => {
    expect(() =>
      assertCategoryCoverage(toCategoryLookup(file), [
        "mpfa-cf-1000",
        "mpfa-cf-459",
      ]),
    ).not.toThrow();
  });

  it("refuses to seed a fund class the map never saw, instead of guessing", () => {
    expect(() =>
      assertCategoryCoverage(toCategoryLookup(file), ["mpfa-cf-9999"]),
    ).toThrow("mpfa-cf-9999");
  });
});
