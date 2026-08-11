import { readFile, writeFile } from "node:fs/promises";
import { mergeFundFactSheetReturns } from "./fund-fact-sheet-merge";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const coveragePath = argument("--coverage");
const factSheetPath = argument("--fact-sheet");
const outputPath = argument("--output");
if (!coveragePath || !factSheetPath || !outputPath) {
  throw new Error("Usage: bun coverage:merge-fact-sheets --coverage <coverage.json> --fact-sheet <returns.json> --output <coverage.json>");
}

const coverage = JSON.parse(await readFile(coveragePath, "utf8")) as { records: Parameters<typeof mergeFundFactSheetReturns>[0] };
const factSheets = JSON.parse(await readFile(factSheetPath, "utf8"));
const merged = mergeFundFactSheetReturns(coverage.records, factSheets);
await writeFile(outputPath, `${JSON.stringify({ ...coverage, records: merged.records }, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, applied: factSheets.length - merged.unmatched.length - merged.ambiguous.length, unmatched: merged.unmatched.length, ambiguous: merged.ambiguous.length }));
