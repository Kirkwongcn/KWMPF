import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

function parseDate(text: string) {
  const matches = [...text.matchAll(/截至(\d{4})年(\d{1,2})月(\d{1,2})日/g)];
  const match = matches.at(-1);
  if (!match) throw new Error("AIA fund fact sheet date is missing");
  return `${match[1]}-${match[2]!.padStart(2, "0")}-${match[3]!.padStart(2, "0")}`;
}

/**
 * 基金行嘅格：數字或者官方「N/A」（中英對照「N/A 不適用」當一格）。N/A 都要計位，否則後面嘅欄會頂上嚟
 * （例如三年 N/A 時讀咗成立至今）。
 */
function cells(text: string) {
  return [...text.matchAll(/N\/A|[+-]?\d+(?:\.\d+)?/g)].map((match) => match[0]);
}

function fundName(lines: string[]) {
  for (const rawLine of lines.slice(0, 14)) {
    const line = rawLine.replace(/[\u0000-\u001f]/g, "").trim();
    // 名後可能有註腳（「MPF Conservative Fund^」「Guaranteed Portfolio*」），唔屬基金名。
    const match = line.match(/^(.+?(?:Fund|Portfolio))[\^*#]*(?:\s+風險級別|\s+Risk Class|\s+\d+\s+\d+\s+\d+|$)/);
    if (match && !/Fund Fact Sheet|Fund Performance/.test(match[1]!)) return match[1]!.trim();
  }
  return undefined;
}

export function parseAiaFundFactSheet(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const normalized = text.replace(/\r/g, "");
  const dataAsOf = parseDate(normalized);
  const results: FundFactSheetReturn[] = [];
  for (const rawPage of normalized.split(/\f/)) {
    if (!rawPage.includes("基金資料 | FUND FACTS") || !rawPage.includes("年度化回報 Annualised Return")) continue;
    const lines = rawPage.split("\n");
    const name = fundName(lines);
    const annualizedIndex = lines.findIndex((line) => line.includes("年度化回報 Annualised Return"));
    if (!name || annualizedIndex < 0) continue;
    const performanceLines = lines.slice(annualizedIndex + 1, annualizedIndex + 8);
    const fundLine = performanceLines.findIndex((line) => line.includes("基金 Fund"));
    if (fundLine < 0) throw new Error(`AIA annualized return row is missing for ${name}`);
    // 基金行有時斷開兩行（中間有 tab）；只讀到基準（Benchmark／指標）嗰行之前，唔好將基準數字當基金數字。
    const rowLines: string[] = [];
    for (const line of performanceLines.slice(fundLine, fundLine + 3)) {
      if (rowLines.length > 0 && /Benchmark|指標|平均成本法|Dollar Cost/u.test(line)) break;
      rowLines.push(line);
    }
    const row = rowLines.join(" ");
    const values = cells(row.slice(row.indexOf("基金 Fund") + "基金 Fund".length));
    if (values.length < 3) continue;
    // 第二格係三年；官方 N/A 就係未有三年回報，唔出數（紅線 2）。
    if (values[1] === "N/A") continue;
    results.push({ schemeName: "AIA MPF - Prime Value Choice", constituentFundName: name, dataAsOf, sourceUrl, annualizedReturn3Year: Number(values[1]) });
  }
  if (results.length === 0) throw new Error("No AIA fund performance blocks found");
  return results;
}
