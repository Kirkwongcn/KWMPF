import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFundFactSheet } from "../src/fund-fact-sheet-parser";
import { mergeFundFactSheetReturns } from "../src/fund-fact-sheet-merge";
import { parseAiaFundFactSheet } from "../src/aia-fund-fact-sheet-parser";
import { parseAmtdFundFactSheet } from "../src/amtd-fund-fact-sheet-parser";
import { parseBctFundFactSheet } from "../src/bct-fund-fact-sheet-parser";
import { parseBctProFundPerformance } from "../src/bct-pro-fund-performance-parser";
import { parsePrincipal800FundFactSheet, parsePrincipalFundFactSheet } from "../src/principal-fund-fact-sheet-parser";
import {
  parseSunLifeFundFactSheetXmlAudit,
  parseSunLifeFundFactSheetXml,
} from "../src/sun-life-fund-fact-sheet-parser";
import { parseChinaLifeFundPerformance } from "../src/china-life-fund-performance-parser";
import { parseHsbcFundFactSheet } from "../src/hsbc-fund-fact-sheet-parser";
import { parseBocPrudentialFundPerformance } from "../src/boc-prudential-fund-performance-parser";
import { parseHaitongFundPerformance } from "../src/haitong-fund-performance-parser";
import { parseMyChoiceFundPerformance } from "../src/my-choice-fund-performance-parser";
import { parseMassFundPerformance } from "../src/mass-fund-performance-parser";
import { parseShkpFundPerformance } from "../src/shkp-fund-performance-parser";
import { parseFidelityFundPerformanceAudit } from "../src/fidelity-fund-performance-parser";
import { downloadPdfInRanges } from "../src/resumable-download";

import { parseBeaFundFactSheetXml } from "../src/bea-fund-fact-sheet-parser";

const fixture = readFileSync(join(import.meta.dirname, "fixtures", "bea-fund-fact-sheet.txt"), "utf8");
const aiaFixture = readFileSync(join(import.meta.dirname, "fixtures", "aia-mt00172-layout.txt"), "utf8");
const bcomFixture = `BCOM Joyful Retirement MPF Scheme\nBCOM Joyful Retirement MPF Scheme Fund Fact Sheet\n(As of : 31/12/2025)\n\\f\nBCOM Stable Growth (CF) Fund\nAnnualised Rate of Return 1 year 3 years 5 years 10 years\nFund 2.01% 2.85% 1.86% 1.40%`;
const amtdFixture = `AMTD MPF Scheme\nAMTD Allianz Choice Dynamic Allocation Fund\nAs at 31-Dec-2025 截至 2025 年 12 月 31 日\nAnnualized Return 年率化回報 (% p.a.)\n1 yr 3 yrs 5 yrs 10 yrs\n8.77% 5.12% 2.68% 3.23%`;
const bctFixture = `BCT (MPF) Industry Choice\nBCT (Industry) China and Hong Kong Equity Fund\nFund Performance Fact Sheet\nas at 截至 31/12/2025\nConstituent Fund Performance 成份基金表現\nAnnualised Return 年率化回報 (p.a.)\n1 Year 一年 3 Years 三年 5 Years 五年 10 Years 十年 Since Launch\n30.67% 8.27% -2.94% 3.67% 6.69%\nDollar Cost Averaging Return (For illustration only)`;
const bctProFixture = `as at 截至 30/06/2026\fBCT (Pro) China and Hong Kong Equity Fund 8\nConstituent Fund Performance\nCumulative Return\nYear to Date 3 Months 1 Year 3 Years 5 Years\n-8.27% -4.13% 0.73% 22.45% -28.42%\nAnnualised Return\n1 Year 一年 3 Years 三年 5 Years 五年 10 Years 十年 Since Launch\n0.73% 6.98% -6.47% 2.85% 0.38%\nDollar Cost Averaging Return (For illustration only)\nAnnualised Return\n1 Year 一年 3 Years 三年 5 Years 五年 10 Years\n-7.88% 8.79% 4.16% 0.81% 1.98%`;
const principalFixture = `Principal MPF - Simple Plan Quarterly\nFund Fact Sheet\nData as of 數據截至 31/12/2025\n\\f\nPrincipal Age 65 Plus Fund (MA65F)\nAnnualized Return 年度回報 (%) N/A 7.75 7.75 5.98 0.69`;
const principal800Fixture = `信安中國股票基金\nPrincipal China Equity Fund\n截至2025年12月31日 As at 31/12/2025\n年均表現 Annualized Return6 (%)\nD類單位 Class D 30.63 30.63 9.16 -4.48 3.34 2.59`;
const sunLifeClasses = readFileSync(
  join(import.meta.dirname, "fixtures", "sun-life-2026-classes.xml"),
  "utf8",
);
const sunLifeIncome = readFileSync(
  join(import.meta.dirname, "fixtures", "sun-life-2026-income.xml"),
  "utf8",
);
const beaTwoFunds = readFileSync(
  join(import.meta.dirname, "fixtures", "bea-2026-two-funds.xml"),
  "utf8",
);
const sunLifeXmlFixture = readFileSync(join(import.meta.dirname, "fixtures", "sun-life-page-23.xml"), "utf8");
const sunLifePage24XmlFixture = readFileSync(join(import.meta.dirname, "fixtures", "sun-life-page-24.xml"), "utf8");
const chinaLifeFixture = `\fChina Life Greater China Equity Fund 中國人壽大中華股票基金\nFund Performance 基金表現\nAnnualized 年率化 (%) - - 30.16 8.44 - - 0.13\fChina Life MPF Conservative Fund 中國人壽強積金保守基金\nAnnualized 年率化 (%) - - 2.00 2.88 1.93 1.19 0.76`;
const hsbcFixture = `所載資料截至 All information as at 31/03/2026\fCore Accumulation Fund\nFund Performance Information (%)\nAnnualised return 1 yr 3 yrs 5 yrs 10 yrs\nThis Fund\n12.30 9.42 5.08 6.38`;
const hangSengFixture = `所載資料截至 All information as at 31/12/2025\fValueChoice Asia Pacific Equity Tracker Fund\nFund Performance Information (%)\nAnnualised return 1 yr 3 yrs 5 yrs 10 yrs\nThis Fund\n28.58 14.54 4.54 0.00`;
const bocFixture = `BOC-Prudential Hong Kong Equity Fund ◆\nAnnualized Return N/A N/A 11.01 8.22 -2.37 3.92 6.87\fBOC-Prudential MPF Conservative Fund\nAnnualized Return N/A N/A N/A N/A 0.50 0.60`;
const haitongIssuePrice = "Issue Price as of 31/08/2026 (Class A) $14.30";
const haitongHeading = (name: string, issueBeforeName = false) => {
  const title = name + " 海通基金*";
  return issueBeforeName ? haitongIssuePrice + "\n" + title : title + "\n" + haitongIssuePrice;
};
const haitongAnnualized = (a: string, t: string) => [
  "FUND PERFORMANCE",
  "ANNUALIZED RATE OF RETURN",
  "CLASS 1 Year 3 Years 5 Years 10 Years Since Inception",
  "A 10.42% " + a + " 2.94% 不適用▲ 3.87%",
  "T 10.42% " + t + " 2.94% N/A▲ 3.87%",
  "CALENDAR YEAR RETURN",
  "CLASS 2021 2022 2023 2024 2025 2026 YTD",
  "A 99.99% 99.99% 99.99% 99.99% 99.99% 99.99%",
  "T 99.99% 99.99% 99.99% 99.99% 99.99% 99.99%",
].join("\n");
const haitongFund = (name: string, a: string, t: string, issueBeforeName = false) =>
  haitongHeading(name, issueBeforeName) + "\n" + haitongAnnualized(a, t);
const haitongFixture = [
  "as of 31/08/2026\nHaitong MPF Retirement Fund\nConstituent Funds include Haitong Core Accumulation Fund",
  haitongFund("Haitong Hong Kong SAR Fund", "2.11%", "2.12%") + "\n" + haitongFund("Haitong Asia Pacific Fund", "3.21%", "3.22%", true),
  haitongFund("Haitong Global Diversification Fund", "4.31%", "4.32%") + "\n" + haitongFund("Haitong Korea Fund", "5.41%", "5.42%"),
  haitongHeading("Haitong Age 65 Plus Fund") + "\f" + haitongAnnualized("8.91%", "8.91%") + "\n" + haitongFund("Haitong Core Accumulation Fund", "9.11%", "9.12%"),
  haitongFund("Haitong MPF Conservative Fund", "10.11%", "10.12%"),
].join("\f");
const myChoiceFixture = `As at 30/9/2025\fMY CHOICE GROWTH FUND\nPERFORMANCE IN HKD\nAnnualized Return (%)\n1 Year 3 Years 5 Years 10 Years\n3 Years 12.34 5.20`;
const massFixture = `YF Life Trustees Ltd.\nAsian Pacific Equity Fund                                                                 Published in February 2026\nFund Data as at                      December 31, 2025\nFund Performance 1 year 3 years 5 years 10 years Since launch\nAnnualized Return 30.27% 14.34% 2.61% 4.48% 3.86%`;
const shkpFixture = `SHKP MPF Employer Sponsored Scheme\nAs at 31 March 2026\fAllianz Choice Balanced FundNote 1\nPerformance Note 2 & 3\nLast 3 years (p.a.%)+ 8.99 %`;
const fidelityTrusteeFixture = readFileSync(join(import.meta.dirname, "fixtures", "fidelity-2026-08-age-65-plus.bbox.html"), "utf8");
const fidelityMpfaFixture = readFileSync(join(import.meta.dirname, "fixtures", "fidelity-mt00288-2025-12.bbox.html"), "utf8");

describe("official fund fact sheet parser", () => {
  it("exposes the resumable PDF downloader seam", () => {
    expect(downloadPdfInRanges).toEqual(expect.any(Function));
  });
  it("parses China Life quarterly performance annualized three-year returns", () => {
    expect(parseChinaLifeFundPerformance(`As at 31 March 2026${chinaLifeFixture}`, "https://example.test/china-life.pdf")).toEqual([
      expect.objectContaining({ constituentFundName: "China Life Greater China Equity Fund", dataAsOf: "2026-03-31", annualizedReturn3Year: 8.44 }),
      expect.objectContaining({ constituentFundName: "China Life MPF Conservative Fund", annualizedReturn3Year: 2.88 }),
    ]);
  });

  it("uses the report As at date instead of a historical name-change date", () => {
    expect(parseChinaLifeFundPerformance(`As at 31 December 2025${chinaLifeFixture}\nChina Life Joyful Retirement Guaranteed Fund was formerly known as China Life Retire-Easy Guarantee Fund, with change of name effective on 4 December 2020.`, "https://example.test/china-life.pdf")[0]).toEqual(
      expect.objectContaining({ dataAsOf: "2025-12-31" }),
    );
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
  it("parses BOC-Prudential three-year values and skips N/A", () => {
    expect(parseBocPrudentialFundPerformance("Reporting Date: 31/3/2026\f" + bocFixture, "https://example.test/boc.pdf")).toEqual([
      expect.objectContaining({ constituentFundName: "BOC-Prudential Hong Kong Equity Fund", dataAsOf: "2026-03-31", annualizedReturn3Year: 8.22 }),
    ]);
  });
  it("parses all Haitong fund sections across pages and ignores calendar-year rows", () => {
    const result = parseHaitongFundPerformance(haitongFixture, "https://example.test/haitong.pdf");
    expect(result).toHaveLength(14);
    expect([...new Set(result.map((row) => row.constituentFundName))]).toEqual([
      "Haitong Hong Kong SAR Fund",
      "Haitong Asia Pacific Fund",
      "Haitong Global Diversification Fund",
      "Haitong Korea Fund",
      "Haitong Age 65 Plus Fund",
      "Haitong Core Accumulation Fund",
      "Haitong MPF Conservative Fund",
    ]);
    expect(result).toContainEqual(expect.objectContaining({ constituentFundName: "Haitong Hong Kong SAR Fund", fundClassName: "A", annualizedReturn3Year: 2.11 }));
    expect(result).toContainEqual(expect.objectContaining({ constituentFundName: "Haitong Asia Pacific Fund", fundClassName: "A", annualizedReturn3Year: 3.21 }));
    expect(result).toContainEqual(expect.objectContaining({ constituentFundName: "Haitong Age 65 Plus Fund", fundClassName: "T", annualizedReturn3Year: 8.91 }));
    expect(result).toContainEqual(expect.objectContaining({ constituentFundName: "Haitong MPF Conservative Fund", fundClassName: "T", annualizedReturn3Year: 10.12 }));
    expect(result.some((row) => row.annualizedReturn3Year === 99.99)).toBe(false);
  });
  it("parses My Choice three-year annualized returns", () => {
    expect(parseMyChoiceFundPerformance(myChoiceFixture, "https://example.test/my-choice.pdf")).toEqual([
      expect.objectContaining({ constituentFundName: "My Choice Growth Fund", dataAsOf: "2025-09-30", annualizedReturn3Year: 5.2 }),
    ]);
  });
  it("parses MASS three-year annualized returns", () => {
    expect(parseMassFundPerformance(massFixture, "https://example.test/mass.pdf")).toEqual([
      expect.objectContaining({ constituentFundName: "Asian Pacific Equity Fund", dataAsOf: "2025-12-31", annualizedReturn3Year: 14.34 }),
    ]);
  });
  it("parses SHKP employer-sponsored three-year returns", () => {
    expect(parseShkpFundPerformance(shkpFixture, "https://example.test/shkp.pdf")).toEqual([
      expect.objectContaining({ constituentFundName: "Allianz Choice Balanced Fund", dataAsOf: "2026-03-31", annualizedReturn3Year: 8.99 }),
    ]);
  });
  it("reads the Fidelity three-year column by position, not the left-column objective's numbers", () => {
    // hffs H-C65P 2026-08-31 page 2 (`pdftotext -bbox`, trimmed): the objective's "20%" shares the table's lines.
    expect(parseFidelityFundPerformanceAudit(fidelityTrusteeFixture, "https://example.test/fidelity.pdf")).toEqual({
      returns: [
        { schemeName: "Fidelity Retirement Master Trust", constituentFundName: "Age 65 Plus Fund", dataAsOf: "2026-08-31", sourceUrl: "https://example.test/fidelity.pdf", annualizedReturn3Year: 4.7 },
      ],
      unavailable: [],
    });
    const objectiveFigureOnRow = fidelityTrusteeFixture.replace(
      "</page>",
      '  <word xMin="183.746500" yMin="176.760000" xMax="195.023500" yMax="184.733000">20%</word>\n</page>',
    );
    expect(parseFidelityFundPerformanceAudit(objectiveFigureOnRow, "https://example.test/fidelity.pdf").returns[0]?.annualizedReturn3Year).toBe(4.7);
    // Left-column words near the title or naming another section do not move the table's bounds.
    const leftColumnNoise = fidelityTrusteeFixture.replace(
      "</page>",
      '  <word xMin="43.000000" yMin="168.700000" xMax="80.000000" yMax="176.700000">Calendar</word>\n</page>',
    );
    expect(parseFidelityFundPerformanceAudit(leftColumnNoise, "https://example.test/fidelity.pdf").returns[0]?.annualizedReturn3Year).toBe(4.7);
    const wrappedTitle = fidelityTrusteeFixture.replace('xMin="281.624700" yMin="166.757000" xMax="320.530700" yMax="174.730000">Performance', 'xMin="245.203700" yMin="196.757000" xMax="284.109700" yMax="204.730000">Performance');
    expect(() => parseFidelityFundPerformanceAudit(wrappedTitle, "https://example.test/fidelity.pdf")).toThrow(/Age 65 Plus Fund: annualised performance title is missing/);
  });
  it("records an official Fidelity three-year dash as not disclosed instead of borrowing since-launch", () => {
    // MPFA MT00288 2025-12-31 (trimmed pages): Americas Equity shows "-" for three years, Global Equity 16.93%.
    const result = parseFidelityFundPerformanceAudit(fidelityMpfaFixture, "https://www.mpfa.org.hk/assets/FF/MT00288.pdf");
    expect(result.returns).toEqual([expect.objectContaining({ constituentFundName: "Global Equity Fund", dataAsOf: "2025-12-31", annualizedReturn3Year: 16.93 })]);
    expect(result.unavailable).toEqual([
      expect.objectContaining({ constituentFundName: "Americas Equity Fund", dataAsOf: "2025-12-31", periodYears: 3, reason: "official-dash", page: 2 }),
    ]);
  });
  it("requires the single-row Fidelity table to carry its title label", () => {
    const unlabelled = fidelityMpfaFixture.replace(/\n {2}<word [^>]*>年率化表現<\/word>/g, "");
    expect(unlabelled).not.toContain(">年率化表現</word>");
    expect(() => parseFidelityFundPerformanceAudit(unlabelled, "https://www.mpfa.org.hk/assets/FF/MT00288.pdf")).toThrow(/first annualised row is labelled "", not the fund/);
  });
  it("stops the Fidelity factsheet when the fund row cannot be read cell by cell", () => {
    const droppedCell = fidelityTrusteeFixture.replace('  <word xMin="477.533700" yMin="176.760000" xMax="494.725700" yMax="184.733000">0.05%</word>\n', "");
    const enDash = fidelityTrusteeFixture.replace('xMax="521.388700" yMax="184.733000">-</word>', 'xMax="521.388700" yMax="184.733000">–</word>');
    const footnote = fidelityTrusteeFixture.replace("</page>", '  <word xMin="461.000000" yMin="176.760000" xMax="464.000000" yMax="184.733000">*</word>\n</page>');
    const noFundRow = fidelityTrusteeFixture
      .split("\n")
      .filter((line) => !line.includes('yMin="176.760000"') && !line.includes(">基金</word>"))
      .join("\n");
    expect(noFundRow).toContain(">4.66%</word>");
    expect(parseFidelityFundPerformanceAudit(footnote, "https://example.test/fidelity.pdf").returns[0]?.annualizedReturn3Year).toBe(4.7);
    for (const fixture of [droppedCell, enDash, noFundRow]) {
      expect(() => parseFidelityFundPerformanceAudit(fixture, "https://example.test/fidelity.pdf")).toThrow(/Fidelity annualized return table could not be read: Age 65 Plus Fund/);
    }
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
    expect(
      parseBeaFundFactSheetXml(
        beaTwoFunds,
        "https://example.test/bea.pdf",
        "BEA (MPF) Industry Scheme",
      ),
    ).toEqual([
      expect.objectContaining({
        constituentFundName: "BEA (Industry Scheme) Growth Fund",
        dataAsOf: "2026-06-30",
        annualizedReturn3Year: 12.86,
      }),
      expect.objectContaining({
        constituentFundName: "BEA (Industry Scheme) Balanced Fund",
        annualizedReturn3Year: 9.33,
      }),
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

  it("parses BCT Pro annualized returns without reading dollar-cost averaging returns", () => {
    expect(parseBctProFundPerformance(bctProFixture, "https://example.test/bct-pro.pdf")).toEqual([
      expect.objectContaining({ schemeName: "BCT (MPF) Pro Choice", constituentFundName: "BCT (Pro) China and Hong Kong Equity Fund", dataAsOf: "2026-06-30", annualizedReturn3Year: 6.98 }),
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

  it("binds the official class to its own performance row", () => {
    expect(
      parseSunLifeFundFactSheetXml(
        sunLifeClasses,
        "https://example.test/sun-life.pdf",
      ),
    ).toEqual([
      expect.objectContaining({
        constituentFundName: "Sun Life MPF Conservative Fund",
        fundClassName: "Class A",
        annualizedReturn3Year: 2.84,
      }),
      expect.objectContaining({
        constituentFundName: "Sun Life MPF Conservative Fund",
        fundClassName: "Class B",
        annualizedReturn3Year: 2.84,
      }),
    ]);
    // A graph legend is not the performance table's class identity.
    const legend = sunLifeXmlFixture.replace(
      "Sun Life MPF Core Accumulation Fund</text>",
      "Sun Life MPF Core Accumulation Fund – Class B</text>",
    );
    expect(
      parseSunLifeFundFactSheetXml(
        legend,
        "https://example.test/sun-life.pdf",
      )[0]?.fundClassName,
    ).toBeUndefined();
  });

  it("accepts distinct classes and rejects duplicate class rows", () => {
    expect(() =>
      parseSunLifeFundFactSheetXml(
        sunLifeClasses,
        "https://example.test/sun-life.pdf",
      ),
    ).not.toThrow();
    expect(() =>
      parseSunLifeFundFactSheetXml(
        sunLifeClasses.replaceAll("Class A", "Class B"),
        "https://example.test/sun-life.pdf",
      ),
    ).toThrow("ambiguous");
    const income = parseSunLifeFundFactSheetXmlAudit(
      sunLifeIncome,
      "https://example.test/sun-life.pdf",
    );
    expect(income.returns).toEqual([]);
    expect(income.unavailable).toEqual([
      expect.objectContaining({
        constituentFundName: "Sun Life MPF Income Fund",
        reason: "official-na",
        dataAsOf: "2026-06-30",
        periodYears: 3,
        page: 9,
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
