import { parseBboxWords } from "./pdf-xml";
import { withMid, type Word } from "./pdf-word-table";

/**
 * 香港投資基金公會（HKIFA）轉載嘅 Lipper《MPF Performance Table》（ADR 0015，第三方來源）。
 *
 * `https://hkifa.org.hk/data/mpf/orso/english/HKMPF_English_MMYYYY.pdf`，每頁打橫印：`pdftotext -bbox`
 * 座標入面每隻基金係一條直嘅 x 帶（約 8 pt 闊），欄位沿 y 排，文字由下而上讀。表頭帶（有「FUND」「NAME」
 * 嗰條）列出每欄嘅 y 範圍：10 年、3 年、1 年、3 個月各有「Rank」同截至日期（MM/DD/YYYY）。
 *
 * 只讀基金名、1 年同 3 年 % Growth（累積）原文。每頁表頭四個截至日期要一致，全份唯一。組別平均同
 * 基準行有時得一位小數，所以呢度唔驗數值格式；用到嘅行（名稱對照表有嘅）由 `readGrowth` 逐格驗：
 * 一格多過一個詞或者唔係兩位小數就報錯。空格（成立未夠一年／三年）係 null，唔係官方「N/A」，唔出數。
 */

export type HkifaLipperRow = {
  name: string;
  /** 1 年格嘅詞（原文）；空格係 `[]`。 */
  oneYear: string[];
  /** 3 年格嘅詞（原文）；空格係 `[]`。 */
  threeYears: string[];
  page: number;
};

export type HkifaLipperTable = { dataAsOf: string; rows: HkifaLipperRow[] };

const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/u;
const GROWTH = /^-?\d+\.\d{2}$/u;
const BAND = 2;

type Columns = { headerX: number; nameFrom: number; ranges: { yMin: number; yMax: number }[]; dataAsOf: string };

function columns(words: Word[], page: number): Columns | undefined {
  const fund = words.filter((word) => word.text === "FUND");
  if (fund.length === 0) return undefined;
  if (fund.length !== 1) throw new Error(`HKIFA MPF table page ${page}: ${fund.length} header bands`);
  const headerX = fund[0]!.xMid;
  const header = words.filter((word) => Math.abs(word.xMid - headerX) < BAND);
  const lipper = header.find((word) => word.text === "LIPPER");
  if (!lipper) throw new Error(`HKIFA MPF table page ${page}: LIPPER GLOBAL CLASSIFICATIONS header is missing`);
  // 「As of 08/31/2026 (monthly updated)」喺 Lipper 評級欄，唔係回報欄；回報欄全部喺分類欄之前（y 細過佢）。
  const cells = header
    .filter((word) => (word.text === "Rank" || DATE.test(word.text)) && word.yMax < lipper.yMin && !/As/u.test(word.text))
    .filter((word) => word.yMax < (header.find((item) => item.text === "Value")?.yMin ?? Infinity))
    .sort((a, b) => a.yMid - b.yMid);
  const kinds = cells.map((word) => (word.text === "Rank" ? "rank" : "date"));
  // 10 年、3 年、1 年、3 個月：每組「Rank」然後日期。
  if (kinds.join(",") !== "rank,date,rank,date,rank,date,rank,date")
    throw new Error(`HKIFA MPF table page ${page}: unexpected return header ${cells.map((word) => word.text).join(" ")}`);
  const dates = new Set(
    cells
      .filter((word) => DATE.test(word.text))
      .map((word) => {
        const [, month, day, year] = DATE.exec(word.text)!;
        return `${year}-${month}-${day}`;
      }),
  );
  if (dates.size !== 1) throw new Error(`HKIFA MPF table page ${page}: header mixes dates ${[...dates].join(", ")}`);
  return { headerX, nameFrom: lipper.yMax + 1, ranges: cells.map((word) => ({ yMin: word.yMin, yMax: word.yMax })), dataAsOf: [...dates][0]! };
}

/** 用到嘅格先驗：兩位小數，或者空格（null，唔係官方 N/A）。 */
export function readGrowth(texts: string[], where: string): { value: number | null; printed: string } {
  if (texts.length === 0) return { value: null, printed: "" };
  if (texts.length !== 1 || !GROWTH.test(texts[0]!)) throw new Error(`HKIFA MPF table ${where}: unexpected cell ${texts.join(" ")}`);
  return { value: Number(texts[0]), printed: texts[0]! };
}

export function parseHkifaLipperMpfTable(bboxXml: string): HkifaLipperTable {
  const pages = parseBboxWords(bboxXml).map((page) => page.map(withMid));
  const dates = new Set<string>();
  const rows: HkifaLipperRow[] = [];
  pages.forEach((words, index) => {
    const page = index + 1;
    const table = columns(words, page);
    if (!table) return;
    dates.add(table.dataAsOf);
    const bands: Word[][] = [];
    for (const word of words.filter((item) => item.xMid > table.headerX + BAND * 2).sort((a, b) => a.xMid - b.xMid)) {
      const band = bands.at(-1);
      if (band && Math.abs(band[0]!.xMid - word.xMid) < BAND) band.push(word);
      else bands.push([word]);
    }
    for (const band of bands) {
      // 文字由下而上：y 大嘅先讀。名稱開頭有時有 BOM。
      const name = band
        .filter((word) => word.yMin > table.nameFrom)
        .sort((a, b) => b.yMid - a.yMid)
        .map((word) => word.text)
        .join(" ")
        .replace(/^﻿/u, "")
        .trim();
      const inRange = (range: { yMin: number; yMax: number }) =>
        band.filter((word) => word.yMid > range.yMin && word.yMid < range.yMax).map((word) => word.text);
      const [, , , threeYears, , oneYear] = table.ranges.map(inRange);
      if (!name) continue;
      rows.push({ name, oneYear: oneYear!, threeYears: threeYears!, page });
    }
  });
  if (dates.size !== 1) throw new Error(`HKIFA MPF table must carry exactly one date, found ${[...dates].join(", ") || "none"}`);
  if (rows.length === 0) throw new Error("HKIFA MPF table has no rows");
  return { dataAsOf: [...dates][0]!, rows };
}
