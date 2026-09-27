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
  const results: FundFactSheetReturn[] = [];
  const sections = new Map<string, string[]>();
  let currentName: string | undefined;

  for (const page of text.split(/\f/)) {
    const heading = page.match(/^[ \t]*Haitong[ \t]+([^\r\n]*?\bFund)\b/im);
    if (heading && /Issue Price as of|單位價格/i.test(page.slice(heading.index!))) {
      currentName = heading[1]!.replace(/\s+/g, " ").trim();
    }
    if (currentName) {
      const pages = sections.get(currentName) ?? [];
      pages.push(page);
      sections.set(currentName, pages);
    }
  }

  for (const [name, pages] of sections) {
    const section = pages.join("\f");
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
      results.push({
        schemeName: "Haitong MPF Retirement Fund",
        constituentFundName: "Haitong " + titleCaseHaitongFundName(name),
        fundClassName: row[1],
        dataAsOf,
        sourceUrl,
        annualizedReturn3Year: Number.parseFloat(threeYear),
      });
    }
  }

  if (results.length === 0) throw new Error("No Haitong three-year returns found");
  return results;
}
