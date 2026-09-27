import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

function titleCaseFundName(value: string) {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/\bMpf\b/g, "MPF")
    .replace(/\bHkd\b/g, "HKD")
    .replace(/\bRmb\b/g, "RMB")
    .replace(/\bUs\b/g, "US")
    .replace(/\bUk\b/g, "UK");
}

export function parseMyChoiceFundPerformance(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const dateMatch = text.match(/As at\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!dateMatch?.[1] || !dateMatch[2] || !dateMatch[3]) throw new Error("My Choice reporting date is missing");
  const dataAsOf = dateMatch[3] + "-" + dateMatch[2].padStart(2, "0") + "-" + dateMatch[1].padStart(2, "0");
  const results: FundFactSheetReturn[] = [];

  for (const block of text.split(/\f/)) {
    const sourceName = block.match(/\bMY CHOICE[ \t]+([A-Z0-9&'/-]+(?:[ \t]+[A-Z0-9&'/-]+)*[ \t]+FUND)\b/i)?.[1];
    if (!sourceName) continue;
    const performanceIndex = block.search(/Annualized\s+Return/i);
    if (performanceIndex < 0) continue;

    const section = block.slice(performanceIndex);
    const row = section.match(/\b3 Years\s+(N\/A|[+-]?\d+(?:\.\d+)?)\s+(N\/A|[+-]?\d+(?:\.\d+)?)/i);
    const value = row?.[2];
    if (!value || /N\/A/i.test(value)) continue;

    const annualizedReturn3Year = Number(value);
    if (!Number.isFinite(annualizedReturn3Year)) continue;
    results.push({
      schemeName: "My Choice Mandatory Provident Fund Scheme",
      constituentFundName: "My Choice " + titleCaseFundName(sourceName),
      dataAsOf,
      sourceUrl,
      annualizedReturn3Year,
    });
  }

  if (results.length === 0) throw new Error("No My Choice three-year returns found");
  if (new Set(results.map((result) => result.constituentFundName)).size !== results.length) {
    throw new Error("My Choice fund names are ambiguous");
  }
  return results;
}
