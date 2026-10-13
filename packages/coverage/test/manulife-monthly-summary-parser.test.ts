import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseManulifeMonthlySummary } from "../src/manulife-monthly-summary-parser";

// 宏利環球精選《每月摘要》2026-08（截至 2026-08-31）第 3、4 頁，只留表頭、截至日期同六隻基金：
// 退休收益基金十年「不適用▲」「N/A▲」印喺數字行上下；核心累積、65 歲後有兩個編號（SHK148/ DIS148）；
// 可持續亞太債券名斷行；利息基金價格欄係利率。
const fixture = readFileSync(join(import.meta.dirname, "fixtures", "manulife-monthly-summary-2026-08-pages.bbox.html"), "utf8");

describe("Manulife Global Select monthly fund summary", () => {
  it("reads cumulative returns by column with the fund's own English name", () => {
    const summary = parseManulifeMonthlySummary(fixture);
    expect(summary.dataAsOf).toBe("2026-08-31");
    expect(summary.rows.map((row) => [row.code, row.englishName, row.oneYear, row.printedThreeYears, row.threeYears, row.fiveYears, row.tenYears])).toEqual([
      ["SHK137", "Manulife MPF Healthcare Fund", 24.4, "28.01", 28.01, 27.16, 91.67],
      ["SHK150", "Manulife MPF Retirement Income Fund", 3.86, "10.85", 10.85, -13.81, null],
      ["SHK148/DIS148", "Manulife MPF Core Accumulation Fund", 12.64, "41.17", 41.17, 30.43, null],
      ["SHK149/DIS149", "Manulife MPF Age 65 Plus Fund", 3.75, "14.99", 14.99, 0.79, null],
      ["SHK146", "Manulife MPF Sustainable Pacific Asia Bond Fund", 1.34, "11.28", 11.28, -1.66, 12.17],
      ["DHK121", "Manulife MPF Interest Fund", 0.88, "2.66", 2.66, 3.69, 5.71],
    ]);
  });

  it("fails the whole summary when a return cell is missing", () => {
    // 刪走康健護理三年「28.01」：嗰欄冇格，唔可以出其他欄或者其他基金。
    const broken = fixture.replace(/\s*<word [^>]*>28\.01<\/word>/, "");
    expect(broken).not.toBe(fixture);
    expect(() => parseManulifeMonthlySummary(broken)).toThrow(/SHK137: column 3Y has 0 cells/);
  });
});
