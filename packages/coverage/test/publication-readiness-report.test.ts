import { describe, expect, it } from "vitest";
import { buildPublicationReadinessReport } from "../src/publication-readiness-report";

const record = {
  fundClassId: "fund-a",
  identity: { trusteeName: "T", schemeName: "S", constituentFundName: "F", fundClassName: "C" },
  current: true,
  status: "verified",
  dataAsOf: "2026-06-30",
  sourceUrl: "https://example.test/fund-a",
  publicFields: { annualizedReturn1y: 4.2 },
};

describe("publication readiness report", () => {
  it("counts every missing publication field without making partial data ready", () => {
    const result = buildPublicationReadinessReport([record]);

    expect(result.ready).toBe(false);
    expect(result.inputRecords).toBe(1);
    expect(result.blockedRecords).toBe(1);
    expect(result.missingByField).toEqual({
      latestFer: 1,
      managementFee: 1,
      oci1yHkd: 1,
      riskClass: 1,
    });
    expect(result.issues).toHaveLength(1);
  });
});
