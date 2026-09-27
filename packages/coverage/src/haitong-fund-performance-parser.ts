import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

function titleCaseHaitongFundName(value: string) {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/\bSar\b/g, "SAR")
    .replace(/\bMpf\b/g, "MPF");
}

export function parseHaitongFundPerformance(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const dateMatch = text.match(/as of\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!dateMatch?.[1] || !dateMatch[2] || !dateMatch[3]) throw new Error("Haitong reporting date is missing");
  const dataAsOf = dateMatch[3] + "-" + dateMatch[2].padStart(2, "0") + "-" + dateMatch[1].padStart(2, "0");
  const fundSections: Array<{ name: string; start: number }> = [];
  const headingPattern = /(?:^|\f|\n)[ \t]*Haitong[ \t]+([^\r\n]*?\bFund)\b/gim;

  for (const heading of text.matchAll(headingPattern)) {
    const headingOffset = heading.index;
    if (headingOffset === undefined || !heading[1]) continue;
    const start = headingOffset + heading[0].lastIndexOf("Haitong");
    const pageStart = text.lastIndexOf("\f", start) + 1;
    const pageEndIndex = text.indexOf("\f", start);
    const page = text.slice(pageStart, pageEndIndex < 0 ? undefined : pageEndIndex);
    const localStart = start - pageStart;
    const currentLineStart = page.lastIndexOf("\n", localStart - 1) + 1;
    const currentLineEndIndex = page.indexOf("\n", localStart);
    const currentLineEnd = currentLineEndIndex < 0 ? page.length : currentLineEndIndex;
    const previousLineStartIndex = page.lastIndexOf("\n", Math.max(0, currentLineStart - 2));
    const nearbyStart = previousLineStartIndex < 0 ? 0 : previousLineStartIndex + 1;
    const nextLineEndIndex = page.indexOf("\n", currentLineEnd + 1);
    const nearbyEnd = nextLineEndIndex < 0 ? page.length : nextLineEndIndex;
    const nearby = page.slice(nearbyStart, nearbyEnd);
    if (!/Issue Price as of|單位價格/i.test(nearby)) continue;
    fundSections.push({ name: heading[1].replace(/\s+/g, " ").trim(), start });
  }

  const results: FundFactSheetReturn[] = [];
  for (let index = 0; index < fundSections.length; index += 1) {
    const fund = fundSections[index]!;
    const end = fundSections[index + 1]?.start;
    const section = text.slice(fund.start, end);
    const annualizedIndex = section.search(/ANNUALIZED RATE OF RETURN/i);
    if (annualizedIndex < 0) continue;
    const afterAnnualizedHeading = section.slice(annualizedIndex);
    const calendarIndex = afterAnnualizedHeading.search(/CALENDAR YEAR RETURN/i);
    const annualizedTable = afterAnnualizedHeading.slice(0, calendarIndex < 0 ? undefined : calendarIndex);
    const rows = [...annualizedTable.matchAll(/\b([AT])\s+((?:N\/A(?:▲)?|不適用(?:▲)?|[+-]?\d+(?:\.\d+)?%)(?:\s+(?:N\/A(?:▲)?|不適用(?:▲)?|[+-]?\d+(?:\.\d+)?%))*)/gi)];

    for (const row of rows) {
      const values = row[2]!.match(/N\/A|不適用|[+-]?\d+(?:\.\d+)?%/gi) ?? [];
      const threeYear = values[1];
      if (!threeYear || /N\/A|不適用/i.test(threeYear)) continue;
      const constituentFundName = "Haitong " + titleCaseHaitongFundName(fund.name);
      const annualizedReturn3Year = Number.parseFloat(threeYear);
      const existing = results.find((result) => result.constituentFundName === constituentFundName && result.fundClassName === row[1]);
      if (existing) {
        if (existing.annualizedReturn3Year !== annualizedReturn3Year) {
          throw new Error("Conflicting Haitong annualized rows for " + constituentFundName + " class " + row[1]);
        }
        continue;
      }
      results.push({
        schemeName: "Haitong MPF Retirement Fund",
        constituentFundName,
        fundClassName: row[1],
        dataAsOf,
        sourceUrl,
        annualizedReturn3Year,
      });
    }
  }

  if (results.length === 0) throw new Error("No Haitong three-year returns found");
  return results;
}
