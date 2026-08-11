export type FundFactSheetReturn = {
  schemeName: string;
  constituentFundName: string;
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

export function parseFundFactSheet(text: string, sourceUrl: string): FundFactSheetReturn[] {
  const normalized = text.replace(/\r/g, "");
  const header = normalized.match(/^(.*?)\n.*?\nAs of .*? (\d{1,2}\/\d{1,2}\/\d{4})/m);
  if (!header?.[1] || !header[2]) throw new Error("Fund fact sheet header is missing");
  const schemeName = normalize(header[1]);
  const dataAsOf = parseDate(header[2]);
  const results: FundFactSheetReturn[] = [];

  for (const block of normalized.split(/\\f|\f/).slice(1)) {
    const lines = block.split("\n").map(normalize).filter(Boolean);
    const performanceIndex = lines.findIndex((line) => line.includes("Annualised Return"));
    if (performanceIndex < 1) continue;
    const fundName = lines[0];
    const values = lines
      .slice(performanceIndex + 1, performanceIndex + 8)
      .join(" ")
      .match(/[+-]?\d+(?:\.\d+)?%/g);
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
