import { readFile, writeFile } from "node:fs/promises";
import { applyOfficialReturnOverlay, splitReturnObservations, validateOfficialReturnObservations } from "./official-return-overlay";

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
// 只處理年率化；累積回報（basis: "cumulative"）由 publication seed 另行套用。
const observations = splitReturnObservations(JSON.parse(await readFile(observationsPath, "utf8")) as unknown[]).annualized;
const validation = validateOfficialReturnObservations(observations);
if (validation.invalid.length > 0) {
  throw new Error(`Return observation validation failed for ${validation.invalid.length} observation(s)`);
}
const result = applyOfficialReturnOverlay(coverage.records, validation.valid);
await writeFile(outputPath, `${JSON.stringify({
  baseCoverage: coveragePath,
  generatedAt: new Date().toISOString(),
  records: result.records,
  report: {
    applied: result.applied.length,
    unmatched: result.unmatched.length,
    conflicts: result.conflicts.length,
    coverageByPeriod: validation.coverageByPeriod,
  },
}, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, applied: result.applied.length, unmatched: result.unmatched.length, conflicts: result.conflicts.length, coverageByPeriod: validation.coverageByPeriod }));
