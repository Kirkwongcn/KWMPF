import { describe, expect, it } from "vitest";
import {
  DEFAULT_FUND_OVERVIEW_GRACE_DAYS,
  DEFAULT_RETURNS_GRACE_DAYS,
  evaluateFreshness,
  returnGraceDaysForPeriod,
  fundOverviewGraceDays,
  returnsGraceDays,
} from "../src/freshness";

describe("published data freshness", () => {
  const today = new Date("2026-08-24T09:00:00Z");

  it("keeps a monthly figure verified inside the official disclosure grace period", () => {
    expect(
      evaluateFreshness("2026-07-31", DEFAULT_RETURNS_GRACE_DAYS, today),
    ).toEqual({
      status: "verified",
      dataAsOf: "2026-07-31",
      graceDays: 45,
      ageDays: 24,
    });
  });

  it("marks a figure stale once it is older than the grace period", () => {
    expect(
      evaluateFreshness("2026-01-31", DEFAULT_RETURNS_GRACE_DAYS, today),
    ).toMatchObject({ status: "stale", dataAsOf: "2026-01-31", ageDays: 205 });
  });

  it("treats the last day of the grace period as still verified", () => {
    expect(evaluateFreshness("2026-07-10", 45, today)).toMatchObject({
      status: "verified",
      ageDays: 45,
    });
    expect(evaluateFreshness("2026-07-09", 45, today)).toMatchObject({
      status: "stale",
      ageDays: 46,
    });
  });

  it("applies the 90-day three-year return boundary", () => {
    const policy = {
      returnsGraceDays: 45,
      threeYearReturnGraceDays: 90,
    };
    const graceDays = returnGraceDaysForPeriod(policy, 3);

    expect(graceDays).toBe(90);
    expect(returnGraceDaysForPeriod(policy, 1)).toBe(45);
    expect(evaluateFreshness("2026-05-26", graceDays, today)).toMatchObject({
      status: "verified",
      ageDays: 90,
      graceDays: 90,
    });
    expect(evaluateFreshness("2026-05-25", graceDays, today)).toMatchObject({
      status: "stale",
      ageDays: 91,
      graceDays: 90,
    });
  });

  it("refuses to treat an unreadable date as fresh", () => {
    expect(evaluateFreshness("not-a-date", 45, today)).toEqual({
      status: "stale",
      dataAsOf: "not-a-date",
      graceDays: 45,
      ageDays: null,
    });
  });

  it("falls back to the documented grace periods when a snapshot carries no policy", () => {
    expect(returnsGraceDays(undefined)).toBe(DEFAULT_RETURNS_GRACE_DAYS);
    expect(fundOverviewGraceDays(undefined)).toBe(
      DEFAULT_FUND_OVERVIEW_GRACE_DAYS,
    );
    expect(returnsGraceDays({ returnsGraceDays: 400 })).toBe(400);
    expect(fundOverviewGraceDays({ fundOverviewGraceDays: 10 })).toBe(10);
  });
});
