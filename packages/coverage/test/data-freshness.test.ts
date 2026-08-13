import { describe, expect, it } from "vitest";
import { applyFreshnessStatuses, carryForwardFailedFields, classifyFreshness } from "../src/data-freshness";

describe("data freshness", () => {
  it("uses the canonical expiry windows", () => {
    expect(classifyFreshness({ kind: "monthly", asOf: "2026-06-01", today: "2026-08-14" })).toBe("stale");
    expect(classifyFreshness({ kind: "current_status", asOf: "2026-08-08", today: "2026-08-14" })).toBe("verified");
    expect(classifyFreshness({ kind: "current_status", asOf: "2026-08-01", today: "2026-08-14" })).toBe("stale");
  });

  it("carries only failed fields and preserves the previous date", () => {
    const previous = [{ fundClassId: "a", identity: { trusteeName: "T", schemeName: "S", constituentFundName: "F", fundClassName: "I" }, current: true, dataAsOf: "2026-06-30", returns: { 3: { annualized: 4.2, dataAsOf: "2026-06-30" } } }];
    const current = [{ fundClassId: "a", identity: previous[0]!.identity, current: false, dataAsOf: "2026-08-01", returns: { 3: { annualized: 9.9, dataAsOf: "2026-08-01" } } }];
    const result = carryForwardFailedFields(current, previous, [{ fundClassId: "a", field: "returns" }, { fundClassId: "a", field: "current" }]);
    expect(result[0]?.current).toBe(true);
    expect(result[0]?.returns?.[3]).toEqual({ annualized: 4.2, dataAsOf: "2026-06-30", status: "failed_with_last_verified" });
    expect(result[0]?.currentStatus).toBe("failed_with_last_verified");
  });

  it("applies field-specific freshness statuses to a source record", () => {
    const [result] = applyFreshnessStatuses([{ fundClassId: "a", identity: { trusteeName: "T", schemeName: "S", constituentFundName: "F", fundClassName: "I" }, current: true, dataAsOf: "2026-08-08", fundOverview: { fee: 0.7 }, returns: { 3: { annualized: 4.2, dataAsOf: "2026-06-01" } } }], "2026-08-14");
    expect(result?.currentStatus).toBe("verified");
    expect(result?.fundOverviewStatus).toBe("verified");
    expect(result?.returns?.[3]?.status).toBe("stale");
  });

  it("carries a failed fund overview without replacing fresh fields", () => {
    const previous = [{ fundClassId: "a", identity: { trusteeName: "T", schemeName: "S", constituentFundName: "F", fundClassName: "I" }, current: true, dataAsOf: "2026-06-30", fundOverview: { fee: 0.8 } }];
    const current = [{ fundClassId: "a", identity: previous[0]!.identity, current: true, dataAsOf: "2026-08-01", fundOverview: { fee: 0.7 } }];
    const result = carryForwardFailedFields(current, previous, [{ fundClassId: "a", field: "fundOverview" }]);
    expect(result[0]?.fundOverview).toEqual({ fee: 0.8 });
    expect(result[0]?.fundOverviewStatus).toBe("failed_with_last_verified");
    expect(result[0]?.dataAsOf).toBe("2026-08-01");
  });
});
