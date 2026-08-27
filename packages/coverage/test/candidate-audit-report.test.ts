import { describe, expect, it } from "vitest";
import { buildCandidateAuditReport } from "../src/candidate-audit-report";

const record = {
  fundClassId: "fund-a",
  identity: { trusteeName: "Trustee", schemeName: "Scheme", constituentFundName: "Fund A", fundClassName: "Class I" },
  current: true,
  dataAsOf: "2026-06-30",
  returns: { 3: { annualized: 5, dataAsOf: "2026-06-30" } },
  fundOverview: { fee: 0.8, monthlyReturn: 35, allocationTotal: 102 },
};

describe("candidate audit report", () => {
  it("retains traceable anomalies, sources, dates, and affected fund classes", () => {
    const result = buildCandidateAuditReport(
      "batch-1",
      [record],
      [{ ...record, identity: { ...record.identity, fundClassName: "Class II" } }],
      [{ sourceType: "trustee-fund-list", consecutiveFailures: 2 }],
      { version: "test.v1", monthlyReturnAbsolutePercent: 30, allocationMinimumPercent: 99, allocationMaximumPercent: 101, consecutiveSourceFailures: 2, feeFields: ["fee"] },
      [{ url: "https://official.test/fund-a", dataAsOf: "2026-06-30", retrievedAt: "2026-08-13T00:00:00Z" }],
    );

    expect(result).toMatchObject({ batchId: "batch-1", policyVersion: "test.v1", requiresReview: true, inputRecords: 1, previousRecords: 1 });
    expect(result.affectedFundClassIds).toEqual(["fund-a"]);
    expect(result.sources).toEqual([{ url: "https://official.test/fund-a", dataAsOf: "2026-06-30", retrievedAt: "2026-08-13T00:00:00Z" }]);
    expect(result.anomalies).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "identity_changed", fundClassId: "fund-a" })]));
  });
});
