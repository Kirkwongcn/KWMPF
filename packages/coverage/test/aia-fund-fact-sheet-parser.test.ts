import { describe, expect, it } from "vitest";
import { parseAiaFundFactSheet } from "../src/aia-fund-fact-sheet-parser";

// 2026 年 7 月《Fund Performance Review》嘅版面（`pdftotext -layout`），只留讀取器用到嘅行。
function page(name: string, fundRow: string[]) {
  return [
    " 友邦強積金優選計劃 | AIA MPF - PRIME VALUE CHOICE 截至2026年7月31日 As at 31 July 2026",
    ` 強積金保守基金^ 1 2 3 4 5 6 7`,
    ` ${name} 風險級別﹢Risk Class﹢`,
    " 基金資料 | FUND FACTS                     基金表現 | FUND PERFORMANCE",
    " 年度化回報 Annualised Return (%)",
    ...fundRow,
    " 指標 Benchmark3                        0.05          0.44 0.36 0.20 0.41    -",
    " 平均成本法回報",
  ].join("\n");
}

describe("AIA fund performance review", () => {
  it("reads a fund whose name carries a footnote and whose row wraps, without taking benchmark figures", () => {
    const text = [
      page("MPF Conservative Fund^", [" 基金 Fund                              1.91            \t\t\t\t", "            2.65 2.05 1.27 0.92     -"]),
      page("Guaranteed Portfolio*", [" 基金 Fund                              1.60            \t\t\t\t", "            1.27 0.82 0.48 1.34     -"]),
    ].join("\f");
    expect(parseAiaFundFactSheet(text, "https://official.test/aia.pdf")).toMatchObject([
      { constituentFundName: "MPF Conservative Fund", dataAsOf: "2026-07-31", annualizedReturn3Year: 2.65 },
      { constituentFundName: "Guaranteed Portfolio", dataAsOf: "2026-07-31", annualizedReturn3Year: 1.27 },
    ]);
  });

  it("keeps an official N/A three-year cell out, instead of shifting a later column into it", () => {
    const text = [
      page("Young Fund", [" 基金 Fund     5.00   N/A 不適用  N/A 不適用  N/A 不適用  8.00   -"]),
      page("Old Fund", [" 基金 Fund     5.00   4.00  3.00  2.00  8.00   -"]),
    ].join("\f");
    expect(parseAiaFundFactSheet(text, "https://official.test/aia.pdf").map((row) => row.constituentFundName)).toEqual(["Old Fund"]);
  });
});
