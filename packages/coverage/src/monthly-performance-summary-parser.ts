/**
 * 滙豐／恒生強積金智選計劃《每月基金表現摘要》主表（ADR 0014）。
 *
 * 主表每隻成分基金一格：中文名稱一行（或兩行，例如「（前名稱為…）」）、一行數字
 * （風險級數、成立日期、單位價格、年初至今／6個月／1年／3年／5年／10年／成立至今累積回報，
 * 再加五個曆年回報），英文名稱可以喺數字行左邊、之前或者之後，亦可以摺行。
 *
 * 只認以下情況，否則成份文件報錯，唔出局部資料：
 * - 表頭欄位次序一字不差（YTD 6-Months 1-Year 3-Years 5-Years 10-Years）；
 * - 每格得一行數字，數字剛好 12 個（7 個累積 + 5 個曆年）；
 * - 英文名稱非空。
 * 「-」係官方未提供，唔當 0。
 */

import { normalizeFundName } from "./fact-sheet-allocation-pairing";

export type MonthlySummaryRow = {
  englishName: string;
  chineseName: string;
  riskRating: number;
  launchDate: string;
  unitPrice: string;
  /** 官方原文；`null` 代表官方寫「-」。 */
  cumulative: {
    ytd: number | null;
    sixMonths: number | null;
    oneYear: number | null;
    threeYears: number | null;
    fiveYears: number | null;
    tenYears: number | null;
    sinceLaunch: number | null;
  };
  calendarYears: Record<string, number | null>;
  /** 數字行 12 個值的官方原文（7 個累積 + 5 個曆年），保留小數位。 */
  printed: string[];
};

export type MonthlySummary = {
  dataAsOf: string;
  rows: MonthlySummaryRow[];
};

const HEADER_COLUMNS = /YTD\s+6-Months\s+1-Year\s+3-Years\s+5-Years\s+10-Years/u;
const CALENDAR_YEARS = /^\s*Since\s+((?:\d{4}\s+){4}\d{4})\s*$/u;
const AS_AT = /All information as at (\d{2})\/(\d{2})\/(\d{4})/u;
const VALUE = String.raw`(?:-?\d+(?:\.\d+)?|-)`;
const DATA_LINE = new RegExp(
  String.raw`^(?<left>.*?)\s*\b(?<risk>[1-7])\s+(?<launch>\d{2}\/\d{2}\/\d{4})\s+(?<price>\d+(?:\.\d+)?)\s+(?<values>${VALUE}(?:\s+${VALUE}){11})\s*$`,
  "u",
);
// 中文名稱行：縮排細、唔以英文字母或括號開頭、含中文字（例如「65歲後基金」以數字開頭）。
const CJK_START = /^\s{0,4}[^\sA-Za-z(（].*[\u3400-\u9fff]/u;
const SECTION_HEADER = /^\s{20,}[㐀-鿿].*[A-Za-z]/u;
const FOOTNOTE_START = /^\s*[#^*†§]\s*$|^\s*[#^*†§]\s{2,}\S/u;
const MARKERS = /[#^§*†]+/gu;

function parseValue(token: string): number | null {
  return token === "-" ? null : Number(token);
}

function isoDate(day: string, month: string, year: string) {
  return `${year}-${month}-${day}`;
}

/** 由主表文字（`pdftotext -layout`）讀出全部成分基金。任何一格唔合規格就報錯。 */
export function parseMonthlySummary(text: string): MonthlySummary {
  const lines = text.split(/\r?\n/u);
  const headerIndex = lines.findIndex((line) => HEADER_COLUMNS.test(line));
  if (headerIndex === -1)
    throw new Error("Monthly summary: cumulative return header not found");
  const asAt = lines
    .slice(Math.max(0, headerIndex - 12), headerIndex)
    .map((line) => AS_AT.exec(line))
    .find(Boolean);
  if (!asAt) throw new Error("Monthly summary: as-at date not found above table");
  const years = lines
    .slice(Math.max(0, headerIndex - 4), headerIndex + 1)
    .map((line) => CALENDAR_YEARS.exec(line))
    .find(Boolean);
  if (!years)
    throw new Error("Monthly summary: calendar year header not found");
  const calendarYears = years[1]!.trim().split(/\s+/u);

  type Block = { chinese: string[]; english: string[]; data: string[]; closed: boolean };
  const blocks: Block[] = [];
  let current: Block | undefined;
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim()) continue;
    if (FOOTNOTE_START.test(line)) break;
    if (SECTION_HEADER.test(line)) {
      current = undefined;
      continue;
    }
    const data = DATA_LINE.exec(line);
    if (CJK_START.test(line) && !data) {
      current = { chinese: [line.trim()], english: [], data: [], closed: false };
      blocks.push(current);
      continue;
    }
    if (!current) {
      // 表頭殘餘（例如「Launch」）可以喺第一格之前出現。
      if (blocks.length === 0) continue;
      throw new Error(`Monthly summary: text outside a fund block: ${line.trim()}`);
    }
    const textPart = data ? data.groups!.left! : line;
    if (data) current.data.push(data.groups!.values!);
    if (data) current.data.push(`${data.groups!.risk} ${data.groups!.launch} ${data.groups!.price}`);
    const trimmed = textPart.trim();
    if (!trimmed) continue;
    if (/^[（(]/u.test(trimmed) && /[㐀-鿿]/u.test(trimmed)) {
      current.chinese.push(trimmed);
      continue;
    }
    // 「(the Chinese name …」「(formerly known as …」之後全部係註釋，唔屬名稱。
    if (current.closed || trimmed.startsWith("(")) {
      current.closed = true;
      continue;
    }
    current.english.push(trimmed);
  }
  if (blocks.length === 0) throw new Error("Monthly summary: no fund rows found");

  const rows = blocks.map((block) => {
    if (block.data.length !== 2)
      throw new Error(
        `Monthly summary: expected one data line for ${block.chinese[0]}, found ${block.data.length / 2}`,
      );
    const values = block.data[0]!.split(/\s+/u);
    const [risk, launch, price] = block.data[1]!.split(" ");
    const englishName = block.english
      .join(" ")
      .replace(MARKERS, "")
      .replace(/\s+/gu, " ")
      .trim();
    if (!englishName)
      throw new Error(`Monthly summary: English name missing for ${block.chinese[0]}`);
    const [day, month, year] = launch!.split("/");
    return {
      englishName,
      chineseName: block.chinese[0]!.replace(MARKERS, "").trim(),
      riskRating: Number(risk),
      launchDate: isoDate(day!, month!, year!),
      unitPrice: price!,
      cumulative: {
        ytd: parseValue(values[0]!),
        sixMonths: parseValue(values[1]!),
        oneYear: parseValue(values[2]!),
        threeYears: parseValue(values[3]!),
        fiveYears: parseValue(values[4]!),
        tenYears: parseValue(values[5]!),
        sinceLaunch: parseValue(values[6]!),
      },
      printed: values,
      calendarYears: Object.fromEntries(
        calendarYears.map((calendarYear, index) => [
          calendarYear,
          parseValue(values[7 + index]!),
        ]),
      ),
    } satisfies MonthlySummaryRow;
  });
  return {
    dataAsOf: isoDate(asAt[1]!, asAt[2]!, asAt[3]!),
    rows,
  };
}

/** 同一計劃入面英文名稱精確相同（大小寫、引號、破折號正規化）的紀錄；唔做模糊比對。 */
export function recordsWithSameName<T extends { constituentFundName: string }>(
  records: T[],
  name: string,
): T[] {
  const wanted = normalizeFundName(name);
  return records.filter((record) => normalizeFundName(record.constituentFundName) === wanted);
}

export type SummaryMatch =
  | { status: "matched"; fundClassId: string; row: MonthlySummaryRow }
  | { status: "unmatched" | "ambiguous"; row: MonthlySummaryRow; candidates: string[] };

/**
 * 只喺同一計劃入面按英文名稱精確配對（大小寫、引號、破折號正規化），唔做模糊比對。
 * 同名多過一個類別就報 ambiguous，由呼叫者決定成份文件作廢。
 */
export function matchSummaryRows(
  rows: MonthlySummaryRow[],
  schemeRecords: { fundClassId: string; constituentFundName: string }[],
): SummaryMatch[] {
  return rows.map((row) => {
    const candidates = recordsWithSameName(schemeRecords, row.englishName).map(
      (record) => record.fundClassId,
    );
    if (candidates.length === 1)
      return { status: "matched", fundClassId: candidates[0]!, row };
    return {
      status: candidates.length === 0 ? "unmatched" : "ambiguous",
      row,
      candidates,
    };
  });
}
