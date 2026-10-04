import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePdfXml, type PdfTextItem } from "../src/pdf-xml";
import {
  markSharedNarrative,
  findSections,
  parseFactSheetDisclosures,
  sectionItems,
} from "../src/fact-sheet-allocation";
import { factSheetContract } from "../src/fact-sheet-allocation-contracts";
import { readNarrative, readNarrativeField, type TextBlockSelector } from "../src/fact-sheet-narrative";

const hsbc = factSheetContract("HSBC Mandatory Provident Fund - SuperTrust Plus", "trustee");

/** 真實滙豐 2026 年第二季便覽的單頁 `pdftohtml -xml -i -hidden` 輸出。 */
function fundItems(fixture: string, fund: string) {
  const pages = parsePdfXml(
    readFileSync(join(import.meta.dirname, "fixtures", fixture), "utf8"),
  );
  const section = findSections(pages, hsbc.title).find((candidate) => candidate.name === fund);
  if (!section) throw new Error(`${fund} not in ${fixture}`);
  return sectionItems(pages, section);
}

function item(top: number, left: number, text: string, width = text.length * 6, fontSize = 9): PdfTextItem {
  return { page: 1, drawIndex: top * 10 + left, top, left, width, height: 10, fontSize, fontFamily: "Arial", fontColor: "#000000", text };
}

const selector: TextBlockSelector = {
  heading: /^(投資目標|Investment Objective)$/,
  band: { minLeft: 0, maxLeft: 400 },
  languages: "bilingual",
};

describe("official narrative text", () => {
  it("reads the HSBC objective verbatim and splits Chinese from English", () => {
    const items = fundItems("hsbc-2026-q2-hk-chinese-equity.xml", "Hong Kong and Chinese Equity Fund");
    const result = readNarrativeField(items, hsbc.narrative!.investmentObjective!);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.text.heading).toBe("投資目標及其他詳情 Investment objectives and other particulars");
    // 排版空格（「經審 慎挑選」）刪走，原文用字不變。
    expect(result.text.zh).toMatch(/^透過主要投資於經審慎挑選並在香港聯合交易所上市的股份組合，/);
    expect(result.text.zh).toMatch(/在其他交易所上市的證券。$/);
    expect(result.text.en).toMatch(/^Achieve long-term capital growth through primarily investing in a portfolio/);
    expect(result.text.en).toMatch(/that are listed on other stock exchanges\.$/);
    expect(result.text.en).not.toMatch(/基金資料|Fund details/);
  });

  it("keeps every commentary bullet and its figures exactly as printed", () => {
    const items = fundItems("hsbc-2026-q2-hk-chinese-equity.xml", "Hong Kong and Chinese Equity Fund");
    const result = readNarrativeField(items, hsbc.narrative!.managerCommentary!);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.text.zh?.split("\n")).toHaveLength(4);
    expect(result.text.en?.split("\n")).toHaveLength(4);
    expect(result.text.zh).toContain("貸款增速較去年同期放緩至5.6%的歷史新低");
    expect(result.text.en).toContain("supported by China’s RMB2 trillion AI capex plan");
    expect(result.text.en).toContain("Southbound Stock Connect recorded HKD27 billion of inflows in June");
    // 下面的基金表現表頭唔屬評論。
    expect(result.text.en).not.toMatch(/Cumulative return|Since launch/);
  });

  it("stops before a notice that sits below the commentary column", () => {
    const items = fundItems("hsbc-2026-q2-global-equity.xml", "Global Equity Fund");
    const result = readNarrativeField(items, hsbc.narrative!.managerCommentary!);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.text.en).toMatch(/continued to favour AI supply-chain exposure\.$/);
    expect(result.text.en).not.toContain("With effect from");
    expect(result.text.zh).not.toContain("合併");
  });

  it("reports a missing heading as not disclosed instead of borrowing other text", () => {
    const result = readNarrative([item(100, 40, "Fund details"), item(120, 40, "Some other text")], selector);
    expect(result).toMatchObject({ status: "not-disclosed" });
  });

  it("refuses text when another version is overlaid at the same position", () => {
    const result = readNarrative(
      [
        item(100, 40, "Investment Objective"),
        item(120, 40, "Seeks long-term capital growth."),
        item(121, 42, "Seeks stable income with low volatility."),
      ],
      selector,
    );
    expect(result).toMatchObject({ status: "overlaid" });
  });

  it("keeps one copy of text printed twice for a bold effect", () => {
    const result = readNarrative(
      [
        item(100, 40, "Investment Objective"),
        item(120, 40, "Seeks long-term capital growth."),
        item(122, 42, "Seeks long-term capital growth."),
      ],
      selector,
    );
    expect(result).toMatchObject({ status: "ok", text: { en: "Seeks long-term capital growth." } });
  });

  it("joins wrapped Chinese without spaces but keeps spaces between English words", () => {
    const result = readNarrative(
      [
        item(100, 40, "投資目標"),
        item(120, 40, "尋求為成員提供長 期"),
        item(132, 40, "的資本增長。"),
        item(144, 40, "Seeks to provide members with"),
        item(156, 40, "long-term capital growth."),
      ],
      selector,
    );
    expect(result).toMatchObject({
      status: "ok",
      text: { zh: "尋求為成員提供長期的資本增長。", en: "Seeks to provide members with long-term capital growth." },
    });
  });

  it("adds no space where a Chinese line wraps onto a number or English word", () => {
    const result = readNarrative(
      [
        item(100, 40, "投資目標"),
        item(120, 40, "指數跌至47.5，為"),
        item(132, 40, "2023年以來最低，主要來自"),
        item(144, 40, "Momentum 及價值因子。"),
      ],
      selector,
    );
    expect(result).toMatchObject({
      status: "ok",
      text: { zh: "指數跌至47.5，為2023年以來最低，主要來自Momentum 及價值因子。" },
    });
  });

  it("keeps the source's own spaces but not poppler's word breaks at a font change", () => {
    const result = readNarrative(
      [
        item(100, 40, "Investment Objective"),
        // 「CSI HK 」「100」「 Tracker」座標黐埋，空格只喺原文段落頭尾。
        { ...item(120, 40, "The CSI HK", 60), spaceAfter: true },
        item(120, 100, "100", 18),
        { ...item(120, 118, "Tracker fund. The Investment Mana", 200), spaceBefore: true },
        // 另一字款印的「’」令 poppler 開新詞，但原文冇空格。
        { ...item(120, 318, "ger’s view.", 60), startsWord: true },
        item(132, 40, "The BOC-"),
        item(144, 40, "Prudential fund."),
      ],
      selector,
    );
    expect(result).toMatchObject({
      status: "ok",
      text: { en: "The CSI HK 100 Tracker fund. The Investment Manager’s view. The BOC-Prudential fund." },
    });
  });

  it("drops layout spaces around full-width punctuation", () => {
    const result = readNarrative(
      [item(100, 40, "投資目標"), item(120, 40, "指數升至53.2 、失業率維持3.7% 。（ 註 ）")],
      selector,
    );
    expect(result).toMatchObject({ status: "ok", text: { zh: "指數升至53.2、失業率維持3.7%。（註）" } });
  });

  it("ends the block at a large vertical gap", () => {
    const result = readNarrative(
      [item(100, 40, "Investment Objective"), item(120, 40, "Seeks growth."), item(200, 40, "Unrelated notice.")],
      { ...selector, maxGap: 24 },
    );
    expect(result).toMatchObject({ status: "ok", text: { en: "Seeks growth." } });
  });
});

describe("narrative layouts", () => {
  it("refuses text whose end marker is not on the page, because it continues elsewhere", () => {
    const selector: TextBlockSelector = {
      heading: /^Market Review and Outlook$/,
      band: { minLeft: 0, maxLeft: 900 },
      endAt: /^\^?\s*Sources\s*:/,
      languages: "bilingual",
    };
    const complete = readNarrative(
      [
        item(100, 40, "Market Review and Outlook"),
        item(120, 40, "Rates rose. Source: Bloomberg, June 30, 2026."),
        item(140, 40, "^Sources: Manager Limited"),
      ],
      selector,
    );
    expect(complete).toMatchObject({ status: "ok", text: { en: "Rates rose. Source: Bloomberg, June 30, 2026." } });
    const continues = readNarrative(
      [item(100, 40, "Market Review and Outlook"), item(120, 40, "Rates rose and")],
      selector,
    );
    expect(continues.status).toBe("unreadable-layout");
  });

  it("refuses text whose layout switches to side-by-side columns", () => {
    const result = readNarrative(
      [
        item(100, 26, "投資政策"),
        item(120, 26, "本基金投資於貨幣市場。"),
        item(140, 26, "此成分基金須承受貨幣風險。"),
        item(146, 383, "This fund is subject to currency risk."),
        item(200, 60, "計劃詳情請參閱計劃說明書。"),
      ],
      {
        heading: /^投資政策$/,
        band: { minLeft: 10, maxLeft: 420 },
        columns: [{ minLeft: 10, maxLeft: 420, lineStart: { minLeft: 10, maxLeft: 45, otherwise: "fail" } }],
        stopAt: /^計劃詳情/,
        languages: "bilingual",
      },
    );
    expect(result.status).toBe("unreadable-layout");
  });

  it("starts a new paragraph where the gap is well above the normal line spacing", () => {
    const result = readNarrative(
      [
        item(100, 40, "Investment Objective"),
        item(120, 40, "First paragraph line one"),
        item(134, 40, "line two."),
        item(148, 40, "line three."),
        item(176, 40, "Second paragraph."),
      ],
      selector,
    );
    expect(result).toMatchObject({
      status: "ok",
      text: { en: "First paragraph line one line two. line three.\nSecond paragraph." },
    });
  });

  it("reads every page that repeats the heading, without treating the pages as overlays", () => {
    const page2 = (top: number, left: number, text: string) => ({ ...item(top, left, text), page: 2 });
    const selector: TextBlockSelector = {
      heading: /^市場評論$/,
      occurrence: "all",
      band: { minLeft: 600, maxLeft: 900 },
      languages: "bilingual",
    };
    const result = readNarrative(
      [
        item(170, 607, "市場評論"),
        item(200, 607, "大中華股票上升。"),
        page2(170, 607, "市場評論"),
        page2(200, 607, "Greater China equities rose."),
      ],
      selector,
    );
    expect(result).toEqual({
      status: "ok",
      text: { heading: "市場評論", zh: "大中華股票上升。", en: "Greater China equities rose." },
    });
  });

  it("merges English and Chinese printed on separate pages, failing the field if either is missing", () => {
    const en: TextBlockSelector = {
      heading: /^Investment Objective$/,
      band: { minLeft: 0, maxLeft: 400 },
      languages: "en",
    };
    const zh: TextBlockSelector = { heading: /^投資目標$/, band: { minLeft: 0, maxLeft: 400 }, languages: "zh" };
    const page2 = (top: number, left: number, text: string) => ({ ...item(top, left, text), page: 2 });
    const both = readNarrativeField(
      [item(100, 20, "Investment Objective"), item(120, 20, "To achieve growth."), page2(100, 20, "投資目標"), page2(120, 20, "達致增長。")],
      [en, zh],
    );
    expect(both).toEqual({
      status: "ok",
      text: { heading: "Investment Objective / 投資目標", en: "To achieve growth.", zh: "達致增長。" },
    });
    const englishOnly = readNarrativeField(
      [item(100, 20, "Investment Objective"), item(120, 20, "To achieve growth.")],
      [en, zh],
    );
    expect(englishOnly.status).toBe("not-disclosed");
  });

  it("continues into another column only below its marker line, skipping chart labels", () => {
    const overflow: TextBlockSelector = {
      heading: /^Commentary$/,
      band: { minLeft: 0, maxLeft: 900 },
      columns: [
        { minLeft: 0, maxLeft: 375 },
        { minLeft: 375, maxLeft: 900, after: /\bSource:/, lineStart: { minLeft: 375, maxLeft: 395 } },
      ],
      maxGap: 24,
      languages: "bilingual",
    };
    const result = readNarrative(
      [
        item(100, 40, "Commentary"),
        item(120, 40, "Markets rose while demand (e.g. auto"),
        // 右欄：十大資產及來源行之上的內容唔讀；之下的圓餅圖標註唔由欄邊開始。
        item(120, 560, "Top 10 Holdings"),
        item(140, 560, "Source: Asset Manager Limited"),
        item(142, 450, "22.4%"),
        item(150, 384, "consumption) stayed weak."),
        item(160, 400, "Healthcare 1.6%"),
        item(170, 384, "We stay cautious."),
      ],
      overflow,
    );
    expect(result).toMatchObject({
      status: "ok",
      text: { en: "Markets rose while demand (e.g. auto consumption) stayed weak. We stay cautious." },
    });
  });

  it("reads a value centred on its label from the first Chinese line", () => {
    const manager: TextBlockSelector = {
      heading: /^投資經理$/,
      band: { minLeft: 420, maxLeft: 900 },
      minDepth: -20,
      maxDepth: 30,
      startAt: /\p{Script=Han}/u,
      maxGap: 18,
      languages: "bilingual",
    };
    // 一行長的值：上一格（基金類型描述）的英文值落到標籤上 19 pt，要略過。
    const single = readNarrative(
      [
        item(100, 360, "投資經理"),
        item(81, 580, "Equity Fund - Global"),
        item(98, 580, "宏利投資管理（香港）有限公司"),
        item(114, 580, "Manulife Investment Management (Hong Kong) Limited"),
        item(160, 580, "1. Tencent Holdings"),
      ],
      manager,
    );
    expect(single).toMatchObject({
      status: "ok",
      text: {
        zh: "宏利投資管理（香港）有限公司",
        en: "Manulife Investment Management (Hong Kong) Limited",
      },
    });
    // 兩行長的值：第一行比標籤高 17 pt。
    const wrapped = readNarrative(
      [
        item(100, 360, "投資經理"),
        item(83, 580, "宏利投資管理（香港）有限公司投資於由富達基金"),
        item(99, 580, "管理之基金"),
        item(114, 580, "Manulife Investment Management invests in the fund"),
        item(126, 580, "managed by FIL"),
      ],
      manager,
    );
    expect(wrapped).toMatchObject({
      status: "ok",
      text: {
        zh: "宏利投資管理（香港）有限公司投資於由富達基金管理之基金",
        en: "Manulife Investment Management invests in the fund managed by FIL",
      },
    });
  });

  it("reads nothing from a marker column whose marker never appears", () => {
    const result = readNarrative(
      [item(100, 40, "Commentary"), item(120, 40, "Markets rose."), item(150, 384, "Fund facts table")],
      {
        heading: /^Commentary$/,
        band: { minLeft: 0, maxLeft: 900 },
        columns: [
          { minLeft: 0, maxLeft: 375 },
          { minLeft: 375, maxLeft: 900, after: /\bSource:/ },
        ],
        languages: "bilingual",
      },
    );
    expect(result).toMatchObject({ status: "ok", text: { en: "Markets rose." } });
  });

  const commentary: TextBlockSelector = {
    heading: /^Commentary 評論$/,
    band: { minLeft: 0, maxLeft: 900 },
    columns: [
      { minLeft: 0, maxLeft: 500 },
      { minLeft: 500, maxLeft: 900 },
    ],
    minDepth: 15,
    stopAt: /^(Reason\(s\) for Material Difference|年度回報與參考投資組合的重大差異理由)/,
    languages: "bilingual",
  };

  it("reads side-by-side English and Chinese columns without mixing lines", () => {
    const result = readNarrative(
      [
        item(100, 40, "Commentary 評論"),
        item(104, 520, "Alphabet Inc C 1.03%"),
        item(124, 40, "U.S. equities rose in Q2 2026,"),
        item(124, 520, "美國股市在2026年第二季上漲，"),
        item(133, 40, "though a mild pullback occurred."),
        item(133, 520, "惟6月出現溫和回調。"),
        item(160, 40, "Reason(s) for Material Difference: N/A"),
        item(160, 520, "年度回報與參考投資組合的重大差異理由： 不適用"),
      ],
      commentary,
    );
    expect(result).toMatchObject({
      status: "ok",
      text: {
        zh: "美國股市在2026年第二季上漲，惟6月出現溫和回調。",
        en: "U.S. equities rose in Q2 2026, though a mild pullback occurred.",
      },
    });
  });
});

describe("commentary shared across funds", () => {
  function page(runs: { top: number; left: number; text: string; size?: number }[]) {
    const fonts = new Map<number, number>();
    const texts = runs.map((run) => {
      const size = run.size ?? 9;
      if (!fonts.has(size)) fonts.set(size, fonts.size);
      return `<text top="${run.top}" left="${run.left}" width="${run.text.length * 6}" height="12" font="${fonts.get(size)}">${run.text}</text>`;
    });
    const specs = [...fonts].map(([size, id]) => `<fontspec id="${id}" size="${size}" family="Arial" color="#000000"/>`);
    return `<page number="1" height="1200" width="900">${specs.join("")}${texts.join("")}</page>`;
  }

  it("marks text that several funds in one fact sheet print word for word", () => {
    const shared = "Global equities rose over the quarter.";
    const pages = parsePdfXml(
      `<pdf2xml>${page([
        { top: 20, left: 40, text: "As at 30/06/2026" },
        { top: 100, left: 40, text: "Alpha Fund", size: 20 },
        { top: 140, left: 40, text: "Commentary" },
        { top: 160, left: 40, text: shared },
        { top: 400, left: 40, text: "Beta Fund", size: 20 },
        { top: 440, left: 40, text: "Commentary" },
        { top: 460, left: 40, text: shared },
        { top: 700, left: 40, text: "Gamma Fund", size: 20 },
        { top: 740, left: 40, text: "Commentary" },
        { top: 760, left: 40, text: "Gamma rose on stock selection." },
      ])}</pdf2xml>`,
    );
    const disclosures = parseFactSheetDisclosures(pages, {
      scheme: "Test Scheme",
      title: { pattern: /Fund$/, fontSize: [20] },
      allocation: { heading: /^Portfolio Allocation$/ },
      holdings: { heading: /^Top 10 Holdings$/ },
      narrative: {
        managerCommentary: {
          heading: /^Commentary$/,
          band: { minLeft: 0, maxLeft: 900 },
          languages: "en",
        },
      },
      asOf: { pattern: /As at\s+(\d{1,2}\/\d{1,2}\/\d{4})/ },
    });
    expect(disclosures.map((d) => d.narrative?.managerCommentary?.sharedAcrossFunds)).toEqual([2, 2, undefined]);
    expect(disclosures[2]?.narrative?.managerCommentary?.en).toBe("Gamma rose on stock selection.");
  });
});

describe("Chinese layout spacing", () => {
  it("drops layout gaps beside brackets in Chinese text but keeps English spacing", () => {
    const result = readNarrative(
      [
        item(100, 40, "Investment Objective"),
        item(120, 40, "信安資金管理 ( 亞洲 ) 有限公司"),
        item(132, 40, "Principal Asset Management Company (Asia) Limited"),
      ],
      selector,
    );
    expect(result).toMatchObject({
      status: "ok",
      text: {
        zh: "信安資金管理(亞洲)有限公司",
        en: "Principal Asset Management Company (Asia) Limited",
      },
    });
  });
});

describe("shared commentary across per-fund fact sheets", () => {
  it("counts identical commentary across files and clears stale counts", () => {
    const disclosure = (en: string, shared?: number) =>
      ({ narrative: { managerCommentary: { heading: "Fund Commentary", en, ...(shared ? { sharedAcrossFunds: shared } : {}) } } }) as never;
    const a = disclosure("Global equities rose.");
    const b = disclosure("Global equities rose.");
    const c = disclosure("Bonds were steady.", 4);
    markSharedNarrative([a, b, c]);
    const shared = (d: { narrative: { managerCommentary: { sharedAcrossFunds?: number } } }) =>
      d.narrative.managerCommentary.sharedAcrossFunds;
    expect([shared(a), shared(b), shared(c)]).toEqual([2, 2, undefined]);
  });
});
