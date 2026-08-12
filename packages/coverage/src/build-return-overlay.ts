import { readFile, writeFile } from "node:fs/promises";
import { applyOfficialReturnOverlay, type OfficialReturnObservation } from "./official-return-overlay";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const coveragePath = argument("--coverage");
const observationsPath = argument("--observations");
const outputPath = argument("--output");
if (!coveragePath || !observationsPath || !outputPath) {
  throw new Error("Usage: bun coverage:build-return-overlay --coverage <coverage.json> --observations <observations.json> --output <overlay.json>");
}

const coverage = JSON.parse(await readFile(coveragePath, "utf8")) as { records: Parameters<typeof applyOfficialReturnOverlay>[0] };
const observations = JSON.parse(await readFile(observationsPath, "utf8")) as OfficialReturnObservation[];
const result = applyOfficialReturnOverlay(coverage.records, observations);
await writeFile(outputPath, `${JSON.stringify({
  baseCoverage: coveragePath,
  generatedAt: new Date().toISOString(),
  records: result.records,
  report: {
    applied: result.applied.length,
    unmatched: result.unmatched.length,
    conflicts: result.conflicts.length,
  },
}, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, applied: result.applied.length, unmatched: result.unmatched.length, conflicts: result.conflicts.length }));
