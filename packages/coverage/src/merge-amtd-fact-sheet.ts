import { readFile, writeFile } from "node:fs/promises";
import { mergeFundFactSheetReturns } from "./fund-fact-sheet-merge";
import { parseAmtdFundFactSheet } from "./amtd-fund-fact-sheet-parser";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const coveragePath = argument("--coverage");
const textPath = argument("--text");
const sourceUrl = argument("--source-url");
const outputPath = argument("--output");
if (!coveragePath || !textPath || !sourceUrl || !outputPath) {
  throw new Error("Usage: bun merge-amtd-fact-sheet.ts --coverage <coverage.json> --text <pdftotext.txt> --source-url <url> --output <coverage.json>");
}

const coverage = JSON.parse(await readFile(coveragePath, "utf8")) as { records: Parameters<typeof mergeFundFactSheetReturns>[0] };
const returns = parseAmtdFundFactSheet(await readFile(textPath, "utf8"), sourceUrl);
const merged = mergeFundFactSheetReturns(coverage.records, returns);
await writeFile(outputPath, `${JSON.stringify({ ...coverage, records: merged.records }, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, parsed: returns.length, applied: returns.length - merged.unmatched.length - merged.ambiguous.length, unmatched: merged.unmatched.length, ambiguous: merged.ambiguous.length }));
