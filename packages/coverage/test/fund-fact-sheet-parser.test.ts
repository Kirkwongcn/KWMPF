import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFundFactSheet } from "../src/fund-fact-sheet-parser";
import { mergeFundFactSheetReturns } from "../src/fund-fact-sheet-merge";

const fixture = readFileSync(join(import.meta.dirname, "fixtures", "bea-fund-fact-sheet.txt"), "utf8");
const bcomFixture = `BCOM Joyful Retirement MPF Scheme\nBCOM Joyful Retirement MPF Scheme Fund Fact Sheet\n(As of : 31/12/2025)\n\\f\nBCOM Stable Growth (CF) Fund\nAnnualised Rate of Return 1 year 3 years 5 years 10 years\nFund 2.01% 2.85% 1.86% 1.40%`;

describe("official fund fact sheet parser", () => {
  it("extracts the official three-year annualized return without estimating", () => {
    expect(parseFundFactSheet(fixture, "https://www.mpfa.org.hk/assets/FF/MT00571.pdf")).toEqual([
      {
        schemeName: "BEA (MPF) Value Scheme",
        constituentFundName: "BEA Growth Fund",
        dataAsOf: "2025-09-30",
        sourceUrl: "https://www.mpfa.org.hk/assets/FF/MT00571.pdf",
        annualizedReturn3Year: 14.82,
      },
      {
        schemeName: "BEA (MPF) Value Scheme",
        constituentFundName: "BEA Core Accumulation Fund",
        dataAsOf: "2025-09-30",
        sourceUrl: "https://www.mpfa.org.hk/assets/FF/MT00571.pdf",
        annualizedReturn3Year: 14.01,
      },
    ]);
  });

  it("accepts the alternate official rate-of-return label", () => {
    expect(parseFundFactSheet(bcomFixture, "https://example.test/bcom.pdf")).toEqual([
      expect.objectContaining({
        schemeName: "BCOM Joyful Retirement MPF Scheme",
        constituentFundName: "BCOM Stable Growth (CF) Fund",
        dataAsOf: "2025-12-31",
        annualizedReturn3Year: 2.85,
      }),
    ]);
  });

  it("fails closed when the performance row is missing", () => {
    expect(() => parseFundFactSheet(fixture.replace("15.45% 14.82% 5.67% 6.59% 5.44%", "N/A N/A N/A N/A N/A"), "https://example.test/fact-sheet.pdf")).toThrow(
      "Annualized return row is incomplete",
    );
  });

  it("adds a three-year return only when the constituent fund maps to one class", () => {
    const factSheet = parseFundFactSheet(fixture, "https://www.mpfa.org.hk/assets/FF/MT00571.pdf");
    const result = mergeFundFactSheetReturns(
      [
        {
          fundClassId: "bea-growth-class-i",
          identity: {
            trusteeName: "The Bank of East Asia, Limited",
            schemeName: "BEA (MPF) Value Scheme",
            constituentFundName: "BEA Growth Fund",
            fundClassName: "Class I",
          },
          current: true,
          dataAsOf: "2025-09-30",
        },
      ],
      factSheet,
    );
    expect(result.records[0]?.returns?.[3]).toEqual({ annualized: 14.82, dataAsOf: "2025-09-30" });
    expect(result.unmatched).toHaveLength(1);
  });

  it("does not copy a value across ambiguous classes", () => {
    const factSheet = parseFundFactSheet(fixture, "https://example.test/fact-sheet.pdf");
    const result = mergeFundFactSheetReturns(
      [
        {
          fundClassId: "growth-i",
          identity: { trusteeName: "T", schemeName: factSheet[0]!.schemeName, constituentFundName: "BEA Growth Fund", fundClassName: "I" },
          current: true,
          dataAsOf: "2025-09-30",
        },
        {
          fundClassId: "growth-ii",
          identity: { trusteeName: "T", schemeName: factSheet[0]!.schemeName, constituentFundName: "BEA Growth Fund", fundClassName: "II" },
          current: true,
          dataAsOf: "2025-09-30",
        },
      ],
      [factSheet[0]!],
    );
    expect(result.ambiguous).toHaveLength(1);
    expect(result.records.every((record) => record.returns === undefined)).toBe(true);
  });
});
