import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

export function parseShkpFundPerformance(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const dateMatch = text.match(/As at\s+(\d{1,2})\s+(March|June|September|December)\s+(\d{4})/i);
  if (!dateMatch?.[1] || !dateMatch[2] || !dateMatch[3]) throw new Error("SHKP statement date is missing");
  const month = { march: "03", june: "06", september: "09", december: "12" }[dateMatch[2].toLowerCase() as "march" | "june" | "september" | "december"];
  const dataAsOf = `${dateMatch[3]}-${month}-${dateMatch[1].padStart(2, "0")}`;
  const results: FundFactSheetReturn[] = [];
  for (const block of text.split(/\f/)) {
    const fundName = block.match(/(?:^|\n)\s*([A-Z][A-Za-z0-9 &'()-]+Fund)Note?/i)?.[1]?.replace(/Note$/i, "").trim();
    if (!fundName) continue;
    const match = block.match(/Last 3 years\s+\(p\.a\.%\)[^\d]*([+-]?\d+(?:\.\d+)?)\s*%/i);
    if (!match?.[1]) continue;
    const annualizedReturn3Year = Number(match[1]);
    if (!Number.isFinite(annualizedReturn3Year)) continue;
    results.push({ schemeName: "SHKP MPF Employer Sponsored Scheme", constituentFundName: fundName, dataAsOf, sourceUrl, annualizedReturn3Year });
  }
  if (results.length === 0) throw new Error("No SHKP three-year returns found");
  if (new Set(results.map((result) => result.constituentFundName)).size !== results.length) throw new Error("SHKP fund names are ambiguous");
  return results;
}
