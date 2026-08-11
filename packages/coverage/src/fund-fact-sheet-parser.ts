export type FundFactSheetReturn = {
  schemeName: string;
  constituentFundName: string;
  fundClassName?: string;
  dataAsOf: string;
  sourceUrl: string;
  annualizedReturn3Year: number;
};

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseDate(value: string) {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) throw new Error("Fund fact sheet date is missing");
  const [, day, month, year] = match;
  if (!day || !month || !year) throw new Error("Fund fact sheet date is incomplete");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parsePercent(value: string) {
  const parsed = Number(value.replace("%", ""));
  if (!Number.isFinite(parsed)) throw new Error(`Invalid annualized return: ${value}`);
  return parsed;
}

export function parseFundFactSheet(text: string, sourceUrl: string, schemeNameOverride?: string): FundFactSheetReturn[] {
  const normalized = text.replace(/\r/g, "");
  const lines = normalized.split("\n").map(normalize);
  const schemeName = schemeNameOverride ?? lines.find((line) => /MPF Scheme$/.test(line) && line.length < 80 && !line.includes("Fund Fact Sheet"))
    ?? lines.find((line) => line.endsWith("Fund Fact Sheet"))?.replace(/ Fund Fact Sheet$/, "");
  const dateMatch = normalized.match(/(?:As of|截至 As of)[^\d]{0,30}(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (!schemeName || !dateMatch?.[1]) throw new Error("Fund fact sheet header is missing");
  const dataAsOf = parseDate(dateMatch[1]);
  const results: FundFactSheetReturn[] = [];

  for (const block of normalized.split(/\\f|\f/).slice(1)) {
    const lines = block.split("\n").map(normalize).filter(Boolean);
    const performanceIndex = lines.findIndex((line) => /Annualised (?:Return|Rate of Return)/i.test(line));
    if (performanceIndex < 1) continue;
    const fundName = lines
      .slice(0, performanceIndex)
      .map((line) => ({ line, match: line.match(/\b([A-Za-z][A-Za-z0-9 &'()/-]*Fund)\b/)?.[1] }))
      .findLast(({ line, match }) => Boolean(match) && line.length < 80 && !/Fact Sheet|Fund Performance/i.test(line))
      ?.match;
    if (!fundName) continue;
    const performanceSection = lines.slice(performanceIndex + 1).join(" ").split(/Cumulative Return|累積回報/i)[0]!;
    const values = performanceSection.match(/[+-]?\d+(?:\.\d+)?%/g);
    if (!fundName || !values || values.length < 3) {
      throw new Error(`Annualized return row is incomplete for ${fundName || "unknown fund"}`);
    }
    results.push({
      schemeName,
      constituentFundName: fundName,
      dataAsOf,
      sourceUrl,
      annualizedReturn3Year: parsePercent(values[1]!),
    });
  }
  if (results.length === 0) throw new Error("No fund performance blocks found");
  return results;
}
