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
    expect(result.blockedDetails[0]).toMatchObject({
      fundClassId: "fund-a",
      sourceUrl: "https://example.test/fund-a",
      dataAsOf: "2026-06-30",
      missing: expect.arrayContaining(["oci1yHkd"]),
    });
  });

  it("separates official unavailable fields from generic missing fields", () => {
    const result = buildPublicationReadinessReport([
      { ...record, unavailableFields: ["latestFer", "oci1yHkd"] },
    ]);

    expect(result.unavailableByField).toEqual({ latestFer: 1, oci1yHkd: 1 });
  });
});
