import { readFile, writeFile } from "node:fs/promises";
import { buildCandidateAuditReport, type CandidateAuditSource } from "./candidate-audit-report";
import type { CandidateAnomalyPolicy } from "./candidate-anomalies";
import type { SourceRecord } from "./build-coverage";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const batchId = argument("--batch");
const currentPath = argument("--current");
const previousPath = argument("--previous");
const failuresPath = argument("--failures");
const policyPath = argument("--policy");
const sourcesPath = argument("--sources");
const outputPath = argument("--output");
if (!batchId || !currentPath || !previousPath || !failuresPath || !policyPath || !sourcesPath || !outputPath) {
  throw new Error("Usage: bun coverage:build-candidate-audit-report --batch <id> --current <json> --previous <json> --failures <json> --policy <json> --sources <json> --output <json>");
}

const current = JSON.parse(await readFile(currentPath, "utf8")) as SourceRecord[];
const previous = JSON.parse(await readFile(previousPath, "utf8")) as SourceRecord[];
const failures = JSON.parse(await readFile(failuresPath, "utf8")) as Array<{ sourceType: string; consecutiveFailures: number }>;
const policy = JSON.parse(await readFile(policyPath, "utf8")) as CandidateAnomalyPolicy;
const sources = JSON.parse(await readFile(sourcesPath, "utf8")) as CandidateAuditSource[];
const report = buildCandidateAuditReport(batchId, current, previous, failures, policy, sources);
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, requiresReview: report.requiresReview, anomalies: report.anomalies.length, affectedFundClassIds: report.affectedFundClassIds.length }));
