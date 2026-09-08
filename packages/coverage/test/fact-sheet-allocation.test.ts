import { describe, expect, it } from "vitest";
import { joinItems, markWordStarts, parsePdfXml, toLines } from "../src/pdf-xml";
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

/** `pdftohtml -xml` 同 `pdftotext -bbox` 兩份輸出的頁闊比例，同真實便覽一樣係 1.5 倍。 */
const BBOX_SCALE = 1.5;

/**
 * `pdftotext -bbox` 的切詞輸出：逐頁列明 poppler 喺邊個座標開一個新詞。座標用
 * `page()` 那一套（`pdftohtml` 的整數格）寫，由呢度換算返 `pdftotext` 的點數，
 * 等測試連 `markWordStarts` 的換算及容差一齊行過。
 */
function wordStarts(...pages: { left: number; top: number }[][]) {
  const point = (value: number) => (value / BBOX_SCALE).toFixed(6);
  const body = pages
    .map(
      (starts) =>
        `<page width="${(900 / BBOX_SCALE).toFixed(6)}" height="${(1200 / BBOX_SCALE).toFixed(6)}">${starts
          .map(
            ({ left, top }) =>
              `<word xMin="${point(left)}" yMin="${point(top)}" xMax="${point(left + 10)}" yMax="${point(top + 10)}">w</word>`,
          )
          .join("")}</page>`,
    )
    .join("");
  return `<html><body>${body}</body></html>`;
}

/** `page()` 砌出嚟的頁，加埋 poppler 的切詞標記——即 `factSheetPages()` 真正餵落嚟那一種。 */
function pdfWithWords(pages: string[], starts: { left: number; top: number }[][]) {
  return markWordStarts(pdf(...pages), wordStarts(...starts));
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

  it("separates touching runs where poppler starts a new word", () => {
    // 海通「安老基金」的 `Bonds 債券`：兩段之間量到的空隙係 0（前一段的字寬啱啱食到
    // 下一段的左界），但 poppler 切成兩個詞，即原文印住有空格。座標抄自真實便覽。
    const [first] = pdfWithWords(
      [
        page(1, [
          { top: 697, left: 513, text: "Bonds", width: 25 },
          { top: 696, left: 538, text: "債券", width: 18 },
        ]),
      ],
      [[{ left: 513, top: 697 }, { left: 538, top: 696 }]],
    );
    // 兩段的 `top` 差 1 pt，同真實便覽一樣；靠 `toLines` 併返一行先排得返左右次序。
    expect(toLines(first!)[0]?.text).toBe("Bonds 債券");
  });

  it("glues touching runs that poppler calls one word", () => {
    // 同一份便覽的「強積金保守基金」印住 `Bond債券`——中英交界但係一個詞。唔可以
    // 一律喺中英交界加空格，否則呢度會改寫原文。座標抄自真實便覽。
    const [first] = pdfWithWords(
      [
        page(1, [
          { top: 174, left: 583, text: "Bond", width: 13 },
          { top: 173, left: 596, text: "債券", width: 12 },
        ]),
      ],
      [[{ left: 583, top: 174 }]],
    );
    expect(toLines(first!)[0]?.text).toBe("Bond債券");
  });

  it("ignores a word start that belongs to the line above", () => {
    // 同一頁最貼的兩行相隔 5 pt，容差 2 pt 唔可以夾到隔籬行嗰個詞頭。
    const [first] = pdfWithWords(
      [
        page(1, [
          { top: 15, left: 100, text: "Bond", width: 13 },
          { top: 15, left: 113, text: "債券", width: 12 },
        ]),
      ],
      [[{ left: 100, top: 15 }, { left: 113, top: 10 }]],
    );
    expect(toLines(first!)[0]?.text).toBe("Bond債券");
  });

  it("falls back to the horizontal gap when the word oracle was not run", () => {
    // 單元測試砌的頁冇跑過 `markWordStarts`，`startsWord` 係 `undefined`，
    // 接字只靠空隙——同加呢個訊號之前一樣。
    const [first] = pdf(
      page(1, [
        { top: 10, left: 100, text: "Bonds", width: 25 },
        { top: 10, left: 125, text: "債券", width: 18 },
        { top: 10, left: 200, text: "of NAV", width: 40 },
      ]),
    );
    expect(joinItems(first!.items)).toBe("Bonds債券 of NAV");
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

  /**
   * MASS 逐隻基金那份便覽把「Fund Data as at June 30, 2026」排喺左窄欄，斷開兩行，
   * 而同一條基線右邊仲有另一欄的「Fund Price (HKD)」。座標同真實 PDF 一樣。
   */
  const wrappedInNarrowColumn = pdf(
    page(1, [
      { top: 688, left: 29, text: "Fund Data as at June ", width: 158, size: 18 },
      { top: 691, left: 226, text: "Fund Price (HKD)", width: 126, size: 18 },
      { top: 709, left: 29, text: "30, 2026", width: 63, size: 18 },
    ]),
  );

  const narrowColumnContract = {
    ...baseContract,
    title: { pattern: /Fund$/ },
    allocation: { heading: /never/ },
    holdings: { heading: /never/ },
    asOf: {
      pattern: /As at\s+([A-Za-z]{3,}\s+\d{1,2},\s*\d{4})/i,
      band: { minLeft: 0, maxLeft: 200 },
      joinWrappedLines: true as const,
    },
  } satisfies FactSheetContract;

  it("reads a date that wraps onto the next line of a narrow column", () => {
    expect(findFactSheetAsOf(wrappedInNarrowColumn, narrowColumnContract)).toBe(
      "2026-06-30",
    );
  });

  it("refuses to read the date when the neighbouring column joins the line", () => {
    // 冇橫向範圍嘅話，「Fund Data as at June」會併埋隔籬欄嘅「Fund Price (HKD)」，
    // 日期就唔再連續。寧願報錯，都好過抽錯一個日期當成官方截至日。
    const { band, ...asOf } = narrowColumnContract.asOf;
    expect(() =>
      findFactSheetAsOf(wrappedInNarrowColumn, { ...narrowColumnContract, asOf }),
    ).toThrow(/fact sheet as-of date not found/);
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

  it("takes the first-drawn title when another fund's page is overlaid on top of it", () => {
    // 永明每一版都把另一隻基金的整版內容疊印上去，兩個標題同樣落喺 top≈82。
    // 邊個標題排得左啲會逐期改（2025-12-31 那期本頁嗰個在左，2026-06-30 那期
    // 疊上去嗰個在左），所以唔可以靠座標揀；內容流一定先寫本頁自己嗰版。
    const pages = pdf(
      page(1, [
        { top: 82, left: 44, text: "Conservative Fund", size: 27, family: "Display" },
        { top: 82, left: 42, text: "Low Carbon Index Fund", size: 27, family: "Display" },
      ]),
      page(2, [
        { top: 82, left: 44, text: "Growth Fund", size: 27, family: "Display" },
        { top: 138, left: 45, text: "Conservative Fund", size: 27, family: "Display" },
        { top: 82, left: 42, text: "Low Carbon Index Fund", size: 27, family: "Display" },
      ]),
    );
    const sections = findSections(pages, {
      pattern: /Fund$/,
      fontSize: [27],
      overlaidPages: true,
      maxTop: 160,
    });
    expect(sections.map((section) => section.name)).toEqual([
      "Conservative Fund",
      "Growth Fund",
    ]);
    // 疊上去嗰版由下一個標題落筆嗰刻開始，本頁自己嗰層讀到嗰度為止。
    expect(sections.map((section) => section.layer)).toEqual([
      { page: 1, endDrawIndex: 1 },
      { page: 2, endDrawIndex: 1 },
    ]);
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

/** 新地的十大持倉：橫跨成版，證券名同百分比的基線唔一定對齊。 */
const shkpHoldingsShaped: FactSheetContract = {
  ...shkpShaped,
  holdings: {
    heading: /^Top Ten Holdings of Underlying Fund/,
    band: { minLeft: 20, maxLeft: 900 },
    rowGap: 7,
  },
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

  it("pairs a holding whose percentage sits a few points off the security name", () => {
    // 受託人官網那份的百分比有幾行比證券名高五至六點，超出 `toLines` 的四點容差。
    // 逐行讀會變成「有百分比冇名稱」，整張十大持倉表當官方未提供，等於漏報披露。
    // 列距十四至十五點，所以七點併得返同一列而唔會吞埋下一列。
    const pages = pdf(
      page(1, [
        { top: 10, left: 30, text: "As at 30/06/2026", width: 110 },
        { top: 20, left: 30, text: "Balanced Fund", size: 18, width: 90 },
        { top: 582, left: 274, text: "Top Ten Holdings of Underlying Fund", width: 232 },
        { top: 599, left: 828, text: "10.94%", width: 47 },
        { top: 604, left: 46, text: "CSOP FTSE HONG KONG EQUITY ETF", width: 223 },
        { top: 618, left: 46, text: "INVESCO QQQ TRUST", width: 132 },
        { top: 618, left: 838, text: "5.38%", width: 37 },
      ]),
    );
    const [disclosure] = parseFactSheetDisclosures(pages, shkpHoldingsShaped);

    expect(disclosure?.topHoldings).toEqual([
      { rank: 1, security: "CSOP FTSE HONG KONG EQUITY ETF", percent: 10.94 },
      { rank: 2, security: "INVESCO QQQ TRUST", percent: 5.38 },
    ]);
    expect(disclosure?.unavailableFields).not.toContain("topHoldings");
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
    expect(disclosure?.unavailableKinds.topHoldings).toBe("overlaid-text-layer");
  });

  it("reads only the layer the section's own title belongs to", () => {
    // 永明疊印的係成版內容，唔淨係一行：標題、截至日期、十大持倉逐版重覆一次，
    // 座標近乎完全重疊。落筆次序係唯一分得開嘅線索——本頁自己嗰版一定先寫，
    // 之後嗰個標題開始就係疊上去嗰版（有幾版仲要係上兩季嘅舊數）。
    const pages = pdf(
      page(1, [
        { top: 10, left: 30, text: "As at 30/06/2026", width: 110 },
        { top: 20, left: 30, text: "Conservative Fund", size: 18, width: 130 },
        { top: 60, left: 566, text: "Top 10 holdings", width: 101 },
        { top: 90, left: 472, text: "Chong Hing Bank Limited 2.49%", width: 210 },
        { top: 90, left: 822, text: "1.3%", width: 21 },
        // 由呢度開始係疊上去嗰版，兩個 pt 之差，印出嚟見唔到分別。
        { top: 12, left: 28, text: "As at 30/09/2025", width: 110 },
        { top: 22, left: 28, text: "Growth Fund", size: 18, width: 130 },
        { top: 62, left: 564, text: "Top 10 holdings", width: 101 },
        { top: 92, left: 470, text: "Samsung Electronics Co Ltd", width: 190 },
        { top: 92, left: 820, text: "3.5%", width: 23 },
      ]),
    );
    const [disclosure, ...rest] = parseFactSheetDisclosures(pages, {
      ...hsbcShaped,
      title: { pattern: /Fund$/, fontSize: [18], overlaidPages: true, maxTop: 40 },
      holdings: {
        heading: /^Top 10 holdings$/,
        band: { minLeft: 460, maxLeft: 900 },
        valueMinLeft: 780,
        rejectOverlaidRows: true,
      },
    });

    expect(rest).toEqual([]);
    expect(disclosure?.constituentFundName).toBe("Conservative Fund");
    expect(disclosure?.topHoldings).toEqual([
      { rank: 1, security: "Chong Hing Bank Limited 2.49%", percent: 1.3 },
    ]);
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
    // 原因是診斷用的英文長句，網站唔可以靠字串比對反推分類，所以另附代號。
    expect(disclosure?.unavailableKinds.allocation).toBe("chart-only");
  });

  it("tells a block the fact sheet never carried apart from one it could not read", () => {
    const pages = pdf(
      page(1, [
        { top: 10, left: 30, text: "As at 31/12/2025", width: 110 },
        { top: 20, left: 30, text: "Core Fund", size: 18, width: 90 },
        { top: 60, left: 310, text: "Portfolio allocation", width: 110 },
        { top: 90, left: 420, text: "41.7%", width: 30 },
        { top: 90, left: 455, text: "Equities", width: 60 },
      ]),
    );
    const [disclosure] = parseFactSheetDisclosures(pages, hsbcShaped);

    expect(disclosure?.unavailableKinds.topHoldings).toBe("not-disclosed");
    expect(disclosure?.unavailableFields).toContain("topHoldings");
    expect(disclosure?.unavailableKinds.allocation).toBeUndefined();
  });

  it("classifies a block whose values lost their names", () => {
    const pages = pdf(
      page(1, [
        { top: 10, left: 30, text: "As at 31/12/2025", width: 110 },
        { top: 20, left: 30, text: "Core Fund", size: 18, width: 90 },
        { top: 60, left: 310, text: "Portfolio allocation", width: 110 },
        { top: 90, left: 420, text: "41.7%", width: 30 },
      ]),
    );
    const [disclosure] = parseFactSheetDisclosures(pages, hsbcShaped);

    expect(disclosure?.allocations).toEqual([]);
    expect(disclosure?.unavailableKinds.allocation).toBe("values-without-names");
  });
});

/**
 * 海通受託人官網「Fund Monitor」：長條圖式配置，英文標籤、百分比、中文標籤三段
 * 分別排喺 top 相差 4 至 10 pt（唔跟正常表格對齊喺同一行），圖表底下仲有一行
 * 座標軸刻度（`0% 10% 20% 30% ...`），同真正嘅資料行長得一樣但冇標籤。座標抄自
 * 真實便覽（`ASSET ALLOCATION (BY SECTORS)`，2026-07-31 那期）。
 */
const haitongTrusteeShaped: FactSheetContract = {
  scheme: "Test Scheme",
  title: { pattern: /Fund$/, fontSize: [18] },
  allocation: {
    heading: /^ASSET ALLOCATION/,
    headingLabel: (text) => text,
    band: { minLeft: 420, maxLeft: 900 },
    ignore: /^0%(\s+\d+%)+$/,
    rowGap: 8,
  },
  holdings: {
    heading: /^TOP TEN HOLDINGS$/,
    band: { minLeft: 420, maxLeft: 900 },
    numberFormat: "bare",
    valueMinLeft: 700,
  },
  asOf: { pattern: /As of\s+(\d{1,2}\/\d{1,2}\/\d{4})/i },
};

describe("Haitong trustee bar chart", () => {
  it("merges the English label, bar value and Chinese label despite the vertical offset", () => {
    const pages = pdf(
      page(1, [
        { top: 10, left: 30, text: "as of 31/07/2026", width: 110 },
        { top: 20, left: 30, text: "Haitong Hong Kong SAR Fund", size: 18, width: 210 },
        { top: 114, left: 451, text: "ASSET ALLOCATION (BY SECTORS)", width: 242 },
        { top: 148, left: 471, text: "Financials & Insurance", width: 75 },
        { top: 153, left: 769, text: "37.94%", width: 25 },
        { top: 157, left: 488, text: "金融及保險", width: 41 },
        { top: 170, left: 518, text: "TMT", width: 15 },
        { top: 176, left: 646, text: "15.19%", width: 25 },
        { top: 180, left: 505, text: "電訊多媒體", width: 41 },
        // 座標軸刻度：以 `0%` 起首，冇標籤，唔屬於任何一項配置。
        { top: 332, left: 548, text: "0%", width: 10 },
        { top: 332, left: 602, text: "10%", width: 14 },
        { top: 332, left: 657, text: "20%", width: 14 },
        { top: 332, left: 712, text: "30%", width: 14 },
        { top: 332, left: 768, text: "40%", width: 14 },
        { top: 359, left: 445, text: "TOP TEN HOLDINGS", width: 120 },
        { top: 426, left: 722, text: "10.02", width: 25 },
        { top: 427, left: 439, text: "HSBC Holdings PLC", width: 83 },
      ]),
    );
    const [disclosure] = parseFactSheetDisclosures(pages, haitongTrusteeShaped);

    expect(disclosure?.allocations).toEqual([
      {
        heading: "ASSET ALLOCATION (BY SECTORS)",
        entries: [
          { label: "Financials & Insurance 金融及保險", percent: 37.94 },
          { label: "TMT 電訊多媒體", percent: 15.19 },
        ],
      },
    ]);
    expect(disclosure?.topHoldings).toEqual([
      { rank: 1, security: "HSBC Holdings PLC", percent: 10.02 },
    ]);
    expect(disclosure?.unavailableFields).toEqual([]);
  });

  it("does not mistake the axis tick row for a values-without-names gap", () => {
    // 冚唪唥剔走軸線之後，得返一項真正嘅配置，唔可以因為軸線而報成官方未提供。
    // 呢一版印住 `Bond債券`（poppler 切成一個詞），唔同「安老基金」嗰版的 `Bonds 債券`。
    const pages = pdfWithWords(
      [
        page(1, [
          { top: 10, left: 30, text: "as of 31/07/2026", width: 110 },
          { top: 20, left: 30, text: "Haitong MPF Conservative Fund", size: 18, width: 230 },
          { top: 105, left: 434, text: "ASSET ALLOCATION (BY SECTORS)", width: 243 },
          { top: 173, left: 596, text: "債券", width: 12 },
          { top: 174, left: 583, text: "Bond", width: 13 },
          { top: 181, left: 586, text: "23.18%", width: 19 },
          { top: 332, left: 548, text: "0%", width: 10 },
          { top: 332, left: 602, text: "50%", width: 14 },
          { top: 359, left: 445, text: "TOP TEN HOLDINGS", width: 120 },
        ]),
      ],
      [
        [
          { left: 30, top: 10 },
          { left: 30, top: 20 },
          { left: 434, top: 105 },
          { left: 583, top: 174 },
          { left: 586, top: 181 },
          { left: 548, top: 332 },
          { left: 602, top: 332 },
          { left: 445, top: 359 },
        ],
      ],
    );
    const [disclosure] = parseFactSheetDisclosures(pages, haitongTrusteeShaped);

    expect(disclosure?.allocations[0]?.entries).toEqual([
      { label: "Bond債券", percent: 23.18 },
    ]);
    expect(disclosure?.unavailableKinds.allocation).toBeUndefined();
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
    unavailableKinds: { topHoldings: "not-disclosed" },
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
