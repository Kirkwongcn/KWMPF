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

export function parseChinaLifeFundPerformance(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const dataAsOf = parseDate(text);
  const results: FundFactSheetReturn[] = [];
  for (const rawBlock of text.replace(/\r/g, "").split(/\f/).slice(1)) {
    const lines = rawBlock.split("\n").map(normalize).filter(Boolean);
    const performanceIndex = lines.findIndex((line) => /^Annualized\s+年率化/i.test(line));
    if (performanceIndex < 1) continue;
    const fundLine = lines.slice(0, performanceIndex).findLast((line) => /^China Life .* Fund(?:\s|$)/.test(line));
    const fundName = fundLine?.match(/^(China Life .*? Fund)(?:\s|$)/)?.[1];
    const annualizedLine = lines[performanceIndex]!.replace(/^Annualized\s+年率化\s*\(%\)?/i, "");
    const values = annualizedLine.match(/-|[+-]?\d+(?:\.\d+)?%?/g);
    if (!fundName) continue;
    if (!values || values.length < 4 || values[3] === "-") throw new Error(`China Life annualized return row is incomplete for ${fundName}`);
    const annualizedReturn3Year = Number(values[3]!.replace("%", ""));
    if (!Number.isFinite(annualizedReturn3Year)) throw new Error("China Life annualized return is invalid");
    results.push({ schemeName: "China Life MPF Master Trust Scheme", constituentFundName: fundName, dataAsOf, sourceUrl, annualizedReturn3Year });
  }
  if (results.length === 0) throw new Error("China Life annualized three-year return blocks not found");
  if (new Set(results.map((result) => result.constituentFundName)).size !== results.length) throw new Error("China Life fund names are ambiguous");
  return results;
}
