import { parseBboxWords } from "./pdf-xml";
import { lines, mergeFragments, withMid, type Word } from "./pdf-word-table";

/**
 * 萬通信託（YF Life Trustees）每月《Monthly Fund Performance of the Scheme》（MASS 強積金計劃，
 * `MonthlyFundPrice(E).pdf`）右邊「HKIFA - MPF Performance Table」，用 `pdftotext -bbox` 逐詞座標讀。
 *
 * 表頭第二行有四個截至日期（3 個月、1 年、3 年 % Growth 同組別基金數目）同三個「Rank」；每行依次係
 * 基金名、NAV、3 個月、排名、1 年、排名、3 年、排名、同組別基金數目。左邊有圖表圖例（同樣係基金名），
 * 所以名稱只取表格名欄（`Constituent Fund Name` 起點）右邊嘅詞。數字次序或者位置唔啱、截至日期唔一致，
 * 整份報錯。三年係累積「% Growth」（ADR 0014），唔換算。
 */

export type YfLifeMonthlyRow = {
  englishName: string;
  /** 累積「% Growth」；官方寫「N/A」或「-」記 null。 */
  oneYear: number | null;
  threeYears: number | null;
  /** 原文三年格照錄。 */
  printedThreeYears: string;
};

export type YfLifeMonthlyPerformance = { dataAsOf: string; rows: YfLifeMonthlyRow[] };

const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/u;
const RETURN = /^(?:-?\d+\.\d{2}|N\/A|-)$/u;
const NAV = /^\d+\.\d{4}$/u;
const RANK = /^(?:\d+|N\/A|-)$/u;
const COUNT = /^\d+$/u;
// 實測：數值中心同表頭日期中心相差 0 pt；容許 6 pt（相鄰欄相距約 27 pt）。
const COLUMN_TOLERANCE = 6;

type Header = { y: number; nameLeft: number; navX: number; dates: number[]; ranks: number[]; dataAsOf: string };

function header(words: Word[]): Header {
  const found = lines(words).flatMap((line) => {
    const constituent = line.find((word) => /^Constituent/u.test(word.text));
    const dates = line.filter((word) => DATE.test(word.text));
    const ranks = line.filter((word) => /^Rank/u.test(word.text));
    const nav = line.find((word) => word.text === "HK$");
    if (!constituent || !nav || dates.length !== 4 || ranks.length !== 3) return [];
    const isoDates = new Set(
      dates.map((word) => {
        const [, month, day, year] = DATE.exec(word.text)!;
        return `${year}-${month}-${day}`;
      }),
    );
    if (isoDates.size !== 1) throw new Error(`YF Life monthly performance: header mixes dates ${[...isoDates].join(", ")}`);
    return [
      {
        y: constituent.yMid,
        nameLeft: constituent.xMin,
        navX: nav.xMid,
        dates: dates.map((word) => word.xMid).sort((a, b) => a - b),
        ranks: ranks.map((word) => word.xMid).sort((a, b) => a - b),
        dataAsOf: [...isoDates][0]!,
      },
    ];
  });
  if (found.length !== 1) throw new Error(`YF Life monthly performance: expected one table header, found ${found.length}`);
  return found[0]!;
}

function parseReturn(cell: string) {
  return cell === "N/A" || cell === "-" ? null : Number(cell);
}

export function parseYfLifeMonthlyPerformance(bboxXml: string): YfLifeMonthlyPerformance {
  const pages = parseBboxWords(bboxXml);
  if (pages.length !== 1) throw new Error(`YF Life monthly performance: expected one page, found ${pages.length}`);
  const raw = pages[0]!.map(withMid);
  const words = mergeFragments(pages[0]!);
  const table = header(words);
  const navLeft = table.navX - (table.dates[0]! - table.navX) / 2;
  // 組別基金數目之後係組別名（括號）、風險同曆年回報；只讀到組別日期欄之前。
  const right = table.dates[3]!;
  const noteY = words.filter((word) => /^Note/u.test(word.text) && word.yMid > table.y).sort((a, b) => a.yMid - b.yMid)[0]?.yMid;
  if (noteY === undefined) throw new Error("YF Life monthly performance: notes below the table are missing");
  const inTable = (word: Word) => word.yMid > table.y + 3 && word.yMid < noteY - 3 && word.xMin >= table.nameLeft - 1;
  const rows: YfLifeMonthlyRow[] = [];
  for (const line of lines(words.filter((word) => inTable(word) && word.xMid < right))) {
    const y = line[0]!.yMid;
    // 組別基金數目後面接組別名「(Equity Hong Kong)」；由第一個「(」起唔屬數值欄。
    const afterName = line.filter((word) => word.xMin >= navLeft);
    const categoryStart = afterName.findIndex((word) => word.text.startsWith("("));
    const cells = categoryStart === -1 ? afterName : afterName.slice(0, categoryStart);
    if (cells.length === 0) continue;
    const name = lines(raw.filter((word) => inTable(word) && word.xMax < navLeft && Math.abs(word.yMid - y) <= 2.5))
      .flat()
      .map((word) => word.text)
      .join(" ")
      .replace(/\s*#\s*$/u, "")
      .trim();
    const context = `YF Life monthly performance row "${name}"`;
    if (!/Fund$/u.test(name)) throw new Error(`${context}: fund name is missing`);
    const texts = cells.map((word) => word.text);
    const [nav, threeMonths, rank3m, oneYear, rank1y, threeYears, rank3y, count] = texts;
    if (
      texts.length !== 8 ||
      !NAV.test(nav!) ||
      ![threeMonths, oneYear, threeYears].every((cell) => RETURN.test(cell!)) ||
      ![rank3m, rank1y, rank3y].every((cell) => RANK.test(cell!)) ||
      !COUNT.test(count!)
    )
      throw new Error(`${context}: unexpected cells ${texts.join(" ")}`);
    // 三個回報同三個排名要喺各自表頭底下，唔係就係欄位錯開。
    const positions = [cells[1]!, cells[2]!, cells[3]!, cells[4]!, cells[5]!, cells[6]!].map((word) => word.xMid);
    const expected = [table.dates[0]!, table.ranks[0]!, table.dates[1]!, table.ranks[1]!, table.dates[2]!, table.ranks[2]!];
    if (positions.some((x, index) => Math.abs(x - expected[index]!) > COLUMN_TOLERANCE))
      throw new Error(`${context}: cells are not under their headers`);
    rows.push({ englishName: name, oneYear: parseReturn(oneYear!), threeYears: parseReturn(threeYears!), printedThreeYears: threeYears! });
  }
  if (rows.length === 0) throw new Error("YF Life monthly performance has no fund rows");
  const names = rows.map((row) => row.englishName.toLowerCase());
  if (new Set(names).size !== names.length) throw new Error("YF Life monthly performance repeats a fund name");
  return { dataAsOf: table.dataAsOf, rows };
}
