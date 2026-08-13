import type { SourceRecord } from "./build-coverage";
import { detectCandidateAnomalies, type CandidateAnomalyPolicy } from "./candidate-anomalies";

export type CandidateAuditSource = { url: string; dataAsOf: string; retrievedAt: string };

export function buildCandidateAuditReport(
  batchId: string,
  current: SourceRecord[],
  previous: SourceRecord[],
  sourceFailures: Array<{ sourceType: string; consecutiveFailures: number }>,
  policy: CandidateAnomalyPolicy,
  sources: CandidateAuditSource[],
) {
  const anomalyReport = detectCandidateAnomalies(current, previous, sourceFailures, policy);
  const affectedFundClassIds = [...new Set(anomalyReport.anomalies.map((anomaly) => anomaly.fundClassId).filter((id): id is string => Boolean(id)))].sort();
  return {
    batchId,
    policyVersion: anomalyReport.policyVersion,
    requiresReview: anomalyReport.requiresReview,
    inputRecords: current.length,
    previousRecords: previous.length,
    generatedAt: new Date().toISOString(),
    anomalies: anomalyReport.anomalies,
    affectedFundClassIds,
    sourceFailures,
    sources,
  };
}
