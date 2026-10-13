import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchSunLifeRows, parseSunLifeCumulativePerformance } from "../src/sun-life-mpf-performance";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/sun-life-mpf-cr-performance-2026-06.json", import.meta.url), "utf8"),
);

const rainbow = [
  { fundClassId: "cf-cons-a", constituentFundName: "Sun Life MPF Conservative Fund", fundClassName: "Class A" },
  { fundClassId: "cf-cons-b", constituentFundName: "Sun Life MPF Conservative Fund", fundClassName: "Class B" },
  { fundClassId: "cf-income", constituentFundName: "Sun Life MPF Income Fund", fundClassName: "n.a." },
  { fundClassId: "cf-us", constituentFundName: "Sun Life MPF US Equity Fund", fundClassName: "n.a." },
  { fundClassId: "cf-caf", constituentFundName: "Sun Life MPF Core Accumulation Fund", fundClassName: "n.a." },
];

describe("Sun Life MPF cumulative performance (ADR 0014)", () => {
  it("reads the official cumulative returns as published", () => {
    const performance = parseSunLifeCumulativePerformance(fixture);
    expect(performance.valuationDate).toBe("2026-06-30");
    expect(performance.rows).toHaveLength(5);
    expect(performance.rows[0]).toMatchObject({
      name: "Sun Life MPF Conservative Fund",
      unitClass: "A",
      oneYear: 1.62,
      threeYears: 8.76,
      fiveYears: 10.93,
      tenYears: 13.69,
      printedThreeYears: "8.76",
    });
  });

  it("keeps a null cell as the N/A the website prints, never zero", () => {
    const income = parseSunLifeCumulativePerformance(fixture).rows.find((row) => row.name === "Sun Life MPF Income Fund")!;
    expect(income).toMatchObject({ unitClass: null, oneYear: 3.23, threeYears: null, printedThreeYears: "N/A" });
  });

  it("rejects the whole response on mixed dates, odd values or classes", () => {
    const mixed = structuredClone(fixture);
    mixed[1].VALUATION_DT = "31/03/2026";
    expect(() => parseSunLifeCumulativePerformance(mixed)).toThrow(/mixed valuation dates/u);

    const odd = structuredClone(fixture);
    odd[0].PERFORMANCE_3YR = "8.76";
    expect(() => parseSunLifeCumulativePerformance(odd)).toThrow(/unexpected value "8.76"/u);

    const blank = structuredClone(fixture);
    blank[0].PERFORMANCE_3YR = "";
    expect(() => parseSunLifeCumulativePerformance(blank)).toThrow(/unexpected value/u);

    const unitClass = structuredClone(fixture);
    unitClass[0].FUND_CLASS_EN = "C";
    expect(() => parseSunLifeCumulativePerformance(unitClass)).toThrow(/unexpected class/u);

    expect(() => parseSunLifeCumulativePerformance([])).toThrow(/no fund list/u);
    expect(() => parseSunLifeCumulativePerformance([null, ...fixture])).toThrow(/not an object/u);
  });

  it("matches each class to its own MPFA fund class and never guesses", () => {
    const { rows } = parseSunLifeCumulativePerformance(fixture);
    expect(
      matchSunLifeRows(rows, rainbow).map((match) => (match.status === "matched" ? match.fundClassId : match.status)),
    ).toEqual(["cf-cons-a", "cf-cons-b", "cf-income", "cf-us", "cf-caf"]);

    // 積金局冇寫類別而官方分 A／B：對唔上，唔可以揀一個。
    const unlabelled = rainbow.map((record) => ({ ...record, fundClassName: "n.a." }));
    expect(matchSunLifeRows(rows, unlabelled)[0]).toMatchObject({ status: "unmatched" });

    // 積金局寫「Unit Class A」都係同一個類別契約（同 BCT 一樣）。
    const unitLabelled = rainbow.map((record) => ({ ...record, fundClassName: record.fundClassName.replace(/^Class /u, "Unit Class ") }));
    expect(matchSunLifeRows(rows, unitLabelled)[1]).toMatchObject({ status: "matched", fundClassId: "cf-cons-b" });
  });
});
