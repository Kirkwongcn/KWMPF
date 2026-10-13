import { parseBboxWords } from "./pdf-xml";
import { labelled, lines, mergeFragments, nearestColumn, type Word } from "./pdf-word-table";

/**
 * 宏利環球精選（強積金）計劃《每月摘要 Monthly Fund Summary》，用 `pdftotext -bbox` 逐詞座標按欄位讀。
 *
 * 每行由基金編號（SHK137、DHK121…）開始，同一行有推出日期、基金價格、累積回報七欄（六個月、年初至今、
 * 一年、三年、五年、十年、推出至今）同五個曆年。英文名喺編號同一行或者下一行（長名會斷行），
 * 名後面嘅註腳（「^」「2」「3」）唔屬基金名。每欄必須剛好一格，唔夠或多過整份報錯。
 */

export type ManulifeMonthlySummaryRow = {
  code: string;
  englishName: string;
  /** 累積回報（%）；原文「-」記 null。 */
  oneYear: number | null;
  threeYears: number | null;
  fiveYears: number | null;
  tenYears: number | null;
  /** 原文三年格，照錄（數字、「-」或「N/A」）。 */
  printedThreeYears: string;
  page: number;
};

export type ManulifeMonthlySummary = { dataAsOf: string; rows: ManulifeMonthlySummaryRow[] };

const COLUMNS = ["6M", "YTD", "1Y", "3Y", "5Y", "10Y", "SI", "Y1", "Y2", "Y3", "Y4", "Y5"] as const;
const CELL = /^(?:-|[+-]?\d+(?:\.\d+)?)$/;
// 「不適用▲」「N/A▲」：未滿嗰期，中英對照分別印喺數字行上下（例如退休收益基金十年）。
const NOT_APPLICABLE = /^(?:N\/A|不適用)▲?$/;
const NA_ABOVE = 6;
const NA_BELOW = 8;
const CODE = /^(?:SHK|DHK|DIS)\d+\/?$/;
// 英文名喺編號同一行，或者下面最多兩行（約 14 pt 內）。
const NAME_BELOW = 14;

function columnCentres(words: Word[]) {
  return labelled(words, "6", /^Months$/).flatMap((months) => {
    const near = <T extends { y: number }>(items: T[], range: number) => items.filter((item) => Math.abs(item.y - months.y) < range);
    const ytd = near(words.filter((word) => word.text === "YTD").map((word) => ({ x: word.xMid, y: word.yMid })), 4);
    const year = (number: string, unit: RegExp) => near(labelled(words, number, unit), 4);
    const oneYear = year("1", /^Year$/);
    const threeYears = year("3", /^Years$/);
    const fiveYears = year("5", /^Years$/);
    const tenYears = year("10", /^Years$/);
    // 「Launch」有兩個：左邊「Launch Date」（推出日期）同右邊「Since Launch」（推出至今）；只要十年欄右邊嗰個。
    const launch = near(
      words.filter((word) => word.text === "Launch" && tenYears.length === 1 && word.xMid > tenYears[0]!.x).map((word) => ({ x: word.xMid, y: word.yMid })),
      12,
    );
    const columns = [[months], ytd, oneYear, threeYears, fiveYears, tenYears, launch];
    if (columns.some((column) => column.length !== 1)) return [];
    const centres = columns.map((column) => column[0]!.x);
    const years = near(
      words.filter((word) => /^20\d\d$/.test(word.text) && word.xMid > centres.at(-1)!).map((word) => ({ x: word.xMid, y: word.yMid })),
      12,
    )
      .map((item) => item.x)
      .sort((a, b) => a - b);
    if (years.length !== 5) return [];
    const all = [...centres, ...years];
    if (all.some((value, index) => index > 0 && value <= all[index - 1]!)) return [];
    return [{ y: months.y, centres: all }];
  });
}

function parseNumber(cell: string) {
  return cell === "-" || cell === "N/A" ? null : Number(cell);
}

const DATE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
// 英文名喺推出日期嗰行上下：上面最多一行（核心累積「DIS148 Manulife MPF …」比數字行低 4 pt），下面最多兩行。
const NAME_ABOVE = 8;

function englishName(words: Word[], date: Word, codeRight: number) {
  const nameLines = lines(
    words.filter((word) => word.xMin > codeRight && word.xMax < date.xMin && word.yMid >= date.yMid - NAME_ABOVE && word.yMid <= date.yMid + NAME_BELOW),
  )
    // 中文名嗰行都有「MPF」呢類拉丁字，成行剔走。
    .filter((line) => !line.some((word) => /[\u4e00-\u9fff]/.test(word.text)));
  const text = nameLines
    .map((line) => line.map((word) => word.text).join(" "))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  // 「Manulife MPF Stable Fund 2」「Manulife MPF Conservative Fund ^」：註腳喺最後一個「Fund」之後。
  return text.match(/^(Manulife MPF .*\bFund)\b(?:\s*[\^\d]+)?$/)?.[1];
}

export function parseManulifeMonthlySummary(bboxXml: string): ManulifeMonthlySummary {
  const pages = parseBboxWords(bboxXml).map(mergeFragments);
  const asAtDates = new Set(
    pages.flatMap((words) =>
      [...lines(words).map((line) => line.map((word) => word.text).join(" ")).join("\n").matchAll(/As at\s+([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})/g)].map((match) => {
        const month = new Date(`${match[1]} 1, ${match[3]}`).getMonth() + 1;
        if (!Number.isInteger(month) || month < 1) throw new Error(`Manulife monthly summary date "${match[0]}" is not a date`);
        return `${match[3]}-${String(month).padStart(2, "0")}-${match[2]!.padStart(2, "0")}`;
      }),
    ),
  );
  if (asAtDates.size !== 1) throw new Error(`Manulife monthly summary must carry exactly one As at date, found ${[...asAtDates].join(", ") || "none"}`);
  const rows: ManulifeMonthlySummaryRow[] = [];
  pages.forEach((words, index) => {
    const page = index + 1;
    const codes = words.filter((word) => CODE.test(word.text) && word.xMin < 60);
    if (codes.length === 0) return;
    const headers = columnCentres(words);
    if (headers.length !== 1) throw new Error(`Manulife monthly summary page ${page}: expected one table header, found ${headers.length}`);
    const { y: headerY, centres } = headers[0]!;
    const narrowest = Math.min(...centres.slice(1).map((value, column) => value - centres[column]!));
    const tableLeft = centres[0]! - narrowest / 2;
    // 每行以推出日期定位（每隻基金都有）；編號喺日期上下 8 pt 內，預設投資策略基金有兩個（「SHK148/」「DIS148」）。
    const launchDates = words.filter((word) => DATE.test(word.text) && word.yMid > headerY && word.xMax < tableLeft).sort((a, b) => a.yMid - b.yMid);
    const rowCodes = (date: Word) =>
      codes.filter((code) => Math.abs(code.yMid - date.yMid) <= NAME_ABOVE).sort((a, b) => a.yMid - b.yMid);
    const orphan = codes.find((code) => !launchDates.some((date) => Math.abs(code.yMid - date.yMid) <= NAME_ABOVE));
    if (orphan) throw new Error(`Manulife monthly summary page ${page}: fund code ${orphan.text} has no launch-date row`);
    for (const date of launchDates) {
      const dateCodes = rowCodes(date);
      if (dateCodes.length === 0) throw new Error(`Manulife monthly summary page ${page}: row at ${date.text} has no fund code`);
      const code = { text: dateCodes.map((item) => item.text.replace(/\/$/, "")).join("/"), xMax: Math.max(...dateCodes.map((item) => item.xMax)), yMid: date.yMid };
      const context = `Manulife monthly summary page ${page} ${code.text}`;
      const name = englishName(words, date, code.xMax);
      if (!name) throw new Error(`${context}: English fund name is missing`);
      const cells = centres.map(() => [] as string[]);
      const band = words.filter((item) => item.xMid > tableLeft && item.yMid >= code.yMid - NA_ABOVE && item.yMid <= code.yMid + NA_BELOW);
      for (const word of band) {
        const onRow = Math.abs(word.yMid - code.yMid) <= 3;
        if (!NOT_APPLICABLE.test(word.text) && !(onRow && CELL.test(word.text))) {
          if (!onRow) continue;
          throw new Error(`${context}: unexpected text "${word.text}" in the return row`);
        }
        const column = nearestColumn(word, centres);
        if (column === undefined) throw new Error(`${context}: cell "${word.text}" cannot be placed in one column`);
        cells[column]!.push(word.text);
      }
      cells.forEach((values, column) => {
        const notApplicable = values.length > 0 && values.length <= 2 && values.every((value) => NOT_APPLICABLE.test(value)) && new Set(values.map((value) => value.startsWith("N/A"))).size === values.length;
        if (values.length !== 1 && !notApplicable) throw new Error(`${context}: column ${COLUMNS[column]} has ${values.length} cells (${values.join(" ")})`);
        if (values.length === 1 && NOT_APPLICABLE.test(values[0]!) === false && !CELL.test(values[0]!)) throw new Error(`${context}: column ${COLUMNS[column]} is not a return`);
      });
      const cell = (column: (typeof COLUMNS)[number]) => {
        const value = cells[COLUMNS.indexOf(column)]![0]!;
        return NOT_APPLICABLE.test(value) ? "N/A" : value;
      };
      rows.push({
        code: code.text,
        englishName: name,
        oneYear: parseNumber(cell("1Y")),
        threeYears: parseNumber(cell("3Y")),
        fiveYears: parseNumber(cell("5Y")),
        tenYears: parseNumber(cell("10Y")),
        printedThreeYears: cell("3Y"),
        page,
      });
    }
  });
  if (rows.length === 0) throw new Error("Manulife monthly summary has no fund rows");
  const codes = rows.map((row) => row.code);
  if (new Set(codes).size !== codes.length) throw new Error("Manulife monthly summary repeats a fund code");
  return { dataAsOf: [...asAtDates][0]!, rows };
}
