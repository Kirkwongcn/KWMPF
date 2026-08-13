import { readFile, writeFile } from "node:fs/promises";
import { buildPlatformComparisonEvidence } from "./comparison-group";
import type { SourceRecord } from "./build-coverage";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const coveragePath = argument("--coverage");
const outputPath = argument("--output");
if (!coveragePath || !outputPath) {
  throw new Error("Usage: bun coverage:build-comparison-evidence --coverage <coverage.json> --output <comparison-evidence.json>");
}

const coverage = JSON.parse(await readFile(coveragePath, "utf8")) as { records: SourceRecord[] };
const evidence = buildPlatformComparisonEvidence(coverage.records);
const evidenceIds = new Set(evidence.map((item) => item.fundClassId));
await writeFile(outputPath, `${JSON.stringify({
  coveragePath,
  generatedAt: new Date().toISOString(),
  evidence,
  report: {
    inputRecords: coverage.records.length,
    evidenceRecords: evidence.length,
    insufficientRecords: coverage.records.length - evidenceIds.size,
  },
}, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, inputRecords: coverage.records.length, evidenceRecords: evidence.length, insufficientRecords: coverage.records.length - evidenceIds.size }));
