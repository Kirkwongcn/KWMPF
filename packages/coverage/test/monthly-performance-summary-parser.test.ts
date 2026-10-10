import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  matchSummaryRows,
  parseMonthlySummary,
} from "../src/monthly-performance-summary-parser";

// 滙豐強積金智選計劃《每月基金表現摘要》2026 年 8 月第 4 頁（pdftotext -layout）。
const hsbc = readFileSync(
  new URL("./fixtures/hsbc-monthly-summary-2026-08.txt", import.meta.url),
  "utf8",
);

describe("monthly fund performance summary (ADR 0014)", () => {
  it("reads every fund row with its own as-at date and the printed three-year cumulative", () => {
    const summary = parseMonthlySummary(hsbc);
    expect(summary.dataAsOf).toBe("2026-08-31");
    expect(summary.rows).toHaveLength(20);
    const conservative = summary.rows[0]!;
    expect(conservative).toMatchObject({
      englishName: "MPF Conservative Fund",
      chineseName: "強積金保守基金",
      riskRating: 1,
      launchDate: "2000-12-01",
      unitPrice: "14.4032",
    });
    expect(conservative.cumulative.threeYears).toBe(9.2);
    // 官方印「9.20」，原文保留，唔會變成「9.2」。
    expect(conservative.printed[3]).toBe("9.20");
    expect(conservative.calendarYears).toEqual({
      "2021": 0,
      "2022": 0.39,
      "2023": 3.64,
      "2024": 3.89,
      "2025": 2.38,
    });
  });

  it("joins wrapped English names, keeps names starting with digits and drops rename notes", () => {
    const names = parseMonthlySummary(hsbc).rows.map((row) => row.englishName);
    expect(names).toContain("Age 65 Plus Fund");
    expect(names).toContain("Hong Kong and Chinese Equity Fund");
    expect(names).toContain("ValueChoice Balanced Fund");
    expect(names).toContain("ValueChoice North America Equity Tracker Fund");
    expect(names).toContain("Hang Seng China Enterprises Index Tracking Fund");
    expect(names.some((name) => /formerly|Chinese name|[#^§]/u.test(name))).toBe(false);
  });

  it("treats an official dash as not provided rather than zero", () => {
    const valueChoice = parseMonthlySummary(hsbc).rows.find(
      (row) => row.englishName === "ValueChoice Balanced Fund",
    )!;
    expect(valueChoice.cumulative.tenYears).toBeNull();
    expect(valueChoice.cumulative.threeYears).toBe(44.98);
  });

  it("refuses a table whose period columns are not in the expected order", () => {
    expect(() =>
      parseMonthlySummary(hsbc.replace("1-Year 3-Years", "3-Years 1-Year")),
    ).toThrow(/header not found/u);
  });

  it("refuses the whole table when a fund block has no data line", () => {
    const broken = hsbc.replace(
      /^.*01\/12\/2000 14\.4032.*$/mu,
      "",
    );
    expect(() => parseMonthlySummary(broken)).toThrow(/expected one data line/u);
  });

  it("matches names exactly within the scheme and reports duplicates instead of guessing", () => {
    const rows = parseMonthlySummary(hsbc).rows.slice(0, 2);
    const matches = matchSummaryRows(rows, [
      { fundClassId: "a", constituentFundName: "MPF Conservative Fund" },
      { fundClassId: "b", constituentFundName: "Global Bond Fund" },
      { fundClassId: "c", constituentFundName: "global bond fund" },
    ]);
    expect(matches[0]).toMatchObject({ status: "matched", fundClassId: "a" });
    expect(matches[1]).toMatchObject({ status: "ambiguous", candidates: ["b", "c"] });
    const loose = matchSummaryRows(rows.slice(0, 1), [
      { fundClassId: "x", constituentFundName: "MPF Conservative" },
    ]);
    expect(loose[0]!.status).toBe("unmatched");
  });
});
