import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

const MONTHS = "January February March April May June July August September October November December".toLowerCase().split(" ");

function dateString(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    throw new Error("China Life report date is invalid");
  }
  return date.toISOString().slice(0, 10);
}

function parseDate(cover: string) {
  // Raw page-one text preserves each cover layer. Layout mode can join the last
  // digits of a hidden year to the visible month across two unrelated lines.
  const dates = new Set<string>();
  for (const match of cover.matchAll(/\bAs at[ \t]+(\d{1,2})[ \t]+([A-Za-z]+)[ \t]+(\d{4})\b/gi)) {
    dates.add(dateString(Number(match[3]), MONTHS.indexOf(match[2]!.toLowerCase()) + 1, Number(match[1])));
  }
  const chinese = new Set<string>();
  for (const match of cover.matchAll(/截至\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g)) {
    chinese.add(dateString(Number(match[1]), Number(match[2]), Number(match[3])));
  }
  const quarters = new Set(Array.from(cover.matchAll(/\b(\d{4})[ \t]+([1-4])(?:st|nd|rd|th)[ \t]+Quarter\b/gi), (m) => m[1] + "-" + m[2]));
  const inReportQuarter = (date: string) => {
    const quarter = date.slice(0, 4) + "-" + Math.ceil(Number(date.slice(5, 7)) / 3);
    return !quarters.size || quarters.has(quarter);
  };
  const candidates = [...dates].filter(inReportQuarter);
  const translated = [...chinese].filter(inReportQuarter);
  const selected = candidates[0];
  if (candidates.length !== 1 || !selected || (chinese.size && (translated.length !== 1 || translated[0] !== selected))) {
    throw new Error("China Life report date is missing or ambiguous");
  }
  return selected;
}

// 一版兩隻基金：標題係「英文名 + 中文名」，同版內評論、更名註腳唔會跟中文名，所以唔會當成標題。
const FUND_HEADING = /^(China Life .*? Fund) [\u4e00-\u9fff]/;
const ANNUALIZED_ROW = /^Annualized\s+年率化\s*\(%\)/i;
// 年初至今、3個月、1年、3年、5年、10年、成立至今：七格逐格對位，唔夠或多過七格整份報錯。
const ROW_CELL = /^(?:-|[+-]?\d+(?:\.\d+)?%?)$/;
const ANNUALIZED_COLUMNS = 7;

function annualizedThreeYear(fundName: string, sectionLines: string[]) {
  const rowIndexes = sectionLines.flatMap((line, index) => (ANNUALIZED_ROW.test(line) ? [index] : []));
  const firstRow = rowIndexes[0];
  if (firstRow === undefined) throw new Error(`China Life annualized return row is missing for ${fundName}`);
  if (rowIndexes.length > 1) {
    const referenceIndex = sectionLines.findIndex((line) => /^Reference Portfolio\s+參考組合/.test(line));
    if (referenceIndex <= firstRow || referenceIndex > rowIndexes[1]!) {
      throw new Error(`China Life annualized return rows are ambiguous for ${fundName}`);
    }
  }
  const cells = sectionLines[firstRow]!.replace(ANNUALIZED_ROW, "").trim().split(/\s+/).filter(Boolean);
  if (cells.length !== ANNUALIZED_COLUMNS || !cells.every((cell) => ROW_CELL.test(cell))) {
    throw new Error(`China Life annualized return row is incomplete for ${fundName}`);
  }
  if (cells[3] === "-") throw new Error(`China Life annualized return row is incomplete for ${fundName}`);
  const value = Number(cells[3]!.replace("%", ""));
  if (!Number.isFinite(value)) throw new Error("China Life annualized return is invalid");
  return value;
}

export function parseChinaLifeFundPerformance(text: string, sourceUrl: string, cover = text.split("\f")[0] ?? ""): FundFactSheetReturn[] {
  const dataAsOf = parseDate(cover);
  const results: FundFactSheetReturn[] = [];
  for (const rawBlock of text.replace(/\r/g, "").split(/\f/).slice(1)) {
    const lines = rawBlock.split("\n").map(normalize).filter(Boolean);
    const headings = lines.flatMap((line, index) => {
      const name = line.match(FUND_HEADING)?.[1];
      return name ? [{ name, index }] : [];
    });
    if (!lines.some((line) => ANNUALIZED_ROW.test(line))) continue;
    if (headings.length === 0) throw new Error("China Life annualized return row has no fund heading");
    if (lines.slice(0, headings[0]!.index).some((line) => ANNUALIZED_ROW.test(line))) {
      throw new Error("China Life annualized return row appears before its fund heading");
    }
    headings.forEach((heading, position) => {
      const section = lines.slice(heading.index + 1, headings[position + 1]?.index ?? lines.length);
      results.push({
        schemeName: "China Life MPF Master Trust Scheme",
        constituentFundName: heading.name,
        dataAsOf,
        sourceUrl,
        annualizedReturn3Year: annualizedThreeYear(heading.name, section),
      });
    });
  }
  if (results.length === 0) throw new Error("China Life annualized three-year return blocks not found");
  if (new Set(results.map((result) => result.constituentFundName)).size !== results.length) throw new Error("China Life fund names are ambiguous");
  return results;
}
