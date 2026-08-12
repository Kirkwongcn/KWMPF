import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

export function parseHaitongFundPerformance(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const dateMatch = text.match(/as of\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!dateMatch?.[1] || !dateMatch[2] || !dateMatch[3]) throw new Error("Haitong reporting date is missing");
  const dataAsOf = `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
  const results: FundFactSheetReturn[] = [];
  for (const block of text.split(/\f/)) {
    const name = block
      .match(/HAITONG\s+([A-Z][A-Z ]+FUND)/)?.[1]
      ?.replace(/\s+/g, " ")
      .trim();
    if (!name) continue;
    const rows = [...block.matchAll(/\b([AT])\s+((?:N\/A|[+-]?\d+(?:\.\d+)?%)(?:\s+(?:N\/A|[+-]?\d+(?:\.\d+)?%)){3,})/g)];
    for (const row of rows) {
      const values = row[2]!.match(/N\/A|[+-]?\d+(?:\.\d+)?%/g) ?? [];
      const threeYear = values[1];
      if (!threeYear || /N\/A/i.test(threeYear)) continue;
      const title = name.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()).replace("Sar", "SAR");
      results.push({ schemeName: "Haitong MPF Retirement Fund", constituentFundName: `Haitong ${title}`, fundClassName: row[1], dataAsOf, sourceUrl, annualizedReturn3Year: Number.parseFloat(threeYear) });
    }
  }
  if (results.length === 0) throw new Error("No Haitong three-year returns found");
  return results;
}
