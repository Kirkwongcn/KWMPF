import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

function titleCaseHaitongFundName(value: string) {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/\bSar\b/g, "SAR")
    .replace(/\bMpf\b/g, "MPF");
}

export function parseHaitongFundPerformance(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const dateMatch = text.match(/as of\\s+(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})/i);
  if (!dateMatch?.[1] || !dateMatch[2] || !dateMatch[3]) throw new Error("Haitong reporting date is missing");
  const dataAsOf = dateMatch[3] + "-" + dateMatch[2].padStart(2, "0") + "-" + dateMatch[1].padStart(2, "0");
  const results: FundFactSheetReturn[] = [];
  const headings = [...text.matchAll(/Haitong[ \\t]+([^\\r\\n]*?\\bFund)\\b[^\\r\\n]*\\bIssue Price as of\\b/gi)];

  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index]!;
    const start = heading.index!;
    const end = headings[index + 1]?.index ?? text.length;
    const section = text.slice(start, end);
    const name = heading[1]!.replace(/\\s+/g, " ").trim();
    const annualizedIndex = section.search(/ANNUALIZED RATE OF RETURN/i);
    if (annualizedIndex < 0) continue;
    const calendarIndex = section.search(/CALENDAR YEAR RETURN/i);
    const annualizedTable = section.slice(annualizedIndex, calendarIndex < 0 ? undefined : calendarIndex);
    const rows = [...annualizedTable.matchAll(/\\b([AT])\\s+((?:N\\/A(?:▲)?|不適用(?:▲)?|[+-]?\\d+(?:\\.\\d+)?%)(?:\\s+(?:N\\/A(?:▲)?|不適用(?:▲)?|[+-]?\\d+(?:\\.\\d+)?%))*)/gi)];

    for (const row of rows) {
      const values = row[2]!.match(/N\\/A|不適用|[+-]?\\d+(?:\\.\\d+)?%/gi) ?? [];
      const threeYear = values[1];
      if (!threeYear || /N\\/A|不適用/i.test(threeYear)) continue;
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
