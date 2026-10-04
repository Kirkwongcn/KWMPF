import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePdfXml, type PdfTextItem } from "../src/pdf-xml";
import {
  findSections,
  parseFactSheetDisclosures,
  sectionItems,
} from "../src/fact-sheet-allocation";
import { factSheetContract } from "../src/fact-sheet-allocation-contracts";
import { readNarrative, type TextBlockSelector } from "../src/fact-sheet-narrative";

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
    const result = readNarrative(items, hsbc.narrative!.investmentObjective!);
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
    const result = readNarrative(items, hsbc.narrative!.managerCommentary!);
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
    const result = readNarrative(items, hsbc.narrative!.managerCommentary!);
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

  it("ends the block at a large vertical gap", () => {
    const result = readNarrative(
      [item(100, 40, "Investment Objective"), item(120, 40, "Seeks growth."), item(200, 40, "Unrelated notice.")],
      { ...selector, maxGap: 24 },
    );
    expect(result).toMatchObject({ status: "ok", text: { en: "Seeks growth." } });
  });
});

describe("narrative layouts", () => {
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
