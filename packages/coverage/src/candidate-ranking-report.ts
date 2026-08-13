import type { SourceRecord } from "./build-coverage";
import { classifyComparisonGroups, type ComparisonGroupEvidence } from "./comparison-group";
import { applyOfficialReturnOverlay, type OfficialReturnObservation, validateOfficialReturnObservations } from "./official-return-overlay";
import { rankDefaultReturns, type ReturnRankingFund, type ReturnRankingResult } from "./return-ranking";

export type CandidateRankingReport = {
  records: ReturnRankingFund[];
  ranking: ReturnRankingResult;
  report: {
    inputRecords: number;
    classified: number;
    insufficientGroups: number;
    conflictingGroups: number;
    validObservations: number;
    invalidObservations: number;
    appliedObservations: number;
    unmatchedObservations: number;
    conflictingObservations: number;
  };
};

export function buildCandidateRankingReport(
  records: SourceRecord[],
  evidence: ComparisonGroupEvidence[],
  observations: OfficialReturnObservation[],
  today = new Date().toISOString().slice(0, 10),
): CandidateRankingReport {
  const classified = classifyComparisonGroups(records, evidence);
  const validation = validateOfficialReturnObservations(observations, today);
  const overlay = applyOfficialReturnOverlay(classified, validation.valid);
  const rankedRecords = overlay.records as typeof classified;
  const rankingFunds: ReturnRankingFund[] = rankedRecords.map((record) => ({
    fundClassId: record.fundClassId,
    fundClassName: record.identity.fundClassName,
    comparisonGroup: record.comparisonGroup ?? "",
    verificationStatus:
      record.comparisonGroupStatus === "conflict"
        ? "source_conflict"
        : record.comparisonGroupStatus === "insufficient"
          ? "pending_verification"
            : (record as typeof record & { status?: string }).status === "source_conflict"
              ? "source_conflict"
            : (record as typeof record & { status?: string }).status === "pending_verification"
              ? "pending_verification"
              : "verified",
    returns: Object.fromEntries(
      Object.entries(record.returns ?? {}).map(([period, value]) => [
        Number(period),
        { value: value?.annualized ?? Number.NaN, dataAsOf: value?.dataAsOf ?? "", ...(value?.status ? { status: value.status } : {}) },
      ]),
    ) as ReturnRankingFund["returns"],
  }));
  const ranking = rankDefaultReturns(rankingFunds);
  return {
    records: rankingFunds,
    ranking,
    report: {
      inputRecords: records.length,
      classified: classified.filter((record) => record.comparisonGroupStatus === "classified").length,
      insufficientGroups: classified.filter((record) => record.comparisonGroupStatus === "insufficient").length,
      conflictingGroups: classified.filter((record) => record.comparisonGroupStatus === "conflict").length,
      validObservations: validation.valid.length,
      invalidObservations: validation.invalid.length,
      appliedObservations: overlay.applied.length,
      unmatchedObservations: overlay.unmatched.length,
      conflictingObservations: overlay.conflicts.length,
    },
  };
}
