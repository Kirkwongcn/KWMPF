import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseDate(text: string) {
  const match = text.match(/(?:截至|as at)\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})/i);
  if (!match?.[1] || !match[2] || !match[3]) throw new Error("HSBC fund fact sheet date is missing");
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function numbers(value: string) {
  return [...value.matchAll(/[+-]?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

export function parseHsbcFundFactSheet(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const dataAsOf = parseDate(text);
  const results: FundFactSheetReturn[] = [];
  for (const rawPage of text.replace(/\r/g, "").split(/\f/)) {
    const lines = rawPage.split("\n").map(normalize).filter(Boolean);
    const performanceIndex = lines.findIndex((line) => line.includes("Fund Performance Information"));
    if (performanceIndex < 0) continue;
    const fundName = lines
      .slice(0, Math.min(performanceIndex, 12))
      .map((line) => line.match(/([A-Z][A-Za-z0-9'’&() -]+(?:Fund|Portfolio))/)?.[1])
      .filter((name): name is string => {
        if (!name) return false;
        return !/Performance|Information|Fact Sheet|Mixed Assets Fund|Money Market Fund|Bond Fund|Equity Fund|Constituent Fund/i.test(name);
      })
      .at(0);
    const thisFundIndex = lines.findIndex((line, index) => index > performanceIndex && line === "This Fund");
    if (!fundName || thisFundIndex < 0) continue;
    const valueLine = lines.slice(thisFundIndex + 1, thisFundIndex + 5).find((line) => numbers(line).length >= 4);
    const values = valueLine ? numbers(valueLine) : [];
    if (values.length < 4) continue;
    results.push({ schemeName: "HSBC Mandatory Provident Fund – SuperTrust Plus", constituentFundName: fundName, dataAsOf, sourceUrl, annualizedReturn3Year: values[1]! });
  }
  if (results.length === 0) throw new Error("No HSBC annualized return blocks found");
  if (new Set(results.map((result) => result.constituentFundName)).size !== results.length) throw new Error("HSBC fund names are ambiguous");
  return results;
}
