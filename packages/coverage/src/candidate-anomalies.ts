import type { SourceRecord } from "./build-coverage";

export type CandidateAnomalyKind =
  | "identity_changed"
  | "same_date_value_revised"
  | "large_monthly_return"
  | "allocation_total_out_of_range"
  | "fee_changed"
  | "source_failed_twice";

export type CandidateAnomaly = {
  kind: CandidateAnomalyKind;
  fundClassId?: string;
  sourceType?: string;
  field?: string;
  detail: string;
};

export type CandidateAnomalyPolicy = {
  version: string;
  monthlyReturnAbsolutePercent: number;
  allocationMinimumPercent: number;
  allocationMaximumPercent: number;
  consecutiveSourceFailures: number;
  feeFields: string[];
};

export const DEFAULT_CANDIDATE_ANOMALY_POLICY: CandidateAnomalyPolicy = {
  version: "2026-08-27.v2",
  monthlyReturnAbsolutePercent: 30,
  allocationMinimumPercent: 99,
  allocationMaximumPercent: 101,
  consecutiveSourceFailures: 2,
  feeFields: ["fee", "managementFee", "latestFer", "oci1yHkd"],
};

function normalizeIdentity(identity: SourceRecord["identity"]) {
  return Object.fromEntries(
    Object.entries(identity).map(([key, value]) => [
      key,
      value.replace(/\s+/g, " ").trim(),
    ]),
  );
}

function sameIdentity(a: SourceRecord, b: SourceRecord) {
  return (
    JSON.stringify(normalizeIdentity(a.identity)) ===
    JSON.stringify(normalizeIdentity(b.identity))
  );
}

export function detectCandidateAnomalies(
  current: SourceRecord[],
  previous: SourceRecord[],
  sourceFailures: Array<{ sourceType: string; consecutiveFailures: number }>,
  policy = DEFAULT_CANDIDATE_ANOMALY_POLICY,
) {
  const anomalies: CandidateAnomaly[] = [];
  const previousById = new Map(previous.map((record) => [record.fundClassId, record]));
  for (const record of current) {
    const old = previousById.get(record.fundClassId);
    if (!old) continue;
    if (!sameIdentity(record, old)) anomalies.push({ kind: "identity_changed", fundClassId: record.fundClassId, detail: "基金類別身份已改變" });
    for (const [period, observation] of Object.entries(record.returns ?? {})) {
      const oldObservation = old.returns?.[Number(period) as 1 | 3 | 5 | 10];
      if (oldObservation?.dataAsOf === observation?.dataAsOf && oldObservation.annualized !== observation?.annualized) {
        anomalies.push({ kind: "same_date_value_revised", fundClassId: record.fundClassId, detail: `${period} 年回報同一截至日數值被修訂` });
      }
    }
    const monthlyReturn = record.fundOverview?.monthlyReturn;
    if (typeof monthlyReturn === "number" && Math.abs(monthlyReturn) > policy.monthlyReturnAbsolutePercent) {
      anomalies.push({ kind: "large_monthly_return", fundClassId: record.fundClassId, detail: `月度回報 ${monthlyReturn}% 超過門檻` });
    }
    const allocationTotal = record.fundOverview?.allocationTotal;
    if (typeof allocationTotal === "number" && (allocationTotal < policy.allocationMinimumPercent || allocationTotal > policy.allocationMaximumPercent)) {
      anomalies.push({ kind: "allocation_total_out_of_range", fundClassId: record.fundClassId, detail: `配置合計 ${allocationTotal}% 超出範圍` });
    }
    for (const field of policy.feeFields) {
      const oldFee = old.fundOverview?.[field];
      const newFee = record.fundOverview?.[field];
      if (oldFee !== undefined && newFee !== undefined && oldFee !== newFee) {
        anomalies.push({ kind: "fee_changed", fundClassId: record.fundClassId, field, detail: `${field} 由 ${String(oldFee)} 改為 ${String(newFee)}` });
      }
    }
  }
  for (const failure of sourceFailures) {
    if (failure.consecutiveFailures >= policy.consecutiveSourceFailures) anomalies.push({ kind: "source_failed_twice", sourceType: failure.sourceType, detail: `來源連續失敗 ${failure.consecutiveFailures} 次` });
  }
  return { policyVersion: policy.version, anomalies, requiresReview: anomalies.length > 0 };
}
