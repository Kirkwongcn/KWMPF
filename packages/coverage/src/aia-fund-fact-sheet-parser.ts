import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

function parseDate(text: string) {
  const matches = [...text.matchAll(/截至(\d{4})年(\d{1,2})月(\d{1,2})日/g)];
  const match = matches.at(-1);
  if (!match) throw new Error("AIA fund fact sheet date is missing");
  return `${match[1]}-${match[2]!.padStart(2, "0")}-${match[3]!.padStart(2, "0")}`;
}

function numberValues(text: string) {
  return [...text.matchAll(/[+-]?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

function fundName(lines: string[]) {
  for (const rawLine of lines.slice(0, 14)) {
    const line = rawLine.replace(/[\u0000-\u001f]/g, "").trim();
    const match = line.match(/^(.+?(?:Fund|Portfolio))(?:\s+風險級別|\s+Risk Class|\s+\d+\s+\d+\s+\d+|$)/);
    if (match && !/Fund Fact Sheet|Fund Performance/.test(match[1]!)) return match[1]!.trim();
  }
  return undefined;
}

export function parseAiaFundFactSheet(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const normalized = text.replace(/\r/g, "");
  const dataAsOf = parseDate(normalized);
  const results: FundFactSheetReturn[] = [];
  for (const rawPage of normalized.split(/\f/)) {
    if (!rawPage.includes("基金資料 | FUND FACTS") || !rawPage.includes("年度化回報 Annualised Return")) continue;
    const lines = rawPage.split("\n");
    const name = fundName(lines);
    const annualizedIndex = lines.findIndex((line) => line.includes("年度化回報 Annualised Return"));
    if (!name || annualizedIndex < 0) continue;
    const performanceLines = lines.slice(annualizedIndex + 1, annualizedIndex + 8);
    const fundLine = performanceLines.findIndex((line) => line.includes("基金 Fund"));
    if (fundLine < 0) throw new Error(`AIA annualized return row is missing for ${name}`);
    const row = performanceLines.slice(fundLine, fundLine + 3).join(" ");
    const values = numberValues(row.slice(row.indexOf("基金 Fund") + "基金 Fund".length));
    if (values.length < 3) continue;
    results.push({ schemeName: "AIA MPF - Prime Value Choice", constituentFundName: name, dataAsOf, sourceUrl, annualizedReturn3Year: values[1]! });
  }
  if (results.length === 0) throw new Error("No AIA fund performance blocks found");
  return results;
}
