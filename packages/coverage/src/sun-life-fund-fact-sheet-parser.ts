import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

type XmlText = { top: number; left: number; width: number; text: string };

function decode(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function readTexts(xml: string): XmlText[] {
  return [...xml.matchAll(/<text\s+top="(\d+)"\s+left="(\d+)"\s+width="(\d+)"[^>]*>([\s\S]*?)<\/text>/g)].map((match) => ({
    top: Number(match[1]),
    left: Number(match[2]),
    width: Number(match[3]),
    text: decode(match[4] ?? ""),
  }));
}

function parseDate(xml: string) {
  const match = xml.match(/As at (\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match?.[1] || !match[2] || !match[3]) throw new Error("Sun Life report date is missing");
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function percentValues(text: string) {
  return [...text.matchAll(/[+-]?\d+(?:\.\d+)?%/g)].map((match) => Number(match[0]!.replace("%", "")));
}

export function parseSunLifeFundFactSheetXml(xml: string, sourceUrl: string): FundFactSheetReturn[] {
  const texts = readTexts(xml);
  const dataAsOf = parseDate(xml);
  const names = texts
    .filter((item) => item.top >= 400 && item.top <= 450 && item.left < 600 && /Sun Life MPF .* Fund(?:\s+[–-]\s+Class [A-Z])?$/.test(item.text))
    .map((item) => ({ name: item.text, top: item.top }))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.name === item.name && candidate.top === item.top) === index);
  const performanceRows = [...new Set(texts.filter((item) => item.top >= 500 && item.top <= 555 && item.left < 680 && item.left + item.width > 600).map((item) => item.top))]
    .sort((a, b) => a - b)
    .map((top) => texts.filter((item) => item.top === top && item.left < 680 && item.left + item.width > 570).sort((a, b) => a.left - b.left).map((item) => item.text).join(" "))
    .filter((text) => percentValues(text).length > 0)
    .map((text, index) => ({ top: index, text }));
  const results: FundFactSheetReturn[] = [];

  for (const [index, name] of names.entries()) {
    const row = performanceRows.sort((a, b) => a.top - b.top)[index];
    if (!row) continue;
    const values = percentValues(row.text);
    const annualizedReturn3Year = values.length >= 2 ? values[1] : undefined;
    if (annualizedReturn3Year === undefined) continue;
    const classMatch = name.name.match(/\s+[–-]\s+(Class [A-Z])$/);
    const constituentFundName = name.name.replace(/\s+[–-]\s+Class [A-Z]$/, "");
    results.push({
      schemeName: "Sun Life Rainbow MPF Scheme",
      constituentFundName,
      ...(classMatch?.[1] ? { fundClassName: classMatch[1] } : {}),
      dataAsOf,
      sourceUrl,
      annualizedReturn3Year,
    });
  }

  if (results.length === 0) throw new Error("Sun Life annualized three-year return rows not found");
  if (new Set(results.map((result) => `${result.constituentFundName}\u0000${result.fundClassName ?? ""}`)).size !== results.length) {
    throw new Error("Sun Life fund performance rows are ambiguous");
  }
  return results;
}
