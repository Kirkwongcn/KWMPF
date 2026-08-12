import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

export function parseMassFundPerformance(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const dataAsOf = "2024-12-31";
  const results: FundFactSheetReturn[] = [];
  for (const block of text.split(/\f/)) {
    const name = block
      .split("\n")
      .map((line) => line.match(/^\s*(.+?Fund)\s+Risk/i)?.[1])
      .find(Boolean)
      ?.replace(/\s+/g, " ")
      .trim();
    if (!name) continue;
    const annualizedIndex = block.search(/Annualized Return/i);
    if (annualizedIndex < 0) continue;
    const row = block.slice(annualizedIndex).match(/Fund\s+基金\s+((?:[+-]?\d+(?:\.\d+)?%|N\/A)(?:\s+(?:[+-]?\d+(?:\.\d+)?%|N\/A))+)/i);
    const values = row?.[1]?.match(/N\/A|[+-]?\d+(?:\.\d+)?%/gi) ?? [];
    const threeYear = values[1];
    if (!threeYear || /N\/A/i.test(threeYear)) continue;
    const annualizedReturn3Year = Number.parseFloat(threeYear);
    if (!Number.isFinite(annualizedReturn3Year)) continue;
    const normalizedName = name.replace("Accumulaton", "Accumulation");
    results.push({ schemeName: "MASS Mandatory Provident Fund Scheme", constituentFundName: normalizedName, dataAsOf, sourceUrl, annualizedReturn3Year });
  }
  if (results.length === 0) throw new Error("No MASS three-year returns found");
  if (new Set(results.map((result) => result.constituentFundName)).size !== results.length) throw new Error("MASS fund names are ambiguous");
  return results;
}
