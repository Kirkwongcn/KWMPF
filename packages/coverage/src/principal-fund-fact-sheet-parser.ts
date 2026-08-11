import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

function parseDate(text: string) {
  const match = text.match(/(?:Data as of|數據截至)\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) throw new Error("Principal fund fact sheet date is missing");
  return `${match[3]}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
}

function numberValues(line: string) {
  return [...line.matchAll(/(?:^|\s)(-?\d+(?:\.\d+)?)(?=\s|$)/g)].map((match) => Number(match[1]));
}

export function parsePrincipalFundFactSheet(text: string, sourceUrl: string, schemeName: string): FundFactSheetReturn[] {
  const normalized = text.replace(/\r/g, "");
  const dataAsOf = parseDate(normalized);
  const results: FundFactSheetReturn[] = [];
  for (const page of normalized.split(/\f/)) {
    const name = page.match(/(?:^|\n)\s*(?:Principal\s+)?(.+?Fund)\s*\([^\n)]+\)/m)?.[1]?.trim();
    const performanceIndex = page.indexOf("Annualized Return");
    if (performanceIndex < 0 || !name) continue;
    const values = page.slice(performanceIndex).split("\n").slice(0, 24).map(numberValues).find((candidate) => candidate.length >= 4);
    if (!values || values[2] === undefined) throw new Error("Principal three-year return is missing");
    results.push({ schemeName, constituentFundName: name, dataAsOf, sourceUrl, annualizedReturn3Year: values[2] });
  }
  if (results.length === 0) throw new Error("No Principal fund performance blocks found");
  return results;
}

export function parsePrincipal800FundFactSheet(text: string, sourceUrl: string, schemeName: string): FundFactSheetReturn[] {
  const normalized = text.replace(/\r/g, "");
  const dateMatch = normalized.match(/截至(\d{4})年(\d{1,2})月(\d{1,2})日\s+As at\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!dateMatch) throw new Error("Principal 800 fund fact sheet date is missing");
  const dataAsOf = `${dateMatch[1]}-${dateMatch[2]!.padStart(2, "0")}-${dateMatch[3]!.padStart(2, "0")}`;
  const results: FundFactSheetReturn[] = [];
  for (const page of normalized.split(/\f/)) {
    const performanceIndex = page.indexOf("年均表現 Annualized Return");
    if (performanceIndex < 0) continue;
    const name = page.match(/^\s*(.+基金)\s*$/m)?.[1]?.trim();
    if (!name) throw new Error("Principal 800 fund name is missing");
    const performanceLines = page.slice(performanceIndex).split("\n");
    for (const [index, line] of performanceLines.entries()) {
      const inlineClass = line.match(/Class\s+(D|I)/i);
      const nextClass = performanceLines[index + 1]?.match(/Class\s+(D|I)/i);
      const classMatch = inlineClass ?? (nextClass && numberValues(line).length >= 4 ? nextClass : null);
      if (!classMatch) continue;
      const values = performanceLines.slice(Math.max(0, index - 3), index + 14).map(numberValues).find((candidate) => candidate.length >= 4);
      if (!values || values[2] === undefined) continue;
      results.push({ schemeName, constituentFundName: name, fundClassName: `Class ${classMatch[1]!.toUpperCase()}`, dataAsOf, sourceUrl, annualizedReturn3Year: values[2] });
    }
  }
  if (results.length === 0) throw new Error("No Principal 800 performance blocks found");
  return results;
}
