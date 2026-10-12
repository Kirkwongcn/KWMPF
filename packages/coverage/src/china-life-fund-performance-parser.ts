import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseDate(text: string) {
  const matches = [...text.matchAll(/(?:As at\s+)?(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi)];
  const asAt = matches.filter((candidate) => /^As at\s+/i.test(candidate[0]));
  const match = asAt.at(0) ?? matches.find((candidate) => Number(candidate[3]) >= 2025) ?? matches.at(-1);
  if (!match?.[1] || !match[2] || !match[3]) throw new Error("China Life report date is missing");
  const month = new Date(`${match[2]} 1, 2000`).getMonth() + 1;
  return `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
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

export function parseChinaLifeFundPerformance(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const dataAsOf = parseDate(text);
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
