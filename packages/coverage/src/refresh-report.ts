import { buildCandidateAuditReport } from "./candidate-audit-report";
import { buildPublicationInputs } from "./build-publication-input";
import type { SourceSnapshot } from "./build-coverage";
import { DEFAULT_CANDIDATE_ANOMALY_POLICY } from "./candidate-anomalies";
import { buildPublicationReadinessReport } from "./publication-readiness-report";
import { decideRefresh, renderRefreshSummary } from "./refresh-decision";

export type RefreshReportOptions = {
  batchId: string;
  snapshotPath: string;
  deployInput?: string;
};

export function buildRefreshReport(
  candidate: SourceSnapshot,
  previous: SourceSnapshot | undefined,
  options: RefreshReportOptions,
) {
  if (!candidate.sourceDataAsOf) {
    throw new Error("候選快照缺少 sourceDataAsOf，無法判斷是否有新批次");
  }

  const readiness = buildPublicationReadinessReport(
    buildPublicationInputs(candidate.records),
  );
  const audit = buildCandidateAuditReport(
    options.batchId,
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
    candidateContentChanged:
      previous !== undefined &&
      JSON.stringify(candidate.records) !== JSON.stringify(previous.records),
    readiness,
    audit,
  });
  const markdown = renderRefreshSummary(decision, {
    readiness,
    audit,
    snapshotPath: options.snapshotPath,
    deployInput: options.deployInput,
    expectedCounts: candidate.expectedCounts,
    expectedCountsSource: candidate.expectedCountsSource,
  });

  return { decision, readiness, audit, markdown };
}
