import { describe, expect, it } from "vitest";
import {
  applyFreshnessStatuses,
  carryForwardFailedFields,
  classifyFreshness,
  fundOverviewGraceDaysFor,
} from "../src/data-freshness";

describe("data freshness", () => {
  it("uses the canonical expiry windows", () => {
    expect(classifyFreshness({ kind: "monthly", asOf: "2026-06-01", today: "2026-08-14" })).toBe("stale");
    expect(classifyFreshness({ kind: "current_status", asOf: "2026-08-08", today: "2026-08-14" })).toBe("verified");
    expect(classifyFreshness({ kind: "current_status", asOf: "2026-08-01", today: "2026-08-14" })).toBe("stale");
  });

  it("keeps a fund overview usable until the next official monthly release can arrive", () => {
    // 官方平台在月結後約 13 日才發布，所以一份概覽在被取代之前最多會舊到約 44 日。
    expect(classifyFreshness({ kind: "fund_overview", asOf: "2026-07-31", today: "2026-09-13" })).toBe("verified");
    expect(classifyFreshness({ kind: "fund_overview", asOf: "2026-07-31", today: "2026-09-16" })).toBe("stale");
  });

  // 見 docs/research/2026-09-10-fund-fact-sheet-publication-deadline.md：財政期終結日本身
  // 嗰份便覽法定期限 3 個月，終結後六個月嗰份法定期限 2 個月，各自加 30 日規格寬限。
  it("computes the statutory fund-overview grace period from each scheme's financial period end date", () => {
    // asOf 落喺財政年結後兩星期內，最近一份到期嘅便覽是財政期終結日本身（3 個月期限）。
    expect(fundOverviewGraceDaysFor("12-31", "2026-01-15")).toBe(120);
    // 財政年結喺 6 月尾，asOf 已經過咗終結後六個月（12 月尾）嗰份便覽（2 個月期限）。
    expect(fundOverviewGraceDaysFor("06-30", "2026-01-15")).toBe(90);
  });

  it("falls back to the conservative default when a fund has no known financial period end date", () => {
    expect(fundOverviewGraceDaysFor(undefined, "2026-01-15")).toBe(45);
  });

  it("marks two funds with different financial period end dates differently stale on the same day", () => {
    const asOf = "2026-01-15";
    const today = "2026-04-25"; // asOf + 100 日：喺 120 日寬限之內，但超過 90 日寬限
    expect(
      classifyFreshness({
        kind: "fund_overview",
        asOf,
        today,
        financialPeriodEndDate: "12-31",
      }),
    ).toBe("verified");
    expect(
      classifyFreshness({
        kind: "fund_overview",
        asOf,
        today,
        financialPeriodEndDate: "06-30",
      }),
    ).toBe("stale");
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

  it("carries the source record's financial period end date into the fund-overview freshness check", () => {
    const record = { fundClassId: "a", identity: { trusteeName: "T", schemeName: "S", constituentFundName: "F", fundClassName: "I" }, current: true, dataAsOf: "2026-01-15", fundOverview: { fee: 0.7 }, financialPeriodEndDate: "06-30" };
    const [result] = applyFreshnessStatuses([record], "2026-04-25");
    expect(result?.fundOverviewStatus).toBe("stale");

    const [resultDecFye] = applyFreshnessStatuses(
      [{ ...record, financialPeriodEndDate: "12-31" }],
      "2026-04-25",
    );
    expect(resultDecFye?.fundOverviewStatus).toBe("verified");
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
