import { readFile, writeFile } from "node:fs/promises";
import { buildCandidateAuditReport } from "./candidate-audit-report";
import { buildPublicationInputs } from "./build-publication-input";
import { buildPublicationReadinessReport } from "./publication-readiness-report";
import { DEFAULT_CANDIDATE_ANOMALY_POLICY } from "./candidate-anomalies";
import { decideRefresh, renderRefreshSummary } from "./refresh-decision";
import { parseSourceSnapshot } from "./input";

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
const readiness = buildPublicationReadinessReport(
  buildPublicationInputs(candidate.records),
);
const audit = buildCandidateAuditReport(
  batchId,
  candidate.records,
  previous?.records ?? [],
  [],
  DEFAULT_CANDIDATE_ANOMALY_POLICY,
  [
    {
      url: candidate.sourceUrl,
      dataAsOf: candidate.sourceDataAsOf,
      retrievedAt: candidate.retrievedAt,
    },
  ],
);
const decision = decideRefresh({
  previousDataAsOf: previous?.sourceDataAsOf,
  candidateDataAsOf: candidate.sourceDataAsOf,
  readiness,
  audit,
});
const markdown = renderRefreshSummary(decision, {
  readiness,
  audit,
  snapshotPath: argument("--publish-path") ?? candidatePath,
  deployInput: argument("--deploy-input"),
  expectedCounts: candidate.expectedCounts,
  expectedCountsSource: candidate.expectedCountsSource,
});

await writeFile(
  outputJsonPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), decision, readiness, audit }, null, 2)}\n`,
);
await writeFile(outputMarkdownPath, markdown);
console.log(
  JSON.stringify({
    outcome: decision.outcome,
    publishable: decision.publishable,
    previousDataAsOf: decision.previousDataAsOf ?? null,
    candidateDataAsOf: decision.candidateDataAsOf,
    blockedRecords: readiness.blockedRecords,
    anomalies: audit.anomalies.length,
  }),
);
