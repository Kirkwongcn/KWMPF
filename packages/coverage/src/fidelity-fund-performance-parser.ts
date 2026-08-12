import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

function parseDate(text: string) {
  const match = text.match(/(?:As of|截至)\s*(?:截至\s*)?(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!match?.[1] || !match[2] || !match[3]) throw new Error("Fidelity fund fact sheet date is missing");
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

export function parseFidelityFundPerformance(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const dataAsOf = parseDate(text);
  const results: FundFactSheetReturn[] = [];
  for (const page of text.replace(/\r/g, "").split(/\\f|\f/)) {
    const header = page.match(/Fidelity Retirement Master Trust\s*-\s*([^\n]+?Fund)\b/i);
    if (!header?.[1]) continue;
    const annualizedIndex = page.search(/Annualised Performance/i);
    if (annualizedIndex < 0) continue;
    const section = page.slice(annualizedIndex).split(/(?:Dollar Cost Averaging|Calendar Year Performance)/i)[0]!;
    const values = section.match(/(?:N\/A|[+-]?\d+(?:\.\d+)?)\s*%?/gi) ?? [];
    if (values.length < 4 || /^N\/A$/i.test(values[3]!)) continue;
    results.push({ schemeName: "Fidelity Retirement Master Trust", constituentFundName: header[1].replace(/\s+/g, " ").trim(), dataAsOf, sourceUrl, annualizedReturn3Year: Number(values[3]!.replace("%", "")) });
  }
  if (results.length === 0) throw new Error("No Fidelity annualized return blocks found");
  if (new Set(results.map((result) => result.constituentFundName)).size !== results.length) throw new Error("Fidelity fund names are ambiguous");
  return results;
}
