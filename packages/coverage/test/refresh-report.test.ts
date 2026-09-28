import { describe, expect, it } from "vitest";
import type { SourceRecord, SourceSnapshot } from "../src/build-coverage";
import { buildRefreshReport } from "../src/refresh-report";

const previousRecord: SourceRecord = {
  fundClassId: "mpfa-cf-102",
  identity: {
    trusteeName: "Trustee",
    schemeName: "Scheme",
    constituentFundName: "Fund A",
    fundClassName: "Class I",
  },
  current: true,
  dataAsOf: "2026-08-31",
  sourceUrl: "https://official.test/fund-a",
  returns: {
    1: { annualized: 4.2, dataAsOf: "2026-08-31" },
    3: { annualized: 5.1, dataAsOf: "2026-08-31" },
  },
  fundOverview: {
    riskClass: 4,
    latestFer: 1.2,
    managementFee: 0.8,
    oci1yHkd: 2.4,
  },
};

const snapshot = (record: SourceRecord, retrievedAt: string): SourceSnapshot => ({
  sourceType: "mpf_fund_platform",
  sourceUrl: "https://official.test/platform",
  retrievedAt,
  sourceDataAsOf: "2026-08-31",
  records: [record],
});

describe("refresh report integration", () => {
  it("routes a revised value on the same source date to review before publishing", () => {
    const candidateRecord: SourceRecord = {
      ...previousRecord,
      returns: {
        ...previousRecord.returns,
        3: { annualized: 5.4, dataAsOf: "2026-08-31" },
      },
    };
    const report = buildRefreshReport(
      snapshot(candidateRecord, "2026-09-28T03:52:09.000Z"),
      snapshot(previousRecord, "2026-09-27T03:00:00.000Z"),
      {
        batchId: "candidate-36375202391",
        snapshotPath: "data/sources/2026-09-28/mpf-fund-platform.json",
        deployInput: "2026-09-28/mpf-fund-platform.json",
      },
    );

    expect(report.readiness.ready).toBe(true);
    expect(report.audit.anomalies).toEqual([
      expect.objectContaining({
        kind: "same_date_value_revised",
        fundClassId: "mpfa-cf-102",
      }),
    ]);
    expect(report.decision).toMatchObject({
      outcome: "needs_review",
      publishable: false,
    });
  });
});
