import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildLipperCategoryMap, diffCategoryMaps, splitLipperName } from "../src/lipper-category-map";

const fundClass = (fundClassId: string, constituentFundName: string, fundClassName = "n.a.") => ({
  fundClassId,
  identity: { schemeName: "MASS Mandatory Provident Fund Scheme", constituentFundName, fundClassName },
  fundType: "Equity Fund - Global Equity Fund",
});

const lipperFund = (sourceName: string, category = "Global Equity", seq = 1) => ({ sourceName, category, seq });

describe("lipper category map", () => {
  it("splits the scheme label, fund name and unit class letter", () => {
    expect(splitLipperName("Haitong MPF Retire Fd-Haitong Core Accumulation A")).toEqual({
      schemeLabel: "Haitong MPF Retire Fd",
      platformSchemeName: "Haitong MPF Retirement Fund",
      fundName: "Haitong Core Accumulation",
      classLetter: "A",
    });
    expect(splitLipperName("BCT MPF-Smart-Principal Cash")?.platformSchemeName).toBe("BCT MPF - Smart Plan");
    expect(splitLipperName("Unknown Scheme-Some Fund")).toBeUndefined();
  });

  it("matches abbreviated names within the scheme and unit class", () => {
    const result = buildLipperCategoryMap(
      [lipperFund("MASS MPF-Global Eq"), lipperFund("MASS MPF-Asian Bd", "Asian Bond", 2)],
      [fundClass("a", "Global Equity Fund"), fundClass("b", "Asian Bond Fund")],
    );
    expect(result.entries.map((entry) => [entry.fundClassId, entry.lipperCategory, entry.matchMethod])).toEqual([
      ["a", "Global Equity", "auto"],
      ["b", "Asian Bond", "auto"],
    ]);
    expect(result.unmatchedLipperFunds).toEqual([]);
  });

  it("uses a fund alias when the source name cannot be normalised into the platform name", () => {
    const options = { fundAliases: { "MASS MPF-Sunrise": "Global Equity Fund" } };
    const result = buildLipperCategoryMap([lipperFund("MASS MPF-Sunrise")], [fundClass("a", "Global Equity Fund")], options);
    expect(result.entries).toEqual([
      {
        fundClassId: "a",
        lipperCategory: "Global Equity",
        platformFundType: "Equity Fund - Global Equity Fund",
        matchMethod: "alias",
        lipperSourceName: "MASS MPF-Sunrise",
        score: 1,
      },
    ]);
  });

  it("honours a manual override ahead of name matching", () => {
    const result = buildLipperCategoryMap(
      [lipperFund("MASS MPF-Global Eq")],
      [fundClass("a", "Global Equity Fund"), fundClass("b", "Guaranteed Fund")],
      { manualOverrides: { "MASS MPF-Global Eq": "b" } },
    );
    expect(result.entries.map((entry) => [entry.fundClassId, entry.matchMethod, entry.score])).toEqual([["b", "manual", 1]]);
    expect(result.unmappedFundClasses.map((item) => item.fundClassId)).toEqual(["a"]);
  });

  it("rejects a manual override that points at an unknown fund class", () => {
    expect(() =>
      buildLipperCategoryMap([lipperFund("MASS MPF-Global Eq")], [fundClass("a", "Global Equity Fund")], {
        manualOverrides: { "MASS MPF-Global Eq": "zzz" },
      }),
    ).toThrow(/unknown fundClassId/);
  });

  it("reports rather than silently falling back when a fund cannot be matched", () => {
    const result = buildLipperCategoryMap(
      [lipperFund("MASS MPF-Sunrise"), lipperFund("Nowhere Scheme-Something", "Other Fund", 2)],
      [fundClass("a", "Guaranteed Fund")],
    );
    expect(result.entries).toEqual([]);
    expect(result.unmatchedLipperFunds).toEqual([
      { sourceName: "Nowhere Scheme-Something", lipperCategory: "Other Fund", reason: "unknown_scheme" },
      { sourceName: "MASS MPF-Sunrise", lipperCategory: "Global Equity", reason: "no_match" },
    ]);
    expect(result.unmappedFundClasses).toEqual([
      {
        fundClassId: "a",
        schemeName: "MASS Mandatory Provident Fund Scheme",
        constituentFundName: "Guaranteed Fund",
        fundClassName: "n.a.",
        platformFundType: "Equity Fund - Global Equity Fund",
        reason: "no_match",
      },
    ]);
  });

  it("keeps unit classes apart so one lipper row cannot claim two fund classes", () => {
    const withClasses = [
      { ...fundClass("a", "Global Equity Fund", "Class A"), identity: { schemeName: "Haitong MPF Retirement Fund", constituentFundName: "Haitong Korea Fund", fundClassName: "Class A" } },
      { ...fundClass("b", "Global Equity Fund", "Class T"), identity: { schemeName: "Haitong MPF Retirement Fund", constituentFundName: "Haitong Korea Fund", fundClassName: "Class T" } },
    ];
    const result = buildLipperCategoryMap(
      [lipperFund("Haitong MPF Retire Fd-Haitong Korea T", "Other Fund")],
      withClasses,
    );
    expect(result.entries.map((entry) => entry.fundClassId)).toEqual(["b"]);
    expect(result.unmappedFundClasses.map((item) => item.fundClassId)).toEqual(["a"]);
  });

  it("reports additions, removals and recategorisations between two versions", () => {
    const previous = [
      { fundClassId: "a", lipperCategory: "Global Equity", platformFundType: "x", matchMethod: "auto" as const, lipperSourceName: "a", score: 1 },
      { fundClassId: "b", lipperCategory: "Asian Bond", platformFundType: "x", matchMethod: "auto" as const, lipperSourceName: "b", score: 1 },
    ];
    const next = [
      previous[0]!,
      { fundClassId: "c", lipperCategory: "Other Fund", platformFundType: "x", matchMethod: "auto" as const, lipperSourceName: "c", score: 1 },
    ];
    expect(diffCategoryMaps(previous, next)).toEqual({
      added: [{ fundClassId: "c", lipperCategory: "Other Fund" }],
      removed: [{ fundClassId: "b", lipperCategory: "Asian Bond" }],
      recategorized: [],
    });
    expect(diffCategoryMaps(previous, [{ ...previous[0]!, lipperCategory: "Other Fund" }, previous[1]!]).recategorized).toEqual([
      { fundClassId: "a", from: "Global Equity", to: "Other Fund" },
    ]);
  });
});

describe("published fund class category map", () => {
  const map = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../data/reference/fund-class-category-map.json"), "utf8"));

  it("covers every lipper fund with no unmatched rows", () => {
    expect(map.unmatchedLipperFunds).toEqual([]);
    expect(map.entries).toHaveLength(441);
    expect(map.categoryCount).toBe(25);
  });

  it("leaves only fund classes absent from the lipper source unmapped", () => {
    expect(new Set(map.unmappedFundClasses.map((item: { reason: string }) => item.reason))).toEqual(
      new Set(["scheme_not_in_source"]),
    );
    expect(new Set(map.unmappedFundClasses.map((item: { schemeName: string }) => item.schemeName))).toEqual(
      new Set(["SHKP MPF Employer Sponsored Scheme"]),
    );
  });

  it("assigns each fund class at most once", () => {
    expect(new Set(map.entries.map((entry: { fundClassId: string }) => entry.fundClassId)).size).toBe(map.entries.length);
  });
});
