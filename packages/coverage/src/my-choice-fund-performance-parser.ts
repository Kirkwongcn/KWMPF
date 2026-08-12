import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

export function parseMyChoiceFundPerformance(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const dateMatch = text.match(/As at\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!dateMatch?.[1] || !dateMatch[2] || !dateMatch[3]) throw new Error("My Choice reporting date is missing");
  const dataAsOf = `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
  const results: FundFactSheetReturn[] = [];
  for (const block of text.split(/\f/)) {
    const fundName = block.match(/MY CHOICE ([A-Z][A-Z ]+FUND)/)?.[1]?.replace(/\s+/g, " ").trim();
    if (!fundName) continue;
    const performanceIndex = block.search(/Annualized\s+Return/i);
    if (performanceIndex < 0) continue;
    const section = block.slice(performanceIndex);
    const row = section.match(/3 Years\s+3 Years\s+([+-]?\d+(?:\.\d+)?|N\/A)/i);
    const value = row?.[1];
    if (!value || /N\/A/i.test(value)) continue;
    const annualizedReturn3Year = Number(value);
    if (!Number.isFinite(annualizedReturn3Year)) continue;
    results.push({ schemeName: "My Choice Mandatory Provident Fund Scheme", constituentFundName: `My Choice ${fundName}`, dataAsOf, sourceUrl, annualizedReturn3Year });
  }
  if (results.length === 0) throw new Error("No My Choice three-year returns found");
  if (new Set(results.map((result) => result.constituentFundName)).size !== results.length) throw new Error("My Choice fund names are ambiguous");
  return results;
}
