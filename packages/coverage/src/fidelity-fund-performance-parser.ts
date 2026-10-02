import type { FundFactSheetReturn, FundReturnUnavailable } from "./fund-fact-sheet-parser";
import { parseBboxWords, type BboxWord } from "./pdf-xml";

/**
 * 富達便覽（受託人逐隻版及積金局合併版同一排版）的年率化表現，用 `pdftotext -bbox` 的
 * 逐詞座標按欄位讀。左欄投資目標同表格共用同一條基線（例如「invest 20% of its NAV」），
 * `pdftotext -layout` 會把兩欄併成一行，數數字位置就會推移欄位，所以只認表頭
 * （YTD、3 Months … Since Launch）的 x 位置。
 */

type Word = BboxWord & { yMid: number; xMid: number };

const COLUMN_HEADERS = [["YTD"], ["3", "Months"], ["1", "Year"], ["3", "Years"], ["5", "Years"], ["10", "Years"], ["Since", "Launch"]];
const THREE_YEAR_COLUMN = 3;
const SAME_LINE = 3;

function lines(words: Word[]) {
  const result: Word[][] = [];
  for (const word of [...words].sort((a, b) => a.yMid - b.yMid || a.xMin - b.xMin)) {
    const line = result.at(-1);
    if (line && word.yMid - line[0]!.yMid <= SAME_LINE) line.push(word);
    else result.push([word]);
  }
  return result.map((line) => line.sort((a, b) => a.xMin - b.xMin));
}

function parseDate(text: string) {
  const match = text.match(/(?:As of|截至)\s*(?:截至\s*)?(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!match?.[1] || !match[2] || !match[3]) return undefined;
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function isTableCell(text: string) {
  return /^(?:N\/A|-|[+-]?\d+(?:\.\d+)?%)$/i.test(text);
}

function followedBy(line: Word[], first: RegExp, second: RegExp) {
  return line.find((word, index) => first.test(word.text) && second.test(line[index + 1]?.text ?? ""));
}

/** 表頭一行的七個欄位中心；缺任何一個就唔讀呢頁的表。 */
function columnCentres(pageLines: Word[][], before: number) {
  for (const line of pageLines) {
    if (Math.min(...line.map((word) => word.yMid)) >= before) break;
    const texts = line.map((word) => word.text);
    const centres: number[] = [];
    let from = 0;
    for (const header of COLUMN_HEADERS) {
      const index = texts.findIndex((_, start) => start >= from && header.every((part, offset) => texts[start + offset] === part));
      if (index < 0) break;
      centres.push((line[index]!.xMin + line[index + header.length - 1]!.xMax) / 2);
      from = index + header.length;
    }
    if (centres.length === COLUMN_HEADERS.length) return centres;
  }
  return undefined;
}

type PageOutcome =
  | { kind: "return"; row: FundFactSheetReturn }
  | { kind: "unavailable"; row: FundReturnUnavailable }
  | { kind: "error"; dataAsOf: string; message: string };

function readPage(bboxWords: BboxWord[], pageNumber: number, sourceUrl: string): PageOutcome | undefined {
  const words: Word[] = bboxWords.map((word) => ({ ...word, yMid: (word.yMin + word.yMax) / 2, xMid: (word.xMin + word.xMax) / 2 }));
  const pageLines = lines(words);
  const text = pageLines.map((line) => line.map((word) => word.text).join(" ")).join("\n");
  const header = text.match(/Fidelity Retirement Master Trust\s*-\s*([^\n]+?Fund)\b/i);
  const dataAsOf = parseDate(text);
  if (!header?.[1] || !dataAsOf) return undefined;
  const constituentFundName = header[1].replace(/\s+/g, " ").trim();
  const error = (message: string): PageOutcome => ({ kind: "error", dataAsOf, message: `${constituentFundName}: ${message}` });

  const titleLine = pageLines.find((line) => followedBy(line, /^Annuali[sz]ed$/, /^Performance$/));
  const title = titleLine && followedBy(titleLine, /^Annuali[sz]ed$/, /^Performance$/);
  if (!titleLine || !title) return error("annualised performance title is missing");
  const titleWords = new Set([title, titleLine[titleLine.indexOf(title) + 1]]);
  const inTableColumn = (word: Word) => word.xMin >= title.xMin - SAME_LINE;
  const end = pageLines
    .map((line) => line.filter(inTableColumn))
    .map((line) => followedBy(line, /^Dollar$/, /^Cost$/) ?? line.find((word) => word.text === "Calendar"))
    .find((word) => word !== undefined && word.yMid > title.yMid);
  if (!end) return error("annualised table end (Dollar Cost Averaging / Calendar Year) is missing");
  const centres = columnCentres(pageLines, title.yMid);
  if (!centres) return error("annualised table header (YTD … Since Launch) is missing");
  const halfGap = Math.min(...centres.slice(1).map((centre, index) => centre - centres[index]!)) / 2;
  const isTableWord = (word: Word) => word.xMid >= centres[0]! - halfGap && word.xMid <= centres.at(-1)! + halfGap;

  // Rows of table cells from the title down to the next section; the first must be the fund's own
  // row. The MPFA copy prints the fund's values on the title's visual line, so the title line counts.
  const rows = lines(words.filter((word) => isTableCell(word.text) && isTableWord(word) && word.yMid > title.yMid - SAME_LINE && word.yMid < end.yMid - SAME_LINE));
  const fundRow = rows[0];
  if (!fundRow) return error("annualised fund row is missing");
  const rowTop = Math.min(...fundRow.map((word) => word.yMin));
  const rowBottom = Math.max(...fundRow.map((word) => word.yMax));
  const label = words
    .filter((word) => !titleWords.has(word) && word.yMid >= rowTop && word.yMid <= rowBottom && inTableColumn(word) && word.xMid < centres[0]! - halfGap)
    .sort((a, b) => a.xMin - b.xMin)
    .map((word) => word.text)
    .join(" ");
  // "Fund 基金" labels the fund when a reference portfolio or index row follows; a single-row
  // table carries the Chinese title "年率化表現" on its line instead.
  if (label !== (rows.length > 1 ? "Fund 基金" : "年率化表現")) return error(`first annualised row is labelled "${label}", not the fund`);
  const cells = new Map<number, string>();
  for (const word of fundRow) {
    const column = centres.findIndex((centre) => Math.abs(centre - word.xMid) <= halfGap);
    if (column < 0 || cells.has(column) || !isTableCell(word.text)) return error(`unexpected annualised cell "${word.text}"`);
    cells.set(column, word.text);
  }
  if (cells.size !== COLUMN_HEADERS.length) return error(`annualised fund row has ${cells.size} of ${COLUMN_HEADERS.length} cells`);
  const threeYear = cells.get(THREE_YEAR_COLUMN)!;
  const base = { schemeName: "Fidelity Retirement Master Trust", constituentFundName, dataAsOf, sourceUrl };
  if (threeYear.endsWith("%")) return { kind: "return", row: { ...base, annualizedReturn3Year: Number(threeYear.slice(0, -1)) } };
  return { kind: "unavailable", row: { ...base, periodYears: 3, reason: threeYear === "-" ? "official-dash" : "official-na", page: pageNumber } };
}

export function parseFidelityFundPerformanceAudit(
  bboxXml: string,
  sourceUrl: string,
): { returns: FundFactSheetReturn[]; unavailable: FundReturnUnavailable[] } {
  const outcomes = parseBboxWords(bboxXml).flatMap((words, index) => readPage(words, index + 1, sourceUrl) ?? []);
  const dateOf = (outcome: PageOutcome) => (outcome.kind === "error" ? outcome.dataAsOf : outcome.row.dataAsOf);
  // Combined MPFA copies append older-period pages; only the latest-dated pages are read.
  const latestDate = outcomes.reduce((latest, outcome) => (dateOf(outcome) > latest ? dateOf(outcome) : latest), "");
  const latest = outcomes.filter((outcome) => dateOf(outcome) === latestDate);
  const errors = latest.flatMap((outcome) => (outcome.kind === "error" ? [outcome.message] : []));
  if (errors.length > 0) throw new Error(`Fidelity annualized return table could not be read: ${errors.join("; ")}`);
  const returns = latest.flatMap((outcome) => (outcome.kind === "return" ? [outcome.row] : []));
  const unavailable = latest.flatMap((outcome) => (outcome.kind === "unavailable" ? [outcome.row] : []));
  if (returns.length === 0 && unavailable.length === 0) throw new Error("No Fidelity annualized return blocks found");
  const names = [...returns, ...unavailable].map((row) => row.constituentFundName);
  if (new Set(names).size !== names.length) throw new Error("Fidelity fund names are ambiguous");
  return { returns, unavailable };
}
