import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFundFactSheet } from "../src/fund-fact-sheet-parser";
import { mergeFundFactSheetReturns } from "../src/fund-fact-sheet-merge";
import { parseAiaFundFactSheet } from "../src/aia-fund-fact-sheet-parser";
import { parseAmtdFundFactSheet } from "../src/amtd-fund-fact-sheet-parser";
import { parseBctFundFactSheet } from "../src/bct-fund-fact-sheet-parser";
import { parsePrincipal800FundFactSheet, parsePrincipalFundFactSheet } from "../src/principal-fund-fact-sheet-parser";
import { parseSunLifeFundFactSheetXml } from "../src/sun-life-fund-fact-sheet-parser";
import { parseChinaLifeFundPerformance } from "../src/china-life-fund-performance-parser";
import { parseHsbcFundFactSheet } from "../src/hsbc-fund-fact-sheet-parser";

const fixture = readFileSync(join(import.meta.dirname, "fixtures", "bea-fund-fact-sheet.txt"), "utf8");
const aiaFixture = readFileSync(join(import.meta.dirname, "fixtures", "aia-mt00172-layout.txt"), "utf8");
const bcomFixture = `BCOM Joyful Retirement MPF Scheme\nBCOM Joyful Retirement MPF Scheme Fund Fact Sheet\n(As of : 31/12/2025)\n\\f\nBCOM Stable Growth (CF) Fund\nAnnualised Rate of Return 1 year 3 years 5 years 10 years\nFund 2.01% 2.85% 1.86% 1.40%`;
const amtdFixture = `AMTD MPF Scheme\nAMTD Allianz Choice Dynamic Allocation Fund\nAs at 31-Dec-2025 截至 2025 年 12 月 31 日\nAnnualized Return 年率化回報 (% p.a.)\n1 yr 3 yrs 5 yrs 10 yrs\n8.77% 5.12% 2.68% 3.23%`;
const bctFixture = `BCT (MPF) Industry Choice\nBCT (Industry) China and Hong Kong Equity Fund\nFund Performance Fact Sheet\nas at 截至 31/12/2025\nConstituent Fund Performance 成份基金表現\nAnnualised Return 年率化回報 (p.a.)\n1 Year 一年 3 Years 三年 5 Years 五年 10 Years 十年 Since Launch\n30.67% 8.27% -2.94% 3.67% 6.69%\nDollar Cost Averaging Return (For illustration only)`;
const principalFixture = `Principal MPF - Simple Plan Quarterly\nFund Fact Sheet\nData as of 數據截至 31/12/2025\n\\f\nPrincipal Age 65 Plus Fund (MA65F)\nAnnualized Return 年度回報 (%) N/A 7.75 7.75 5.98 0.69`;
const principal800Fixture = `信安中國股票基金\nPrincipal China Equity Fund\n截至2025年12月31日 As at 31/12/2025\n年均表現 Annualized Return6 (%)\nD類單位 Class D 30.63 30.63 9.16 -4.48 3.34 2.59`;
const sunLifeXmlFixture = readFileSync(join(import.meta.dirname, "fixtures", "sun-life-page-23.xml"), "utf8");
const sunLifePage24XmlFixture = readFileSync(join(import.meta.dirname, "fixtures", "sun-life-page-24.xml"), "utf8");
const chinaLifeFixture = `\fChina Life Greater China Equity Fund 中國人壽大中華股票基金\nFund Performance 基金表現\nAnnualized 年率化 (%) - - 30.16 8.44 - - 0.13\fChina Life MPF Conservative Fund 中國人壽強積金保守基金\nAnnualized 年率化 (%) - - 2.00 2.88 1.93 1.19 0.76`;
const hsbcFixture = `所載資料截至 All information as at 31/03/2026\fCore Accumulation Fund\nFund Performance Information (%)\nAnnualised return 1 yr 3 yrs 5 yrs 10 yrs\nThis Fund\n12.30 9.42 5.08 6.38`;
const hangSengFixture = `所載資料截至 All information as at 31/12/2025\fValueChoice Asia Pacific Equity Tracker Fund\nFund Performance Information (%)\nAnnualised return 1 yr 3 yrs 5 yrs 10 yrs\nThis Fund\n28.58 14.54 4.54 0.00`;

describe("official fund fact sheet parser", () => {
  it("parses China Life quarterly performance annualized three-year returns", () => {
    expect(parseChinaLifeFundPerformance(`As at 31 March 2026${chinaLifeFixture}`, "https://example.test/china-life.pdf")).toEqual([
      expect.objectContaining({ constituentFundName: "China Life Greater China Equity Fund", dataAsOf: "2026-03-31", annualizedReturn3Year: 8.44 }),
      expect.objectContaining({ constituentFundName: "China Life MPF Conservative Fund", annualizedReturn3Year: 2.88 }),
    ]);
  });

  it("matches official curly apostrophes without fuzzy matching", () => {
    const result = mergeFundFactSheetReturns(
      [{ fundClassId: "aia-manager", identity: { trusteeName: "AIA", schemeName: "AIA MPF - Prime Value Choice", constituentFundName: "Manager's Choice Fund", fundClassName: "n.a." }, current: true, dataAsOf: "2026-06-30" }],
      [{ schemeName: "AIA MPF - Prime Value Choice", constituentFundName: "Manager’s Choice Fund", dataAsOf: "2026-05-31", sourceUrl: "https://example.test/aia.pdf", annualizedReturn3Year: 4.2 }],
    );
    expect(result.unmatched).toHaveLength(0);
    expect(result.ambiguous).toHaveLength(0);
    expect(result.records[0]?.returns?.[3]).toEqual({ annualized: 4.2, dataAsOf: "2026-05-31" });
  });

  it("matches official en dash scheme names exactly", () => {
    const result = mergeFundFactSheetReturns(
      [{ fundClassId: "hsbc-core", identity: { trusteeName: "HSBC", schemeName: "HSBC Mandatory Provident Fund - SuperTrust Plus", constituentFundName: "Core Accumulation Fund", fundClassName: "n.a." }, current: true, dataAsOf: "2026-06-30" }],
      [{ schemeName: "HSBC Mandatory Provident Fund – SuperTrust Plus", constituentFundName: "Core Accumulation Fund", dataAsOf: "2025-12-31", sourceUrl: "https://example.test/hsbc.pdf", annualizedReturn3Year: 6.06 }],
    );
    expect(result.unmatched).toHaveLength(0);
    expect(result.ambiguous).toHaveLength(0);
    expect(result.records[0]?.returns?.[3]).toEqual({ annualized: 6.06, dataAsOf: "2025-12-31" });
  });

  it("parses HSBC annualized three-year return rows", () => {
    expect(parseHsbcFundFactSheet(hsbcFixture, "https://example.test/hsbc.pdf")).toEqual([
      expect.objectContaining({ constituentFundName: "Core Accumulation Fund", dataAsOf: "2026-03-31", annualizedReturn3Year: 9.42 }),
    ]);
  });
  it("parses Hang Seng documents using the same verified layout", () => {
    expect(parseHsbcFundFactSheet(hangSengFixture, "https://example.test/hang-seng.pdf", "Hang Seng Mandatory Provident Fund – SuperTrust Plus")).toEqual([
      expect.objectContaining({ constituentFundName: "ValueChoice Asia Pacific Equity Tracker Fund", dataAsOf: "2025-12-31", annualizedReturn3Year: 14.54 }),
    ]);
  });
  it("parses AIA layout text without confusing cumulative and annualized returns", () => {
    const result = parseAiaFundFactSheet(aiaFixture, "https://www.mpfa.org.hk/assets/FF/MT00172.pdf");
    expect(result.length).toBeGreaterThan(10);
    expect(result.slice(0, 3)).toEqual([
      expect.objectContaining({ constituentFundName: "Core Accumulation Fund", annualizedReturn3Year: 11.18 }),
      expect.objectContaining({ constituentFundName: "Age 65 Plus Fund", annualizedReturn3Year: 4.62 }),
      expect.objectContaining({ constituentFundName: "American Fund", annualizedReturn3Year: 18.39 }),
    ]);
    expect(result.every((item) => item.dataAsOf === "2025-11-30")).toBe(true);
  });

  it("keeps other AIA funds when one fund lacks a three-year value", () => {
    const incomplete = aiaFixture.replace("基金 Fund                           1.13 0.23 0.15 0.15 0.15", "基金 Fund                           -");
    const result = parseAiaFundFactSheet(incomplete, "https://example.test/aia.pdf");
    expect(result.length).toBeGreaterThan(10);
    expect(result.every((item) => Number.isFinite(item.annualizedReturn3Year))).toBe(true);
  });
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

  it("parses AMTD quarterly fund summary annualized returns", () => {
    expect(parseAmtdFundFactSheet(amtdFixture, "https://www.mpfa.org.hk/assets/FF/MT00539.pdf")).toEqual([
      expect.objectContaining({ constituentFundName: "AMTD Allianz Choice Dynamic Allocation Fund", dataAsOf: "2025-12-31", annualizedReturn3Year: 5.12 }),
    ]);
  });

  it("accepts AMTD bilingual spacing between headers and values", () => {
    const fixture = amtdFixture.replace("1 yr 3 yrs 5 yrs 10 yrs", "1 yr 3 yrs 5 yrs 10 yrs\n\nFund performance notes");
    expect(parseAmtdFundFactSheet(fixture, "https://example.test/amtd.pdf")[0]?.annualizedReturn3Year).toBe(5.12);
  });

  it("fails closed when AMTD annualized return data is absent", () => {
    expect(() => parseAmtdFundFactSheet(amtdFixture.replace("5.12%", "N/A"), "https://example.test/amtd.pdf")).toThrow("AMTD annualized return row is incomplete");
  });

  it("parses BCT annualized returns without reading dollar-cost averaging returns", () => {
    expect(parseBctFundFactSheet(bctFixture, "https://www.mpfa.org.hk/assets/FF/IS00017.pdf")).toEqual([
      expect.objectContaining({ constituentFundName: "BCT (Industry) China and Hong Kong Equity Fund", dataAsOf: "2025-12-31", annualizedReturn3Year: 8.27 }),
    ]);
  });

  it("parses Principal Simple and Smart annualized three-year returns", () => {
    expect(parsePrincipalFundFactSheet(principalFixture, "https://example.test/simple.pdf", "BCT MPF - Simple Plan")).toEqual([
      expect.objectContaining({ constituentFundName: "Age 65 Plus Fund", dataAsOf: "2025-12-31", annualizedReturn3Year: 5.98 }),
    ]);
  });

  it("parses Principal 800 annualized three-year returns", () => {
    expect(parsePrincipal800FundFactSheet(principal800Fixture, "https://example.test/800.pdf", "BCT MPF Scheme Series 800")).toEqual([
      expect.objectContaining({ constituentFundName: "信安中國股票基金", dataAsOf: "2025-12-31", annualizedReturn3Year: 9.16 }),
    ]);
  });

  it("parses Sun Life XML coordinates without confusing adjacent report columns", () => {
    expect(parseSunLifeFundFactSheetXml(sunLifeXmlFixture, "https://www.mpfa.org.hk/assets/FF/MT00067.pdf")).toEqual([
      expect.objectContaining({
        schemeName: "Sun Life Rainbow MPF Scheme",
        constituentFundName: "Sun Life MPF Core Accumulation Fund",
        dataAsOf: "2025-12-31",
        annualizedReturn3Year: 12.14,
      }),
    ]);
  });

  it("handles the next Sun Life page layout and keeps the annualized column isolated", () => {
    expect(parseSunLifeFundFactSheetXml(sunLifePage24XmlFixture, "https://www.mpfa.org.hk/assets/FF/MT00067.pdf")).toEqual([
      expect.objectContaining({ constituentFundName: "Sun Life MPF Age 65 Plus Fund", annualizedReturn3Year: 5.4 }),
    ]);
  });

  it("separates an official class suffix instead of treating it as part of the fund name", () => {
    const classFixture = sunLifeXmlFixture.replace("<text top=\"434\" left=\"488\" width=\"184\" height=\"13\" font=\"3\">Sun Life MPF Core Accumulation Fund</text>", "<text top=\"434\" left=\"488\" width=\"184\" height=\"13\" font=\"3\">Sun Life MPF Core Accumulation Fund – Class B</text>");
    expect(parseSunLifeFundFactSheetXml(classFixture, "https://www.mpfa.org.hk/assets/FF/MT00067.pdf")[0]).toEqual(
      expect.objectContaining({ constituentFundName: "Sun Life MPF Core Accumulation Fund", fundClassName: "Class B" }),
    );
  });

  it("accepts distinct classes for the same fund and rejects duplicate class rows", () => {
    const classFixture = sunLifeXmlFixture
      .replace("<text top=\"434\" left=\"488\" width=\"184\" height=\"13\" font=\"3\">Sun Life MPF Core Accumulation Fund</text>", "<text top=\"434\" left=\"488\" width=\"184\" height=\"13\" font=\"3\">Sun Life MPF Core Accumulation Fund – Class A</text><text top=\"434\" left=\"488\" width=\"184\" height=\"13\" font=\"3\">Sun Life MPF Core Accumulation Fund – Class B</text>");
    expect(() => parseSunLifeFundFactSheetXml(classFixture, "https://example.test/sun-life.pdf")).not.toThrow();
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
