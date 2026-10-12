import type { FundFactSheetReturn, FundReturnUnavailable } from "./fund-fact-sheet-parser";
import { parseBboxWords, type BboxWord } from "./pdf-xml";
import { labelled, lines, mergeFragments, nearestColumn, SAME_LINE, type Word } from "./pdf-word-table";

/**
 * 中銀保誠便覽的年率化回報，用 `pdftotext -bbox` 逐詞座標按欄位讀。
 *
 * `pdftotext -layout` 會把左欄說明（例如「被視為高 2。」「證券 15。」）同表格併成一行，數字位置
 * 一移就讀錯欄；而且年率化的數值會浮喺中文標籤「年率化回報」同英文標籤「Annualized Return」
 * 之間或者之下。所以只認表頭（3 Months … Inception）的 x 位置，並以同一條標籤欄對齊的
 * 「累積回報」「年率化回報」及下一個標籤界定每一行的上下範圍。
 */

const LABEL_ALIGN = 3;
const HEADING_BAND = 40;
const COLUMNS = ["3M", "YTD", "1Y", "3Y", "5Y", "10Y", "SI"] as const;
const ONE_YEAR = COLUMNS.indexOf("1Y");
const THREE_YEAR = COLUMNS.indexOf("3Y");
const CELL = /^(?:不適用|N\/A|-|[+-]?\d+(?:\.\d+)?)$/;
const SCHEME = "BOC-Prudential Easy-Choice Mandatory Provident Fund Scheme";

/**
 * 表頭七欄：「3 Months」「Date」（年度至今）「1 Year」「3 Years」「5 Years」「10 Years」「Inception」（成立至今）。
 * 「Date」「Inception」比主行低幾 pt，所以喺「1 Year」上下 12 pt 內搵；每欄必須剛好一個。
 */
function columnHeader(words: Word[]) {
  for (const oneYear of labelled(words, "1", /^Year$/)) {
    const near = <T extends { y: number }>(items: T[]) => items.filter((item) => Math.abs(item.y - oneYear.y) < 12);
    const threeYears = near(labelled(words, "3", /^Years$/));
    const fiveYears = near(labelled(words, "5", /^Years$/));
    const tenYears = near(labelled(words, "10", /^Years$/));
    const months = near(labelled(words, "3", /^Months$/));
    const date = near(words.filter((word) => word.text === "Date").map((word) => ({ x: word.xMid, y: word.yMid })));
    // 香港平穩退休基金寫「Inception^」（註腳）。
    const inception = near(words.filter((word) => /^Inception\^?$/.test(word.text)).map((word) => ({ x: word.xMid, y: word.yMid })));
    const columns = [months, date, [oneYear], threeYears, fiveYears, tenYears, inception];
    if (columns.some((column) => column.length !== 1)) continue;
    const centres = columns.map((column) => column[0]!.x);
    if (centres.some((value, index) => index > 0 && value <= centres[index - 1]!)) continue;
    return { y: Math.max(...columns.map((column) => column[0]!.y)), centres };
  }
  return undefined;
}

function normalizeCell(text: string) {
  return text === "不適用" ? "N/A" : text;
}

/** 一行的七格：每格只可以有一個數值；「不適用」同「N/A」係同一格的中英對照，要一致。 */
function readRow(cells: Word[], centres: number[], label: string) {
  const columns = centres.map(() => [] as string[]);
  for (const word of cells) {
    const column = nearestColumn(word, centres);
    if (column === undefined) throw new Error(`${label}: cell "${word.text}" cannot be placed in one table column`);
    columns[column]!.push(normalizeCell(word.text));
  }
  return columns.map((values, index) => {
    if (values.length === 0) throw new Error(`${label}: ${COLUMNS[index]} cell is missing`);
    const numeric = values.filter((value) => value !== "N/A");
    if (numeric.length > 1 || (numeric.length === 1 && values.length > 1)) {
      throw new Error(`${label}: ${COLUMNS[index]} cell is ambiguous (${values.join(" ")})`);
    }
    return values[0]!;
  });
}

type PageOutcome = { kind: "return"; row: FundFactSheetReturn } | { kind: "unavailable"; row: FundReturnUnavailable };

function readPage(bboxWords: BboxWord[], pageNumber: number, dataAsOf: string, sourceUrl: string): PageOutcome | undefined {
  const words = mergeFragments(bboxWords);
  const header = columnHeader(words);
  if (!header) {
    // 有「基金表現按港元計算」（基金本身嘅回報表標題）但認唔到表頭，即係版面變咗：報錯，唔可以
    // 靜靜哋漏咗呢隻基金。預設投資策略第二版嘅參考投資組合表冇呢個標題，唔當基金表。
    const hasTable = words.some((word) => word.text.startsWith("基金表現按港元計算"));
    if (hasTable) throw new Error(`BOC-Prudential page ${pageNumber}: performance table header (3 Months … Inception) is missing`);
    return undefined;
  }
  // 頁頂標題「中銀保誠…基金◆ BOC-Prudential … Fund ◆」；◆ 同上標比字高幾 pt，所以以「BOC-Prudential」
  // 嗰個詞嘅高度為準，只取上下 2 pt 內的詞按 x 排。
  const anchors = words.filter((word) => word.yMid < HEADING_BAND && /BOC-Prudential$/.test(word.text));
  const headingText =
    anchors.length === 1
      ? words
          .filter((word) => Math.abs(word.yMid - anchors[0]!.yMid) <= 2)
          .sort((x, y) => x.xMin - y.xMin)
          .map((word) => word.text)
          .join(" ")
      : "";
  const fundName = headingText.match(/BOC-Prudential\s+([^◆^]+?Fund)\b/)?.[1]?.replace(/\s+/g, " ").trim();
  const where = `page ${pageNumber}`;
  if (!fundName) throw new Error(`BOC-Prudential ${where}: performance table has no fund heading`);
  const label = `BOC-Prudential ${fundName} (${where})`;

  const cumulativeLabel = words.filter((word) => word.text === "累積回報" && word.yMid > header.y).sort((a, b) => a.yMid - b.yMid)[0];
  if (!cumulativeLabel) throw new Error(`${label}: cumulative return label is missing`);
  const aligned = (word: Word) => Math.abs(word.xMin - cumulativeLabel.xMin) <= LABEL_ALIGN;
  const annualizedLabel = words.filter((word) => word.text === "年率化回報" && aligned(word) && word.yMid > cumulativeLabel.yMid).sort((a, b) => a.yMid - b.yMid)[0];
  if (!annualizedLabel) throw new Error(`${label}: annualized return label is missing`);
  const end = words
    .filter((word) => aligned(word) && word.yMid > annualizedLabel.yMid + SAME_LINE && !/^Annuali[sz]ed$/.test(word.text))
    .sort((a, b) => a.yMid - b.yMid)[0];
  if (!end) throw new Error(`${label}: the row after the annualized return is missing`);

  const halfGap = Math.min(...header.centres.slice(1).map((value, index) => value - header.centres[index]!)) / 2;
  const tableWords = words.filter((word) => word.xMid >= header.centres[0]! - halfGap && word.xMid <= header.centres.at(-1)! + halfGap);
  const between = (top: number, bottom: number) => {
    const band = tableWords.filter((word) => word.yMid >= top && word.yMid < bottom);
    // 行內唔係數值嘅詞（例如未併返的「.02」）即係讀唔清楚，唔可以靜靜哋丟咗。
    const stray = band.find((word) => !CELL.test(word.text));
    if (stray) throw new Error(`${label}: unexpected text "${stray.text}" inside the return row`);
    return band;
  };
  const cumulative = readRow(between(cumulativeLabel.yMin - SAME_LINE, annualizedLabel.yMin - 1), header.centres, `${label} cumulative`);
  const annualized = readRow(between(annualizedLabel.yMin - 1, end.yMin - 1), header.centres, `${label} annualized`);
  // 一年期累積同年率化必然相同；唔同即係讀錯欄或讀錯行。
  if (cumulative[ONE_YEAR] !== annualized[ONE_YEAR]) {
    throw new Error(`${label}: 1-year cumulative ${cumulative[ONE_YEAR]} does not equal 1-year annualized ${annualized[ONE_YEAR]}`);
  }
  const threeYear = annualized[THREE_YEAR]!;
  const base = { schemeName: SCHEME, constituentFundName: `BOC-Prudential ${fundName}`, dataAsOf, sourceUrl };
  if (/^[+-]?\d/.test(threeYear)) return { kind: "return", row: { ...base, annualizedReturn3Year: Number(threeYear) } };
  return { kind: "unavailable", row: { ...base, periodYears: 3, reason: threeYear === "-" ? "official-dash" : "official-na", page: pageNumber } };
}

export function parseBocPrudentialFundPerformanceAudit(
  bboxXml: string,
  sourceUrl: string,
): { returns: FundFactSheetReturn[]; unavailable: FundReturnUnavailable[] } {
  const pages = parseBboxWords(bboxXml);
  const fullText = pages
    .map((page) =>
      lines(mergeFragments(page))
        .map((line) => line.map((word) => word.text).join(" "))
        .join("\n"),
    )
    .join("\n");
  const date = fullText.match(/Reporting\s+Date:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!date?.[1] || !date[2] || !date[3]) throw new Error("BOC-Prudential reporting date is missing");
  const dataAsOf = `${date[3]}-${date[2].padStart(2, "0")}-${date[1].padStart(2, "0")}`;
  const outcomes = pages.flatMap((words, index) => readPage(words, index + 1, dataAsOf, sourceUrl) ?? []);
  const byFund = new Map<string, PageOutcome>();
  for (const outcome of outcomes) {
    const name = outcome.row.constituentFundName;
    const previous = byFund.get(name);
    if (previous) throw new Error(`BOC-Prudential fund ${name} has more than one performance table`);
    byFund.set(name, outcome);
  }
  const returns = outcomes.flatMap((outcome) => (outcome.kind === "return" ? [outcome.row] : []));
  const unavailable = outcomes.flatMap((outcome) => (outcome.kind === "unavailable" ? [outcome.row] : []));
  if (returns.length === 0 && unavailable.length === 0) throw new Error("No BOC-Prudential three-year returns found");
  return { returns, unavailable };
}
