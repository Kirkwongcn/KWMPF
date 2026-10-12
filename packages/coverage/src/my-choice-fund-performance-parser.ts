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
  // 「3年 3 Years <累積> <年率化>」。有「有關更改」嘅基金印兩張表（自有關更改起、自成立起），兩行三年要一致。
  // 唔再要求同頁有「Annualized Return」字樣：多數版面表頭斷行，舊寫法因此漏咗十四隻基金。
  const rowsByFund = new Map<string, string[]>();
  const cell = String.raw`(-|N\/A|[+-]?\d+(?:\.\d+)?)`;
  const threeYearRow = new RegExp(String.raw`^\s*(?:3年\s+)?3 Years\s+` + cell + String.raw`\s+` + cell + String.raw`(?:\s|$)`, "gim");

  for (const block of text.split(/\f/)) {
    // 基金標題全大寫；分大小寫，免得頁首頁尾「My Choice Mandatory Provident Fund Scheme」當咗基金名。
    const sourceName = block.match(/\bMY CHOICE[ \t]+([A-Z0-9&'/-]+(?:[ \t]+[A-Z0-9&'/-]+)*[ \t]+FUND)\b/)?.[1];
    const rows = [...block.matchAll(threeYearRow)].map((row) => `${row[1]} ${row[2]}`);
    if (rows.length === 0) continue;
    if (!sourceName) throw new Error("My Choice three-year row has no fund heading on its page");
    const name = "My Choice " + titleCaseFundName(sourceName);
    rowsByFund.set(name, [...(rowsByFund.get(name) ?? []), ...rows]);
  }

  for (const [constituentFundName, rows] of rowsByFund) {
    if (new Set(rows).size !== 1) throw new Error(`My Choice three-year rows disagree for ${constituentFundName}: ${rows.join(" / ")}`);
    const value = rows[0]!.split(" ")[1]!;
    if (value === "-" || /N\/A/i.test(value)) continue;
    const annualizedReturn3Year = Number(value);
    if (!Number.isFinite(annualizedReturn3Year)) throw new Error(`My Choice three-year return is invalid for ${constituentFundName}`);
    results.push({ schemeName: "My Choice Mandatory Provident Fund Scheme", constituentFundName, dataAsOf, sourceUrl, annualizedReturn3Year });
  }

  if (results.length === 0) throw new Error("No My Choice three-year returns found");
  if (new Set(results.map((result) => result.constituentFundName)).size !== results.length) {
    throw new Error("My Choice fund names are ambiguous");
  }
  return results;
}
