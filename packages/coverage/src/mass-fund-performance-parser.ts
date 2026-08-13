import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

export function parseMassFundPerformance(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const reportDate = text.match(/Fund Data as at[\s\S]{0,160}?([A-Za-z]+ \d{1,2}, \d{4})/i)?.[1];
  const defaultDataAsOf = reportDate ? parseMassDate(reportDate) : "2024-12-31";
  const results: FundFactSheetReturn[] = [];
  for (const block of text.split(/\f/)) {
    const name = block.match(/(?:YF Life Trustees Ltd\.\s*\n\s*)?([A-Za-z0-9][A-Za-z0-9 &'()/-]+?Fund)\s+Published in/im)?.[1]?.trim() ?? block
      .split("\n")
      .map((line) => line.match(/^\s*(.+?Fund)\s+Risk/i)?.[1])
      .find(Boolean)
      ?.replace(/\s+/g, " ")
      .trim();
    if (!name) continue;
    const dataAsOf = defaultDataAsOf;
    const annualizedIndex = block.search(/Annualized(?:\s+Return)?/i);
    if (annualizedIndex < 0) continue;
    const row = block.slice(annualizedIndex).match(/Annualized(?:\s+Return)?[\s\S]{0,500}?((?:[+-]?\d+(?:\.\d+)?%|N\/A)(?:\s+(?:[+-]?\d+(?:\.\d+)?%|N\/A)){3,})/i)
      ?? block.slice(annualizedIndex).match(/Fund\s+基金\s+((?:[+-]?\d+(?:\.\d+)?%|N\/A)(?:\s+(?:[+-]?\d+(?:\.\d+)?%|N\/A))+)/i);
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

function parseMassDate(value: string): string {
  const match = value.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/);
  const monthName = match?.[1];
  const day = match?.[2];
  const year = match?.[3];
  if (!monthName || !day || !year) throw new Error(`Unsupported MASS report date: ${value}`);
  const month = new Date(`${monthName} 1, ${year}`).getMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;
}
