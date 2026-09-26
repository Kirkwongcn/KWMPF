import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

export function parseMassFundPerformance(
  text: string,
  sourceUrl: string,
): FundFactSheetReturn[] {
  const reportDataAsOf = massReportDataAsOf(text);
  const results: FundFactSheetReturn[] = [];
  for (const block of text.split(/\f/)) {
    const name = block.match(/(?:YF Life Trustees Ltd\.\s*\n\s*)?([A-Za-z0-9][A-Za-z0-9 &'()/-]+?Fund)\s+Published in/im)?.[1]?.trim() ?? block
      .split("\n")
      .map((line) => line.match(/^\s*(.+?Fund)\s+Risk/i)?.[1])
      .find(Boolean)
      ?.replace(/\s+/g, " ")
      .trim();
    if (!name) continue;
    const dataAsOf = reportDataAsOf;
    const annualizedIndex = block.search(/Annualized(?:\s+Return)?/i);
    if (annualizedIndex < 0) continue;
    const row = block.slice(annualizedIndex).match(/Annualized(?:\s+Return)?[\s\S]{0,500}?((?:[+-]?\d+(?:\.\d+)?%|N\/A)(?:\s+(?:[+-]?\d+(?:\.\d+)?%|N\/A)){3,})/i)
      ?? block.slice(annualizedIndex).match(/Fund\s+基金\s+((?:[+-]?\d+(?:\.\d+)?%|N\/A)(?:\s+(?:[+-]?\d+(?:\.\d+)?%|N\/A))+)/i);
    const values = row?.[1]?.match(/N\/A|[+-]?\d+(?:\.\d+)?%/gi) ?? [];
    const threeYear = values[1];
    if (!threeYear || /N\/A/i.test(threeYear)) continue;
    const annualizedReturn3Year = Number.parseFloat(threeYear);
    if (!Number.isFinite(annualizedReturn3Year)) continue;
    const normalizedName = name.replace("Accumulaton", "Accumulation");
    results.push({ schemeName: "MASS Mandatory Provident Fund Scheme", constituentFundName: normalizedName, dataAsOf, sourceUrl, annualizedReturn3Year });
  }
  if (results.length === 0) throw new Error("No MASS three-year returns found");
  if (new Set(results.map((result) => result.constituentFundName)).size !== results.length) throw new Error("MASS fund names are ambiguous");
  return results;
}

function massReportDataAsOf(text: string): string {
  const match = text.match(
    /Fund Data as at\s+([A-Za-z]+)[\s\S]{0,80}?\b(\d{1,2}),\s*(\d{4})/i,
  );
  if (!match) throw new Error("MASS fund data-as-of date is missing");
  return parseMassDate(`${match[1]} ${match[2]}, ${match[3]}`);
}

function parseMassDate(value: string): string {
  const match = value.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/);
  const monthName = match?.[1];
  const day = Number(match?.[2]);
  const year = Number(match?.[3]);
  if (!monthName || !Number.isInteger(day) || !Number.isInteger(year)) {
    throw new Error(`Unsupported MASS report date: ${value}`);
  }
  const monthDate = new Date(`${monthName} 1, ${year} UTC`);
  if (!Number.isFinite(monthDate.getTime())) {
    throw new Error(`Unsupported MASS report date: ${value}`);
  }
  const month = monthDate.getUTCMonth() + 1;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Unsupported MASS report date: ${value}`);
  }
  return date.toISOString().slice(0, 10);
}
