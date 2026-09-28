import { readFile, writeFile } from "node:fs/promises";
import { parseSourceSnapshot } from "./input";
import { buildRefreshReport } from "./refresh-report";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const candidatePath = argument("--candidate");
const previousPath = argument("--previous");
const outputJsonPath = argument("--output-json");
const outputMarkdownPath = argument("--output-markdown");
if (!candidatePath || !outputJsonPath || !outputMarkdownPath) {
  throw new Error(
    "Usage: bun coverage:refresh-report --candidate <snapshot.json> [--previous <snapshot.json>] --output-json <report.json> --output-markdown <summary.md>",
  );
}

const candidate = parseSourceSnapshot(
  JSON.parse(await readFile(candidatePath, "utf8")),
);
const previous = previousPath
  ? parseSourceSnapshot(JSON.parse(await readFile(previousPath, "utf8")))
  : undefined;
if (!candidate.sourceDataAsOf) {
  throw new Error("候選快照缺少 sourceDataAsOf，無法判斷是否有新批次");
}

const batchId = argument("--batch") ?? `candidate-${candidate.sourceDataAsOf}`;
const report = buildRefreshReport(candidate, previous, {
  batchId,
  snapshotPath: argument("--publish-path") ?? candidatePath,
  deployInput: argument("--deploy-input"),
});

await writeFile(
  outputJsonPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      decision: report.decision,
      readiness: report.readiness,
      audit: report.audit,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(outputMarkdownPath, report.markdown);
console.log(
  JSON.stringify({
    outcome: report.decision.outcome,
    publishable: report.decision.publishable,
    previousDataAsOf: report.decision.previousDataAsOf ?? null,
    candidateDataAsOf: report.decision.candidateDataAsOf,
    blockedRecords: report.readiness.blockedRecords,
    anomalies: report.audit.anomalies.length,
  }),
);
