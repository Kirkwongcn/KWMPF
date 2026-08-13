import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

export function parseManulifeGlobalSelect(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const date = text.match(/As at\s+([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})/i);
  if (!date) throw new Error("Manulife Global Select date is missing");
  const month = new Date(`${date[1]} 1, ${date[3]}`).getMonth() + 1;
  const dataAsOf = `${date[3]}-${String(month).padStart(2, "0")}-${date[2]!.padStart(2, "0")}`;
  const results: FundFactSheetReturn[] = [];
  for (const page of text.split(/\f/)) {
    const performance = page.match(/Manulife MPF ([A-Za-z][A-Za-z ]+Fund)[\s\S]*?Fund Performance 2\s+((?:[+-]?\d+(?:\.\d+)?\s+){7})([+-]?\d+(?:\.\d+)?)/i);
    if (!performance) continue;
    results.push({ schemeName: "Manulife Global Select (MPF) Scheme", constituentFundName: `Manulife MPF ${performance[1]!.trim()}`, dataAsOf, sourceUrl, annualizedReturn3Year: Number(performance[3]) });
  }
  if (results.length === 0) throw new Error("Manulife Global Select annualized return blocks not found");
  return results;
}
