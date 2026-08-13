import { readFile, writeFile } from "node:fs/promises";
import { buildCandidateRankingReport } from "./candidate-ranking-report";
import type { ComparisonGroupEvidence } from "./comparison-group";
import type { OfficialReturnObservation } from "./official-return-overlay";
import type { SourceRecord } from "./build-coverage";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const coveragePath = argument("--coverage");
const evidencePath = argument("--evidence");
const observationsPath = argument("--observations");
const outputPath = argument("--output");
if (!coveragePath || !evidencePath || !observationsPath || !outputPath) {
  throw new Error("Usage: bun coverage:build-candidate-ranking-report --coverage <coverage.json> --evidence <comparison-evidence.json> --observations <observations.json> --output <report.json>");
}

const coverage = JSON.parse(await readFile(coveragePath, "utf8")) as { records: SourceRecord[] };
const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as ComparisonGroupEvidence[];
const observations = JSON.parse(await readFile(observationsPath, "utf8")) as OfficialReturnObservation[];
const report = buildCandidateRankingReport(coverage.records, evidence, observations);
await writeFile(outputPath, `${JSON.stringify({ coveragePath, evidencePath, observationsPath, generatedAt: new Date().toISOString(), ...report }, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, ...report.report, rankingRows: report.ranking.rankings.length }));
