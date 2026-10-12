import type { FundFactSheetReturn, FundReturnUnavailable } from "./fund-fact-sheet-parser";
import { parseBboxWords, type BboxWord } from "./pdf-xml";
import { labelled, lines, mergeFragments, nearestColumn, SAME_LINE, type Word } from "./pdf-word-table";

/**
 * 交通銀行愉盈退休強積金計劃便覽的年率化回報，用 `pdftotext -bbox` 逐詞座標按欄位讀。
 *
 * 表頭「Annualised Rate of Return 1 year 3 years 5 years [10 years] Since Launch」：核心累積、65 歲後
 * 冇十年欄，其餘有。`pdftotext -layout` 會把十年格擠落下一行，亦會把左欄文字同「基金 Fund」標籤
 * 拆開，舊做法因而讀錯基金名、漏咗七隻基金。基金本身嗰行由「Fund」標籤開始，到下一個標籤
 * （「Reference Portfolios」或「曆年回報」）為止；每欄必須剛好一格。
 */

const SCHEME = "BCOM Joyful Retirement MPF Scheme";
// 「^不適用NA」：成立未滿嗰期，中英對照加註腳。
const NOT_APPLICABLE = /^\^?(?:不適用)?N\/?A$/;
const CELL = /^(?:\^?(?:不適用)?N\/?A|-|[+-]?\d+(?:\.\d+)?%\**)$/;
const LABEL_MARGIN = 6;

type Column = { name: string; x: number; y: number };

function columnHeaders(words: Word[]) {
  return words.flatMap((annualised) => {
    if (annualised.text !== "Annualised") return [];
    const sameLine = <T extends { y: number }>(items: T[]) => items.filter((item) => Math.abs(item.y - annualised.yMid) < 4);
    const pick = (name: string, items: { x: number; y: number }[]) => sameLine(items).map((item) => ({ name, ...item }));
    const launch = words.filter((word) => word.text === "Launch").map((word) => ({ x: word.xMid, y: word.yMid }));
    const columns: Column[][] = [
      pick("1Y", labelled(words, "1", /^year$/)),
      pick("3Y", labelled(words, "3", /^years$/)),
      pick("5Y", labelled(words, "5", /^years$/)),
      pick("10Y", labelled(words, "10", /^years$/)),
      pick("SI", launch),
    ];
    // 十年欄可以冇；其餘每欄剛好一個。
    if (columns.some((column, index) => column.length > 1 || (index !== 3 && column.length === 0))) return [];
    const ordered = columns.flat();
    if (ordered.some((column, index) => index > 0 && column.x <= ordered[index - 1]!.x)) return [];
    return [{ label: annualised, columns: ordered }];
  });
}

function heading(words: Word[], above: number) {
  // 標題「BCOM Guaranteed (CF) Fund」喺左邊界；頁頂「BCOM Joyful Retirement MPF Scheme」係計劃名，唔係基金。
  const titles = lines(words.filter((word) => word.yMid < above))
    .map((line) => line.filter((word) => word.xMin < 300).map((word) => word.text).join(" "))
    .flatMap((text) => {
      const name = text.match(/^(BCOM (?!Joyful Retirement MPF Scheme\b).*?Fund)\b/)?.[1];
      return name ? [name] : [];
    });
  return titles.at(-1);
}

type PageOutcome = { kind: "return"; row: FundFactSheetReturn } | { kind: "unavailable"; row: FundReturnUnavailable };

function readPage(bboxWords: BboxWord[], pageNumber: number, sourceUrl: string): { dataAsOf: string; outcomes: PageOutcome[] } | undefined {
  const words = mergeFragments(bboxWords);
  const headers = columnHeaders(words);
  if (headers.length === 0) {
    if (words.some((word) => word.text === "Annualised" && words.some((next) => next.text === "Rate" && Math.abs(next.yMid - word.yMid) < 4))) {
      throw new Error(`BCOM page ${pageNumber}: annualised return header (1 year … Since Launch) cannot be read`);
    }
    return undefined;
  }
  const text = lines(words)
    .map((line) => line.map((word) => word.text).join(" "))
    .join("\n");
  const date = text.match(/As of\s*:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!date?.[1] || !date[2] || !date[3]) throw new Error(`BCOM page ${pageNumber}: As of date is missing`);
  const dataAsOf = `${date[3]}-${date[2].padStart(2, "0")}-${date[1].padStart(2, "0")}`;

  const outcomes = headers.map(({ label, columns }): PageOutcome => {
    const name = heading(words, label.yMid);
    const where = `BCOM page ${pageNumber}`;
    if (!name) throw new Error(`${where}: annualised return table has no fund heading`);
    const context = `${name} (${where})`;
    const tableLeft = columns[0]!.x - (columns[1]!.x - columns[0]!.x) / 2;
    const end = words
      .filter((word) => /^(曆年回報|Calender-year|Calendar-year)$/.test(word.text) && word.yMid > label.yMid)
      .sort((a, b) => a.yMid - b.yMid)[0];
    if (!end) throw new Error(`${context}: calendar-year section after the annualised table is missing`);
    const inLabelColumn = (word: Word) => word.xMin >= label.xMin - LABEL_MARGIN && word.xMax <= tableLeft;
    const fundLabel = words
      .filter((word) => word.text === "Fund" && inLabelColumn(word) && word.yMid > label.yMid + SAME_LINE && word.yMid < end.yMid)
      .sort((a, b) => a.yMid - b.yMid)[0];
    if (!fundLabel) throw new Error(`${context}: "Fund" row is missing`);
    const nextLabel = words
      .filter((word) => inLabelColumn(word) && word.yMid > fundLabel.yMid + SAME_LINE && word.yMid < end.yMid && /[A-Za-z一-鿿]/.test(word.text))
      .sort((a, b) => a.yMid - b.yMid)[0];
    const bottom = (nextLabel ?? end).yMin - 1;
    const centres = columns.map((column) => column.x);
    const band = words.filter((word) => word.xMid > tableLeft && word.yMid >= fundLabel.yMin - SAME_LINE && word.yMid < bottom);
    const cells = new Map<string, string[]>();
    for (const word of band) {
      if (!CELL.test(word.text)) throw new Error(`${context}: unexpected text "${word.text}" in the fund row`);
      const column = nearestColumn(word, centres);
      if (column === undefined) throw new Error(`${context}: cell "${word.text}" cannot be placed in one column`);
      const key = columns[column]!.name;
      cells.set(key, [...(cells.get(key) ?? []), word.text]);
    }
    for (const column of columns) {
      const values = cells.get(column.name) ?? [];
      if (values.length !== 1) throw new Error(`${context}: ${column.name} has ${values.length} cells (${values.join(" ")})`);
    }
    const threeYear = cells.get("3Y")![0]!;
    const base = { schemeName: SCHEME, constituentFundName: name, dataAsOf, sourceUrl };
    if (/%\**$/.test(threeYear)) {
      return { kind: "return", row: { ...base, annualizedReturn3Year: Number(threeYear.replace(/%\**$/, "")) } };
    }
    if (threeYear !== "-" && !NOT_APPLICABLE.test(threeYear)) throw new Error(`${context}: 3-year cell "${threeYear}" is not a return`);
    return { kind: "unavailable", row: { ...base, periodYears: 3, reason: threeYear === "-" ? "official-dash" : "official-na", page: pageNumber } };
  });
  return { dataAsOf, outcomes };
}

export function parseBcomFundPerformanceAudit(
  bboxXml: string,
  sourceUrl: string,
): { returns: FundFactSheetReturn[]; unavailable: FundReturnUnavailable[] } {
  const pages = parseBboxWords(bboxXml).flatMap((words, index) => readPage(words, index + 1, sourceUrl) ?? []);
  const dates = new Set(pages.map((page) => page.dataAsOf));
  if (dates.size > 1) throw new Error(`BCOM fact sheet mixes As of dates: ${[...dates].join(", ")}`);
  const outcomes = pages.flatMap((page) => page.outcomes);
  const names = outcomes.map((outcome) => outcome.row.constituentFundName);
  if (new Set(names).size !== names.length) throw new Error("BCOM fund names are ambiguous");
  const returns = outcomes.flatMap((outcome) => (outcome.kind === "return" ? [outcome.row] : []));
  const unavailable = outcomes.flatMap((outcome) => (outcome.kind === "unavailable" ? [outcome.row] : []));
  if (returns.length === 0 && unavailable.length === 0) throw new Error("No BCOM annualised return tables found");
  return { returns, unavailable };
}
