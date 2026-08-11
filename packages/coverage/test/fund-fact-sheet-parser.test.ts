import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFundFactSheet } from "../src/fund-fact-sheet-parser";

const fixture = readFileSync(join(import.meta.dirname, "fixtures", "bea-fund-fact-sheet.txt"), "utf8");

describe("official fund fact sheet parser", () => {
  it("extracts the official three-year annualized return without estimating", () => {
    expect(parseFundFactSheet(fixture, "https://www.mpfa.org.hk/assets/FF/MT00571.pdf")).toEqual([
      {
        schemeName: "BEA (MPF) Value Scheme Fund Fact Sheet",
        constituentFundName: "BEA Growth Fund",
        dataAsOf: "2025-09-30",
        sourceUrl: "https://www.mpfa.org.hk/assets/FF/MT00571.pdf",
        annualizedReturn3Year: 14.82,
      },
      {
        schemeName: "BEA (MPF) Value Scheme Fund Fact Sheet",
        constituentFundName: "BEA Core Accumulation Fund",
        dataAsOf: "2025-09-30",
        sourceUrl: "https://www.mpfa.org.hk/assets/FF/MT00571.pdf",
        annualizedReturn3Year: 14.01,
      },
    ]);
  });

  it("fails closed when the performance row is missing", () => {
    expect(() => parseFundFactSheet(fixture.replace("15.45% 14.82% 5.67% 6.59% 5.44%", "N/A N/A N/A N/A N/A"), "https://example.test/fact-sheet.pdf")).toThrow(
      "Annualized return row is incomplete",
    );
  });
});
