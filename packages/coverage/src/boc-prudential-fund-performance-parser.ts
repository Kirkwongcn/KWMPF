import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

function date(text: string) {
  const match = text.match(/Reporting Date:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!match?.[1] || !match[2] || !match[3]) throw new Error("BOC-Prudential reporting date is missing");
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

export function parseBocPrudentialFundPerformance(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const dataAsOf = date(text);
  const results: FundFactSheetReturn[] = [];
  for (const block of text.replace(/\r/g, "").split(/\f/).slice(1)) {
    const lines = block.split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
    const performanceIndex = lines.findIndex((line) => /Annualized Return/i.test(line));
    if (performanceIndex < 1) continue;
    const fundName = lines.slice(0, performanceIndex).map((line) => line.match(/BOC-Prudential[^◆]+Fund/i)?.[0]?.trim()).find(Boolean);
    if (!fundName) continue;
    const row = lines.slice(performanceIndex, performanceIndex + 4).find((line) => /(?:N\/A|不適用|[+-]?\d+(?:\.\d+)?)/i.test(line));
    const values = row?.match(/N\/A|不適用|[+-]?\d+(?:\.\d+)?/gi) ?? [];
    const threeYear = values[3];
    if (!threeYear || /N\/A|不適用/i.test(threeYear)) continue;
    const annualizedReturn3Year = Number(threeYear);
    if (!Number.isFinite(annualizedReturn3Year)) continue;
    results.push({ schemeName: "BOC-Prudential Easy-Choice Mandatory Provident Fund Scheme", constituentFundName: fundName, dataAsOf, sourceUrl, annualizedReturn3Year });
  }
  if (results.length === 0) throw new Error("No BOC-Prudential three-year returns found");
  if (new Set(results.map((result) => result.constituentFundName)).size !== results.length) throw new Error("BOC-Prudential fund names are ambiguous");
  return results;
}
