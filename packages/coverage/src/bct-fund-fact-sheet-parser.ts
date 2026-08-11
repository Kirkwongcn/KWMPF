import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

function parseDate(text: string) {
  const match = text.match(/截至\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) throw new Error("BCT fund fact sheet date is missing");
  return `${match[3]}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
}

export function parseBctFundFactSheet(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const normalized = text.replace(/\r/g, "");
  const dataAsOf = parseDate(normalized);
  const results: FundFactSheetReturn[] = [];
  for (const page of normalized.split(/\f/)) {
    const performanceIndex = page.indexOf("Constituent Fund Performance");
    if (performanceIndex < 0 || !page.includes("Annualised Return")) continue;
    const name = page.match(/BCT \(Industry\)[^\n]*?Fund/)?.[0]?.trim();
    const annualizedIndex = page.indexOf("Annualised Return", performanceIndex);
    const annualized = page
      .slice(annualizedIndex)
      .split("\n")
      .slice(0, 32)
      .map((line) => line.match(/([+-]?\d+(?:\.\d+)?%)/g))
      .find((values) => values && values.length >= 5);
    if (!name) throw new Error("BCT fund name is missing");
    if (!annualized) throw new Error("BCT annualized return row is incomplete");
    results.push({ schemeName: "BCT (MPF) Industry Choice", constituentFundName: name, dataAsOf, sourceUrl, annualizedReturn3Year: Number(annualized[1]!.replace("%", "")) });
  }
  if (results.length === 0) throw new Error("No BCT fund performance blocks found");
  return results;
}
