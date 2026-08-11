import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

function parseDate(text: string) {
  const match = text.match(/As at\s+(\d{1,2})-(\w{3})-(\d{4})/i);
  if (!match) throw new Error("AMTD fund fact sheet date is missing");
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = months.indexOf(match[2]!.toLowerCase());
  if (month < 0) throw new Error("AMTD fund fact sheet date is invalid");
  return `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
}

export function parseAmtdFundFactSheet(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const normalized = text.replace(/\r/g, "");
  const dataAsOf = parseDate(normalized);
  const results: FundFactSheetReturn[] = [];
  for (const page of normalized.split(/\f/)) {
    if (!page.includes("Annualized Return") || !page.includes("3 yrs")) continue;
    const name = page.match(/AMTD (?:Allianz|Invesco)[^\n]+ Fund/)?.[0]?.trim();
    const annualized = page
      .slice(page.indexOf("Annualized Return"))
      .split("\n")
      .slice(0, 14)
      .map((line) => line.match(/([+-]?\d+(?:\.\d+)?%)/g))
      .find((values) => values && values.length >= 4);
    if (!name || !annualized) throw new Error("AMTD annualized return row is incomplete");
    results.push({ schemeName: "AMTD MPF Scheme", constituentFundName: name, dataAsOf, sourceUrl, annualizedReturn3Year: Number(annualized[1]!.replace("%", "")) });
  }
  if (results.length === 0) throw new Error("No AMTD fund performance blocks found");
  return results;
}
