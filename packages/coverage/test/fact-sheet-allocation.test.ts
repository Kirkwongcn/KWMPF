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

/**
 * 新地版面：中英對照分兩欄，左邊仲有基金概覽欄，腳註標記排在標籤左邊，
 * 配置表以「Total 總數」收尾，而十大持倉喺同一欄之下。
 */
const shkpShaped: FactSheetContract = {
  scheme: "Test Scheme",
  title: { pattern: /Fund(?:\s*Note\s*\d+)?$/, fontSize: [18] },
  allocation: {
    heading: /^Asset Allocation of Underlying Fund/,
    band: { minLeft: 490, maxLeft: 900 },
    valueMinLeft: 800,
    labelIgnore: /^[\d,.]+\s*%?$/,
    labelStrip: /^\d{1,2}\s+/,
    labelColumnGap: 20,
    rowGap: 12,
    joinTrailingLabels: true,
    stopAt: /^Total|總數/,
  },
  holdings: { heading: /^never$/ },
  asOf: { pattern: /As at\s+(\d{1,2}\/\d{1,2}\/\d{4})/i },
};

describe("bilingual two-column tables", () => {
  it("keeps a run whose baseline sits a point lower in its place on the row", () => {
    // 「香港」「/」「中國股票」係同一行，但斜線的基線低一點。淨係按 `top` 排會變成
    // 「香港 中國股票 /」，等於改寫原文。
    const pages = pdf(
      page(1, [
        { top: 10, left: 30, text: "As at 31/03/2026", width: 110 },
        { top: 20, left: 30, text: "Balanced Fund", size: 18, width: 90 },
        { top: 60, left: 531, text: "Asset Allocation of Underlying Fund", width: 220 },
        { top: 84, left: 531, text: "Hong Kong/China Equities", width: 144 },
        { top: 84, left: 706, text: "香港", width: 24 },
        { top: 85, left: 730, text: "/", width: 3 },
        { top: 84, left: 733, text: "中國股票", width: 48 },
        { top: 80, left: 848, text: "26%", width: 27 },
      ]),
    );
    const [disclosure] = parseFactSheetDisclosures(pages, shkpShaped);

    expect(disclosure?.allocations[0]?.entries).toEqual([
      { label: "Hong Kong/China Equities 香港/中國股票", percent: 26 },
    ]);
  });

  it("merges a row split around its value even when the table ends at a stop line", () => {
    // 名稱換行，數值垂直置中排在兩段名稱之間。`stopAt` 提早收表時仍然要合併，
    // 否則整塊會因為「有數值、冇名稱」而當成官方未提供。
    const pages = pdf(
      page(1, [
        { top: 10, left: 30, text: "As at 31/03/2026", width: 110 },
        { top: 20, left: 30, text: "Core Fund", size: 18, width: 90 },
        { top: 60, left: 539, text: "Asset Allocation of Underlying Fund", width: 224 },
        { top: 80, left: 439, text: "1,772.48", width: 83 },
        { top: 100, left: 539, text: "Asia Pacific Equity (ex", width: 122 },
        { top: 101, left: 726, text: "亞太區股票(日", width: 72 },
        { top: 108, left: 853, text: "12.00%", width: 44 },
        { top: 115, left: 539, text: "Japan/HK)", width: 60 },
        { top: 117, left: 726, text: "本、香港除外)", width: 84 },
        { top: 140, left: 539, text: "Total", width: 30 },
        { top: 140, left: 833, text: "100.00%", width: 51 },
      ]),
    );
    const [disclosure] = parseFactSheetDisclosures(pages, shkpShaped);

    // 逐欄併返，唔可以交錯成「亞太區股票(日 Japan/HK) 本、香港除外)」。
    expect(disclosure?.allocations[0]?.entries).toEqual([
      {
        label: "Asia Pacific Equity (ex Japan/HK) 亞太區股票(日本、香港除外)",
        percent: 12,
      },
    ]);
    expect(disclosure?.unavailableFields).not.toContain("allocation");
  });

  it("drops a footnote marker the extractor glued onto the label", () => {
    // 腳註標記印在標籤左邊的邊注，`pdftohtml` 有時把它同標籤併成同一段文字。
    const pages = pdf(
      page(1, [
        { top: 10, left: 30, text: "As at 31/03/2026", width: 110 },
        { top: 20, left: 30, text: "Core Fund", size: 18, width: 90 },
        { top: 60, left: 539, text: "Asset Allocation of Underlying Fund", width: 224 },
        { top: 84, left: 497, text: "4 Hong Kong/China Equities", width: 186 },
        { top: 88, left: 726, text: "香港/中國股票", width: 78 },
        { top: 87, left: 845, text: "1.94%", width: 39 },
        { top: 110, left: 539, text: "Japan Equities", width: 82 },
        { top: 110, left: 496, text: "5", width: 26 },
        { top: 111, left: 726, text: "日本股票", width: 48 },
        { top: 110, left: 845, text: "4.58%", width: 39 },
      ]),
    );
    const [disclosure] = parseFactSheetDisclosures(pages, shkpShaped);

    expect(disclosure?.allocations[0]?.entries).toEqual([
      { label: "Hong Kong/China Equities 香港/中國股票", percent: 1.94 },
      { label: "Japan Equities 日本股票", percent: 4.58 },
    ]);
  });

  it("re-reads a wrapped label by column instead of appending the whole line", () => {
    // 續行同樣分中英兩欄，直接接駁整行會變成「國際貨幣債券 (ex USD, ex HKD) (美元及港元除外)」。
    const pages = pdf(
      page(1, [
        { top: 10, left: 30, text: "As at 31/03/2026", width: 110 },
        { top: 20, left: 30, text: "Core Fund", size: 18, width: 90 },
        { top: 60, left: 539, text: "Asset Allocation of Underlying Fund", width: 224 },
        { top: 84, left: 539, text: "Global Currencies Bonds", width: 137 },
        { top: 84, left: 708, text: "國際貨幣債券", width: 72 },
        { top: 83, left: 839, text: "42.44%", width: 45 },
        { top: 105, left: 539, text: "(ex USD, ex HKD)", width: 96 },
        { top: 105, left: 708, text: "(美元及港元除外)", width: 102 },
      ]),
    );
    const [disclosure] = parseFactSheetDisclosures(pages, shkpShaped);

    expect(disclosure?.allocations[0]?.entries).toEqual([
      {
        label: "Global Currencies Bonds (ex USD, ex HKD) 國際貨幣債券 (美元及港元除外)",
        percent: 42.44,
      },
    ]);
  });
});

describe("column bounds", () => {
  /** 富達版面：同一區段內有幾個維度，右邊唔一定係另一塊披露，附錄再縮印一次同一批表。 */
  const fidelityShaped: FactSheetContract = {
    scheme: "Test Scheme",
    title: { pattern: /Fund$/, fontSize: [18] },
    allocation: {
      heading: /^Industry Breakdown$/,
      headingFontSize: [13],
      columnWidth: 250,
      leftSlack: 20,
    },
    holdings: { heading: /^never$/ },
    asOf: { pattern: /As at\s+(\d{1,2}\/\d{1,2}\/\d{4})/i },
  };

  it("stops at the declared column width when the next column is a footnote", () => {
    const pages = pdf(
      page(1, [
        { top: 10, left: 30, text: "As at 31/12/2025", width: 110 },
        { top: 20, left: 30, text: "Core Fund", size: 18, width: 90 },
        { top: 60, left: 365, text: "Industry Breakdown", size: 13, width: 111 },
        { top: 90, left: 483, text: "26.2%", width: 22 },
        { top: 91, left: 511, text: "Financials", width: 38 },
        // 註腳排在右邊，唔屬於呢一塊披露。
        { top: 91, left: 628, text: "The Fund Risk Indicator is measured by the", width: 234 },
      ]),
    );
    const [disclosure] = parseFactSheetDisclosures(pages, fidelityShaped);

    expect(disclosure?.allocations[0]?.entries).toEqual([
      { label: "Financials", percent: 26.2 },
    ]);
  });

  it("ignores the appendix copy of the same table printed in a smaller size", () => {
    // 最後一個區段一直讀到文件結尾，附錄用細字再印一次同一批表。
    const pages = pdf(
      page(1, [
        { top: 10, left: 30, text: "As at 31/12/2025", width: 110 },
        { top: 20, left: 30, text: "Core Fund", size: 18, width: 90 },
        { top: 60, left: 365, text: "Industry Breakdown", size: 13, width: 111 },
        { top: 90, left: 483, text: "26.2%", width: 22 },
        { top: 91, left: 511, text: "Financials", width: 38 },
      ]),
      page(2, [
        { top: 60, left: 365, text: "Industry Breakdown", size: 4, width: 40 },
        { top: 90, left: 483, text: "49.34%", width: 22 },
      ]),
    );
    const [disclosure] = parseFactSheetDisclosures(pages, fidelityShaped);

    expect(disclosure?.allocations[0]?.entries).toEqual([
      { label: "Financials", percent: 26.2 },
    ]);
    expect(disclosure?.unavailableFields).not.toContain("allocation");
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

describe("overlaid text layers", () => {
  it("refuses to attribute a row that carries two values in the value column", () => {
    // 永明那份便覽的文字層把另一隻基金的同一張表疊印在同一個位置，只差幾 pt。
    // 靠左界猜邊個屬邊隻基金就有機會配錯，寧可明講抽唔到。
    const pages = pdf(
      page(1, [
        { top: 10, left: 30, text: "As at 31/12/2025", width: 110 },
        { top: 20, left: 30, text: "Core Fund", size: 18, width: 90 },
        { top: 60, left: 566, text: "Top 10 holdings", width: 101 },
        { top: 90, left: 472, text: "Banco Santander S.A. Hong Kong", width: 244 },
        { top: 90, left: 475, text: "Microsoft Corp", width: 72 },
        { top: 90, left: 822, text: "3.5%", width: 23 },
        { top: 90, left: 825, text: "7.8%", width: 22 },
      ]),
    );
    const [disclosure] = parseFactSheetDisclosures(pages, {
      ...hsbcShaped,
      holdings: {
        heading: /^Top 10 holdings$/,
        band: { minLeft: 460, maxLeft: 900 },
        valueMinLeft: 780,
        rejectOverlaidRows: true,
      },
    });

    expect(disclosure?.topHoldings).toEqual([]);
    expect(disclosure?.unavailableReasons.topHoldings).toMatch(
      /overlays another fund's table/,
    );
  });
});

describe("values read off the end of a line", () => {
  it("reads a bare number off a row whose name ends in a date", () => {
    // BCT Simple／Smart 有部分列的數值同名稱併成同一段文字，而名稱以年份結尾
    // （`… 15/08/2027 4.13`）。要求名稱唔可以以數字結尾就會整列讀唔到。
    const pages = pdf(
      page(1, [
        { top: 10, left: 30, text: "As at 31/12/2025", width: 110 },
        { top: 20, left: 30, text: "Core Fund", size: 18, width: 90 },
        { top: 60, left: 34, text: "Top 10 holdings", width: 102 },
        {
          top: 90,
          left: 34,
          text: "UNITED STATES TREASURY NOTE/BOND 2.25% 15/08/2027 4.13",
          width: 288,
        },
      ]),
    );
    const [disclosure] = parseFactSheetDisclosures(pages, {
      ...hsbcShaped,
      holdings: {
        heading: /^Top 10 holdings$/,
        band: { minLeft: 20, maxLeft: 330 },
        numberFormat: "bare",
      },
    });

    expect(disclosure?.topHoldings).toEqual([
      {
        rank: 1,
        security: "UNITED STATES TREASURY NOTE/BOND 2.25% 15/08/2027",
        percent: 4.13,
      },
    ]);
  });
});

describe("callouts grouped by horizontal overlap", () => {
  it("pairs a right-aligned callout with its own percentage", () => {
    // MASS 的餅圖標註在餅左邊靠右對齊、右邊靠左對齊，中心對唔上；
    // 但每個標籤同佢自己個百分比一定橫向相交。
    const pages = pdf(
      page(1, [
        { top: 10, left: 30, text: "As at 31/12/2025", width: 110 },
        { top: 20, left: 30, text: "Core Fund", size: 18, width: 90 },
        { top: 60, left: 393, text: "Asset Allocation", width: 100 },
        // 餅右邊，靠左對齊
        { top: 100, left: 748, text: "Other equities", width: 31 },
        { top: 110, left: 748, text: "0.2%", width: 15 },
        // 餅左邊，靠右對齊；標籤由三段文字組成
        { top: 111, left: 425, text: "Other Asia", width: 8 },
        { top: 111, left: 433, text: "Pacific", width: 39 },
        { top: 111, left: 472, text: "equities", width: 16 },
        { top: 121, left: 474, text: "1.3%", width: 15 },
        { top: 132, left: 456, text: "Japan", width: 16 },
        { top: 132, left: 472, text: "equities", width: 16 },
        { top: 142, left: 474, text: "1.3%", width: 15 },
      ]),
    );
    const [disclosure] = parseFactSheetDisclosures(pages, {
      ...calloutShaped,
      allocation: {
        heading: /^Asset Allocation$/,
        band: { minLeft: 390, maxLeft: 900 },
        callouts: { overlap: true },
      },
    });

    expect(disclosure?.allocations[0]?.entries).toEqual([
      { label: "Other equities", percent: 0.2 },
      { label: "Other AsiaPacificequities", percent: 1.3 },
      // 標註以百分比作結；不封組的話「日本股票」會被上一個標註吸走。
      { label: "Japanequities", percent: 1.3 },
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

  it("carries the disclosure verbatim beside the counted summary", () => {
    // 覆蓋報告只需要數目，發布 payload 要原文，所以兩份輸出同時出，唔可以由數目倒推。
    const section = disclosure("Asian Equity Fund");
    const result = pairFactSheetDisclosures(
      [platformFund("BCT (Pro) Asian Equity Fund")],
      [section],
      /^BCT \((?:Industry|Pro)\)\s+/,
    );

    expect(result.pairedDisclosures).toEqual([
      { fundClassIds: ["mpfa-cf-1", "mpfa-cf-2"], disclosure: section },
    ]);
  });

  it("leaves out the disclosure of a fund it refused to pair", () => {
    const result = pairFactSheetDisclosures(
      [platformFund("Asian Equity Fund")],
      [disclosure("Asian Equity Fund"), disclosure("Asian Equity Fund")],
    );

    expect(result.pairedDisclosures).toEqual([]);
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
