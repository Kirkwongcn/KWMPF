import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

const RETURN_VALUE = /N\/A|[+-]?\d+(?:\.\d+)?%|[-–—]/gi;

function parseDate(text: string) {
  const match = text.match(/as at[^\d]{0,24}(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!match) throw new Error("BCT Pro fact sheet date is missing");
  return match[3] + "-" + match[2]!.padStart(2, "0") + "-" + match[1]!.padStart(2, "0");
}

function valuesOnLine(line: string) {
  return [...line.matchAll(RETURN_VALUE)].map((match) => match[0]!);
}

function parseThreeYearReturn(value: string | undefined) {
  const match = value?.match(/^([+-]?\d+(?:\.\d+)?)%$/);
  return match ? Number(match[1]) : undefined;
}

export function parseBctProFundPerformance(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const normalized = text.replace(/\r/g, "");
  const dataAsOf = parseDate(normalized);
  const results: FundFactSheetReturn[] = [];

  for (const page of normalized.split(/\f/)) {
    const performanceIndex = page.indexOf("Constituent Fund Performance");
    if (performanceIndex < 0) continue;
    const annualizedIndex = page.indexOf("Annualised Return", performanceIndex);
    if (annualizedIndex < 0) continue;

    const name = page.match(/^[ \t]*(BCT \(Pro\)[^\r\n]*?\bFund)\b/m)?.[1]?.replace(/\s+/g, " ").trim();
    if (!name) throw new Error("BCT Pro constituent fund name is missing");

    const annualizedSection = page.slice(annualizedIndex).split(/Dollar Cost Averaging Return/i)[0]!;
    const header = annualizedSection.match(/1 Year[^\r\n]*3 Years/i);
    if (!header) throw new Error("BCT Pro three-year return column is missing for " + name);

    const lines = annualizedSection.split("\n").slice(1);
    const returnRow = lines.map(valuesOnLine).find((values) => values.length >= 5);
    const annualizedReturn3Year = parseThreeYearReturn(returnRow?.[1]);
    if (annualizedReturn3Year === undefined) continue;

    results.push({
      schemeName: "BCT (MPF) Pro Choice",
      constituentFundName: name,
      dataAsOf,
      sourceUrl,
      annualizedReturn3Year,
    });
  }

  if (results.length === 0) throw new Error("No BCT Pro three-year returns found");
  if (new Set(results.map((result) => result.constituentFundName)).size !== results.length) {
    throw new Error("BCT Pro constituent fund names are ambiguous");
  }
  return results;
}
