import type { FundFactSheetReturn, FundReturnUnavailable } from "./fund-fact-sheet-parser";
import { parseBboxWords } from "./pdf-xml";
import { labelled, lines, mergeFragments, nearestColumn, SAME_LINE, type Word } from "./pdf-word-table";

/**
 * 宏利環球精選（強積金）計劃季度便覽的三年年率化回報，用 `pdftotext -bbox` 逐詞座標按欄位讀。
 *
 * 每版兩隻基金。表頭：累積（3 Months、YTD、1 Year、3 Years、5 Years、10 Years、Since Launch）、
 * 年率化（3 Years、5 Years、10 Years、Since Launch），右邊再有五個曆年。舊做法每版只讀第一個表
 * （29 隻得 12 隻），而且靠數第八個數字。基金行由「基金表現」標籤起，到「平均成本法」為止；
 * 每欄必須剛好一格。年率化三年要同累積三年對得上（只作核對，唔輸出換算值）。
 */

const SCHEME = "Manulife Global Select (MPF) Scheme";
// 「不適用▲」「N/A▲」係同一格嘅中英對照（例如退休收益基金未滿十年）。
const CELL = /^(?:-|(?:N\/A|不適用)▲?|[+-]?\d+(?:\.\d+)?)$/;
const normalizeCell = (text: string) => (/^(?:N\/A|不適用)▲?$/.test(text) ? "N/A" : text);
const COLUMNS = ["3M", "YTD", "1Y", "C3Y", "C5Y", "C10Y", "CSI", "A3Y", "A5Y", "A10Y", "ASI"] as const;
const CALENDAR_YEARS = 5;
// 便覽兩位小數；累積同年率化各自四捨五入，實測相差最多 0.01。
const CONSISTENCY_TOLERANCE = 0.05;
const LABEL_LEFT = 30;

type Header = { y: number; centres: number[] };

function headers(words: Word[]): Header[] {
  return labelled(words, "3", /^Months$/).flatMap((months) => {
    const sameLine = <T extends { y: number }>(items: T[]) => items.filter((item) => Math.abs(item.y - months.y) < 4);
    const single = (text: string) => sameLine(words.filter((word) => word.text === text).map((word) => ({ x: word.xMid, y: word.yMid })));
    const ytd = single("YTD");
    const oneYear = sameLine(labelled(words, "1", /^Year$/));
    const threeYears = sameLine(labelled(words, "3", /^Years$/));
    const fiveYears = sameLine(labelled(words, "5", /^Years$/));
    const tenYears = sameLine(labelled(words, "10", /^Years$/));
    const launch = single("Launch");
    if (ytd.length !== 1 || oneYear.length !== 1 || threeYears.length !== 2 || fiveYears.length !== 2 || tenYears.length !== 2 || launch.length !== 2) return [];
    const byX = <T extends { x: number }>(items: T[]) => [...items].sort((a, b) => a.x - b.x);
    const [c3, a3] = byX(threeYears);
    const [c5, a5] = byX(fiveYears);
    const [c10, a10] = byX(tenYears);
    const [cSi, aSi] = byX(launch);
    // 曆年欄（2021…2025）喺表頭上一行，只用嚟分隔，避免曆年數值被當成推出至今。
    const years = words
      .filter((word) => /^20\d\d$/.test(word.text) && word.yMid < months.y && months.y - word.yMid < 12 && word.xMid > aSi!.x)
      .map((word) => word.xMid)
      .sort((a, b) => a - b);
    if (years.length !== CALENDAR_YEARS) return [];
    const centres = [months.x, ytd[0]!.x, oneYear[0]!.x, c3!.x, c5!.x, c10!.x, cSi!.x, a3!.x, a5!.x, a10!.x, aSi!.x, ...years];
    if (centres.some((value, index) => index > 0 && value <= centres[index - 1]!)) return [];
    return [{ y: months.y, centres }];
  });
}

function heading(words: Word[], above: number) {
  const titles = lines(words.filter((word) => word.yMid < above && word.xMin < 300))
    .map((line) => line.map((word) => word.text).join(" "))
    .flatMap((text) => {
      const name = text.match(/^(Manulife MPF .+?Fund)\b/)?.[1];
      return name ? [name] : [];
    });
  return titles.at(-1);
}

type Outcome = { kind: "return"; row: FundFactSheetReturn } | { kind: "unavailable"; row: FundReturnUnavailable };

function readPage(words: Word[], pageNumber: number, dataAsOf: string, sourceUrl: string): Outcome[] {
  const found = headers(words);
  // 表嘅標籤「Fund Performance」喺左邊界（x≈15）；附註內文都有呢兩個字，所以要靠左。
  const titles = words.filter(
    (word) =>
      word.text === "Performance" &&
      words.some((fund) => fund.text === "Fund" && fund.xMin < LABEL_LEFT && Math.abs(fund.yMid - word.yMid) < 2 && word.xMin - fund.xMax < 4 && word.xMin > fund.xMin),
  );
  // 每個「Fund Performance」都要有自己嘅表頭；認到一個漏一個都報錯。
  if (found.length !== titles.length) {
    throw new Error(`Manulife Global Select page ${pageNumber}: ${titles.length} performance table(s) but ${found.length} readable header(s)`);
  }
  return found.map((header): Outcome => {
    const name = heading(words, header.y);
    const where = `Manulife Global Select page ${pageNumber}`;
    if (!name) throw new Error(`${where}: performance table has no fund heading`);
    const context = `${name} (${where})`;
    const top = words.filter((word) => /^基金表現/.test(word.text) && word.yMid > header.y).sort((a, b) => a.yMid - b.yMid)[0];
    if (!top) throw new Error(`${context}: 基金表現 label is missing`);
    const narrowest = Math.min(...header.centres.slice(1).map((value, index) => value - header.centres[index]!));
    // 標籤由左邊界（x≈15）開始；用起點判斷，長標籤（「平均成本法(僅作舉例用途)」）會伸過第一欄左邊。
    const labelColumn = (word: Word) => word.xMin < header.centres[0]! - narrowest;
    const fundLabel = words.filter((word) => word.text === "Performance" && labelColumn(word) && word.yMid > top.yMid).sort((a, b) => a.yMid - b.yMid)[0];
    if (!fundLabel) throw new Error(`${context}: Fund Performance label is missing`);
    // 基金行到下一個標籤為止：指數基金先有指數行（例如「恒生指數 (總回報)」），然後先係平均成本法。
    const bottom = words
      .filter((word) => labelColumn(word) && word.yMid > fundLabel.yMid + SAME_LINE && /[A-Za-z\u4e00-\u9fff]/.test(word.text))
      .sort((a, b) => a.yMid - b.yMid)[0];
    if (!bottom || !words.some((word) => /^(平均成本法|Dollar)/.test(word.text) && word.yMid >= bottom.yMid - SAME_LINE)) {
      throw new Error(`${context}: the row after the fund performance row is missing`);
    }
    const band = words.filter(
      (word) =>
        word.yMid >= Math.max(header.y + SAME_LINE, top.yMin - SAME_LINE) &&
        word.yMid < bottom.yMin - 1 &&
        word.xMid > header.centres[0]! - narrowest / 2 &&
        word.xMid < header.centres.at(-1)! + narrowest / 2,
    );
    const cells = header.centres.map(() => [] as string[]);
    for (const word of band) {
      if (!CELL.test(word.text)) throw new Error(`${context}: unexpected text "${word.text}" in the fund row`);
      const column = nearestColumn(word, header.centres);
      if (column === undefined) throw new Error(`${context}: cell "${word.text}" cannot be placed in one column`);
      cells[column]!.push(normalizeCell(word.text));
    }
    cells.forEach((values, index) => {
      const single = values.length === 1 || (values.length > 1 && values.every((value) => value === "N/A"));
      if (!single) throw new Error(`${context}: column ${COLUMNS[index] ?? "calendar"} has ${values.length} cells (${values.join(" ")})`);
    });
    const value = (name: (typeof COLUMNS)[number]) => cells[COLUMNS.indexOf(name)]![0]!;
    const annualized = value("A3Y");
    const cumulative = value("C3Y");
    const base = { schemeName: SCHEME, constituentFundName: name, dataAsOf, sourceUrl };
    if (!/^[+-]?\d/.test(annualized)) {
      if (/^[+-]?\d/.test(cumulative)) throw new Error(`${context}: 3-year cumulative ${cumulative} has no annualized value`);
      return { kind: "unavailable", row: { ...base, periodYears: 3, reason: annualized === "-" ? "official-dash" : "official-na", page: pageNumber } };
    }
    // 讀錯欄嘅核對：年率化三年 ≈ (1 + 累積三年)^(1/3) − 1。
    const implied = (Math.cbrt(1 + Number(cumulative) / 100) - 1) * 100;
    if (!(Math.abs(implied - Number(annualized)) <= CONSISTENCY_TOLERANCE)) {
      throw new Error(`${context}: 3-year annualized ${annualized} does not match cumulative ${cumulative}`);
    }
    return { kind: "return", row: { ...base, annualizedReturn3Year: Number(annualized) } };
  });
}

function pageText(words: Word[]) {
  return lines(words)
    .map((line) => line.map((word) => word.text).join(" "))
    .join("\n");
}

export function parseManulifeGlobalSelectAudit(
  bboxXml: string,
  sourceUrl: string,
): { returns: FundFactSheetReturn[]; unavailable: FundReturnUnavailable[] } {
  const pages = parseBboxWords(bboxXml).map(mergeFragments);
  const dates = new Set(
    pages.flatMap((words) =>
      [...pageText(words).matchAll(/As at\s+([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})/g)].map((match) => {
        const month = new Date(`${match[1]} 1, ${match[3]}`).getMonth() + 1;
        if (!Number.isInteger(month) || month < 1) throw new Error(`Manulife Global Select date "${match[0]}" is not a date`);
        return `${match[3]}-${String(month).padStart(2, "0")}-${match[2]!.padStart(2, "0")}`;
      }),
    ),
  );
  if (dates.size === 0) throw new Error("Manulife Global Select date is missing");
  if (dates.size > 1) throw new Error(`Manulife Global Select fact sheet mixes dates: ${[...dates].join(", ")}`);
  const dataAsOf = [...dates][0]!;
  const outcomes = pages.flatMap((words, index) => readPage(words, index + 1, dataAsOf, sourceUrl));
  const names = outcomes.map((outcome) => outcome.row.constituentFundName);
  if (new Set(names).size !== names.length) throw new Error("Manulife Global Select fund names are ambiguous");
  const returns = outcomes.flatMap((outcome) => (outcome.kind === "return" ? [outcome.row] : []));
  const unavailable = outcomes.flatMap((outcome) => (outcome.kind === "unavailable" ? [outcome.row] : []));
  if (returns.length === 0 && unavailable.length === 0) throw new Error("Manulife Global Select annualized return blocks not found");
  return { returns, unavailable };
}
