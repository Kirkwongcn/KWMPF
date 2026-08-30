import { describe, expect, it } from "vitest";
import { joinItems, parsePdfXml, toLines } from "../src/pdf-xml";
import {
  findFactSheetAsOf,
  findSections,
  parseFactSheetDate,
  parseFactSheetDisclosures,
  type FactSheetContract,
  type FactSheetDisclosure,
} from "../src/fact-sheet-allocation";
import { pairFactSheetDisclosures } from "../src/fact-sheet-allocation-pairing";

type Run = {
  top: number;
  left: number;
  text: string;
  width?: number;
  size?: number;
  family?: string;
  color?: string;
};

/**
 * 便覽的抽取邏輯完全依賴座標及字體，所以測試直接砌 `pdftohtml -xml` 的輸出，
 * 而唔係搬一份幾十頁的 PDF 入 repo。每個 case 對應一種真實版面。
 */
function page(number: number, runs: Run[]) {
  const specs = new Map<string, number>();
  const texts = runs.map((run) => {
    const key = `${run.size ?? 12}|${run.family ?? "Arial"}|${run.color ?? "#000000"}`;
    if (!specs.has(key)) specs.set(key, specs.size);
    const width = run.width ?? run.text.length * 6;
    return `<text top="${run.top}" left="${run.left}" width="${width}" height="14" font="${specs.get(key)}">${run.text}</text>`;
  });
  const fontspecs = [...specs].map(
    ([key, id]) =>
      `<fontspec id="${id}" size="${key.split("|")[0]}" family="${key.split("|")[1]}" color="${key.split("|")[2]}"/>`,
  );
  return `<page number="${number}" height="1200" width="900">${fontspecs.join("")}${texts.join("")}</page>`;
}

function pdf(...pages: string[]) {
  return parsePdfXml(`<pdf2xml>${pages.join("")}</pdf2xml>`);
}

const baseContract = {
  scheme: "Test Scheme",
  title: { pattern: /Fund$/, size: undefined },
  asOf: { pattern: /As at\s+(\d{1,2}\/\d{1,2}\/\d{4})/i },
} as const;

describe("joinItems", () => {
  it("glues runs that touch and keeps a space where the layout has a gap", () => {
    // 中銀保誠把 `8.4%` 拆成四段緊貼的文字；一律加空格會變成 `8 . 4 %`，等於改寫原文。
    const [first] = pdf(
      page(1, [
        { top: 10, left: 100, text: "8", width: 6 },
        { top: 10, left: 106, text: ".", width: 3 },
        { top: 10, left: 109, text: "4", width: 6 },
        { top: 10, left: 115, text: "%", width: 8 },
        { top: 10, left: 200, text: "of NAV", width: 40 },
      ]),
    );
    expect(joinItems(first!.items)).toBe("8.4% of NAV");
  });
});

describe("parseFactSheetDate", () => {
  it("reads the formats the 24 fact sheets actually use", () => {
    expect(parseFactSheetDate("31/3/2026")).toBe("2026-03-31");
    expect(parseFactSheetDate("30 September 2025")).toBe("2025-09-30");
    expect(parseFactSheetDate("December 31, 2025")).toBe("2025-12-31");
    expect(parseFactSheetDate("2025年12月31日")).toBe("2025-12-31");
  });

  it("refuses to guess at a date it cannot read", () => {
    expect(() => parseFactSheetDate("Q4 2025")).toThrow(/Unreadable fact sheet date/);
  });
});

describe("findFactSheetAsOf", () => {
  it("takes the latest date when a stale one is overlaid on the same line", () => {
    // 中國人壽的封面把舊版的日期疊在新日期上面，兩段文字會併成同一行。
    const pages = pdf(
      page(1, [
        { top: 20, left: 100, text: "As at 30/09/2023", width: 120 },
        { top: 21, left: 130, text: "As at 31/12/2025", width: 120 },
      ]),
    );
    const contract = {
      ...baseContract,
      title: { pattern: /Fund$/ },
      allocation: { heading: /never/ },
      holdings: { heading: /never/ },
      asOf: { pattern: /As at\s+(\d{1,2}\/\d{1,2}\/\d{4})/i, pick: "latest" as const },
    } satisfies FactSheetContract;
    expect(findFactSheetAsOf(pages, contract)).toBe("2025-12-31");
  });
});

describe("findSections", () => {
  it("keeps footnote markers out of the fund name", () => {
    const pages = pdf(
      page(1, [
        { top: 20, left: 30, text: "Growth Fund^", size: 18, family: "Head" },
        { top: 400, left: 30, text: "Stable Fund", size: 18, family: "Head" },
      ]),
    );
    const sections = findSections(pages, {
      pattern: /Fund[\^*]?$/,
      fontSize: [18],
      name: (text) => text.replace(/[\^*]+$/, "").trim(),
    });
    expect(sections.map((section) => section.name)).toEqual([
      "Growth Fund",
      "Stable Fund",
    ]);
    expect(sections[0]?.end).toEqual({ page: 1, top: 400 });
  });
});

/** 滙豐版面：百分比排在標籤左邊，長標籤換行落在數值那行之後。 */
const hsbcShaped: FactSheetContract = {
  scheme: "Test Scheme",
  title: { pattern: /Fund$/, fontSize: [18] },
  allocation: {
    heading: /^Portfolio allocation$/,
    band: { minLeft: 300, maxLeft: 590 },
    valueMinLeft: 400,
    valueMaxLeft: 450,
    joinTrailingLabels: true,
  },
  holdings: {
    // 標題已經寫咗 `(%)`，所以數值本身唔帶百分號。
    heading: /^Top 10 holdings$/,
    band: { minLeft: 300, maxLeft: 590 },
    numberFormat: "bare",
    valueMinLeft: 480,
  },
  asOf: { pattern: /As at\s+(\d{1,2}\/\d{1,2}\/\d{4})/i },
};

describe("table blocks", () => {
  it("pairs a value that sits left of its label and re-joins a wrapped Chinese label", () => {
    const pages = pdf(
      page(1, [
        { top: 10, left: 30, text: "As at 31/12/2025", width: 110 },
        { top: 20, left: 30, text: "Core Fund", size: 18, width: 90 },
        { top: 60, left: 310, text: "Portfolio allocation", width: 110 },
        { top: 90, left: 420, text: "41.7%", width: 30 },
        { top: 90, left: 455, text: "北美股票 North American Equities", width: 180 },
        { top: 105, left: 420, text: "5.0%", width: 28 },
        { top: 105, left: 455, text: "亞太股票（中國內地╱香港╱", width: 150 },
        { top: 120, left: 455, text: "日本除外）Asia Pacific Equities", width: 170 },
        { top: 200, left: 310, text: "Top 10 holdings", width: 100 },
        { top: 230, left: 319, text: "NVIDIA Corp", width: 80 },
        { top: 230, left: 561, text: "2.8", width: 20 },
      ]),
    );
    const [disclosure] = parseFactSheetDisclosures(pages, hsbcShaped);

    expect(disclosure?.allocations[0]?.entries).toEqual([
      { label: "北美股票 North American Equities", percent: 41.7 },
      {
        // 中文標籤換行時原文沒有空格，接駁時不可以加。
        label: "亞太股票（中國內地╱香港╱日本除外）Asia Pacific Equities",
        percent: 5,
      },
    ]);
    expect(disclosure?.topHoldings).toEqual([
      { rank: 1, security: "NVIDIA Corp", percent: 2.8 },
    ]);
    expect(disclosure?.unavailableFields).toEqual([]);
  });

  it("reports the whole block unavailable when a row has a value but no name", () => {
    // 宏利環球精選有部分證券名稱畫成向量。靜默丟走這些行會令名單短一截、排名整體移位。
    const pages = pdf(
      page(1, [
        { top: 10, left: 30, text: "As at 31/12/2025", width: 110 },
        { top: 20, left: 30, text: "Core Fund", size: 18, width: 90 },
        { top: 200, left: 310, text: "Top 10 holdings", width: 100 },
        { top: 230, left: 319, text: "NVIDIA Corp", width: 80 },
        { top: 230, left: 561, text: "2.8", width: 20 },
        { top: 245, left: 561, text: "2.5", width: 20 },
      ]),
    );
    const [disclosure] = parseFactSheetDisclosures(pages, hsbcShaped);

    expect(disclosure?.topHoldings).toEqual([]);
    expect(disclosure?.unavailableFields).toContain("topHoldings");
    expect(disclosure?.unavailableReasons.topHoldings).toMatch(
      /without an extractable security name/,
    );
  });
});

/** 中銀保誠及交銀版面：圓餅圖旁邊的置中標註，中文名、英文名、百分比同一個中心 x。 */
const calloutShaped: FactSheetContract = {
  scheme: "Test Scheme",
  title: { pattern: /Fund$/, fontSize: [18] },
  allocation: {
    heading: /^Asset Allocation$/,
    band: { minLeft: 400, maxLeft: 900 },
    callouts: {},
  },
  holdings: { heading: /^never$/ },
  asOf: { pattern: /As at\s+(\d{1,2}\/\d{1,2}\/\d{4})/i },
};

describe("pie-chart callouts", () => {
  it("pairs each slice with its own label even when two share a baseline", () => {
    const pages = pdf(
      page(1, [
        { top: 10, left: 30, text: "As at 31/12/2025", width: 110 },
        { top: 20, left: 30, text: "Core Fund", size: 18, width: 90 },
        { top: 60, left: 430, text: "Asset Allocation", width: 100 },
        // 左邊標註，中心 482
        { top: 100, left: 458, text: "基礎材料", width: 48 },
        { top: 112, left: 443, text: "Basic Materials", width: 78 },
        { top: 124, left: 469, text: "5.4%", width: 26 },
        // 右邊標註，中心 818；百分比同左邊那個排在同一條基線上
        { top: 100, left: 806, text: "公用事業", width: 48 },
        { top: 112, left: 812, text: "Utilities", width: 36 },
        { top: 124, left: 816, text: "2.1%", width: 26 },
        // 左邊第二個標註，緊接住上一個，中心一樣
        { top: 145, left: 458, text: "醫療保健", width: 48 },
        { top: 157, left: 452, text: "Health Care", width: 60 },
        { top: 169, left: 469, text: "5.9%", width: 26 },
      ]),
    );
    const [disclosure] = parseFactSheetDisclosures(pages, calloutShaped);

    expect(disclosure?.allocations[0]?.entries).toEqual([
      { label: "基礎材料 Basic Materials", percent: 5.4 },
      { label: "公用事業 Utilities", percent: 2.1 },
      // 標註以百分比作結；不封組的話這一項會被上一項吸走。
      { label: "醫療保健 Health Care", percent: 5.9 },
    ]);
  });
});

describe("unextractable blocks", () => {
  it("records why a block was skipped instead of publishing partial rows", () => {
    const pages = pdf(
      page(1, [
        { top: 10, left: 30, text: "As at 31/12/2025", width: 110 },
        { top: 20, left: 30, text: "Core Fund", size: 18, width: 90 },
        { top: 60, left: 310, text: "Portfolio allocation", width: 110 },
        { top: 90, left: 420, text: "41.7%", width: 30 },
        { top: 90, left: 455, text: "Equities", width: 60 },
      ]),
    );
    const [disclosure] = parseFactSheetDisclosures(pages, {
      ...hsbcShaped,
      allocation: {
        ...hsbcShaped.allocation,
        unextractable: "the chart's labels are drawn as vector art, not text",
      },
    });

    expect(disclosure?.allocations).toEqual([]);
    expect(disclosure?.unavailableReasons.allocation).toBe(
      "the chart's labels are drawn as vector art, not text",
    );
  });
});

describe("pairing to platform constituent funds", () => {
  const disclosure = (constituentFundName: string): FactSheetDisclosure => ({
    schemeName: "BCT (MPF) Pro Choice",
    constituentFundName,
    factSheetAsOf: "2025-12-31",
    allocations: [{ heading: "Portfolio Allocation", entries: [{ label: "Equities", percent: 100 }] }],
    topHoldings: [],
    unavailableFields: ["topHoldings"],
    unavailableReasons: { topHoldings: "no holdings rows in the disclosed block" },
  });

  const platformFund = (constituentFundName: string) => ({
    schemeName: "BCT (MPF) Pro Choice",
    constituentFundName,
    fundClassIds: ["mpfa-cf-1", "mpfa-cf-2"],
  });

  it("strips the scheme's declared platform prefix and shares one disclosure across fund classes", () => {
    const result = pairFactSheetDisclosures(
      [platformFund("BCT (Pro) Asian Equity Fund")],
      [disclosure("Asian Equity Fund")],
      /^BCT \((?:Industry|Pro)\)\s+/,
    );

    expect(result.paired).toEqual([
      {
        fundClassIds: ["mpfa-cf-1", "mpfa-cf-2"],
        schemeName: "BCT (MPF) Pro Choice",
        constituentFundName: "BCT (Pro) Asian Equity Fund",
        factSheetAsOf: "2025-12-31",
        allocationDimensions: 1,
        topHoldings: 0,
        unavailableFields: ["topHoldings"],
        unavailableReasons: { topHoldings: "no holdings rows in the disclosed block" },
      },
    ]);
    expect(result.unpairedPlatformFunds).toEqual([]);
    expect(result.unpairedDisclosures).toEqual([]);
  });

  it("refuses to pick a side when two sections share a fund name", () => {
    // 同一個名出現兩次代表區段切錯，隨便揀一個就可能配到另一隻基金的持倉。
    const result = pairFactSheetDisclosures(
      [platformFund("Asian Equity Fund")],
      [disclosure("Asian Equity Fund"), disclosure("Asian Equity Fund")],
    );

    expect(result.paired).toEqual([]);
    expect(result.unpairedPlatformFunds[0]?.reason).toMatch(/2 sections share this fund name/);
  });

  it("reports a platform fund the fact sheet does not cover", () => {
    const result = pairFactSheetDisclosures([platformFund("Retirement Income Fund")], []);

    expect(result.unpairedPlatformFunds[0]?.reason).toBe(
      "no section with this fund name in the scheme fact sheet",
    );
  });
});

describe("toLines", () => {
  it("groups runs whose baselines differ by a rounding error", () => {
    const [line, ...rest] = toLines(
      pdf(
        page(1, [
          { top: 100, left: 30, text: "Label", width: 40 },
          { top: 102, left: 200, text: "12.5%", width: 30 },
        ]),
      )[0]!,
    );
    expect(rest).toEqual([]);
    expect(line?.text).toBe("Label 12.5%");
  });
});
