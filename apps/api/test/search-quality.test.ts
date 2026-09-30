import { describe, it, expect } from "vitest";
import { matchesSearch, positiveInteger } from "../src/search";
import { buildDataQuality } from "../src/data-quality";
import { evaluateFreshness } from "../src/freshness";

describe("search query handling", () => {
  it("finds reordered words across fields and normalizes full-width punctuation", () => {
    expect(
      matchesSearch("tracker fidelity", [
        "Hong Kong Tracker Fund",
        "Fidelity Retirement",
      ]),
    ).toBe(true);
    expect(
      matchesSearch("ＢＯＣ－Ｐｒｕｄｅｎｔｉａｌ", [
        "BOC-Prudential Easy-Choice",
      ]),
    ).toBe(true);
    expect(
      matchesSearch("tracker aia", [
        "Hong Kong Tracker Fund",
        "Fidelity Retirement",
      ]),
    ).toBe(false);
  });
  it("applies explicitly documented query aliases without changing official names", () => {
    expect(matchesSearch("滙豐保守基金", ["HSBC MPF Conservative Fund"])).toBe(
      true,
    );
    expect(matchesSearch("保守基金", ["強積金保守基金"])).toBe(true);
    expect(matchesSearch("寬度測試基金", ["寬度測試基金 10"])).toBe(true);
    expect(matchesSearch("滙豐 保守", ["HSBC MPF Conservative Fund"])).toBe(
      true,
    );
    expect(
      matchesSearch("富達 核心累積", [
        "Core Accumulation Fund",
        "Fidelity Retirement",
      ]),
    ).toBe(true);
  });
  it("rejects malformed or unbounded pagination", () => {
    expect(positiveInteger(undefined, 50, 100)).toBe(50);
    for (const value of ["0", "-1", "1.5", "1e2", "101", "99999999999999999"])
      expect(positiveInteger(value, 50, 100)).toBeNull();
  });
});

describe("source freshness", () => {
  it("excludes future dates and impossible dates rather than normalizing them", () => {
    const today = new Date("2026-09-30T00:00:00Z");
    for (const value of ["2026-02-31", "2026-10-01", "2026-2-3", "not-a-date"])
      expect(evaluateFreshness(value, 90, today).status).toBe("stale");
  });
  it("keeps day 90 and excludes day 91", () => {
    expect(
      evaluateFreshness("2026-06-30", 90, new Date("2026-09-28T23:59:59Z"))
        .status,
    ).toBe("verified");
    expect(
      evaluateFreshness("2026-06-30", 90, new Date("2026-09-29T00:00:00Z"))
        .status,
    ).toBe("stale");
  });
  it("separates period-specific dates, unavailable zero and unverified records", () => {
    const funds = [
      {
        fundClass: {
          schemeName: "Scheme A",
          verificationStatus: "verified",
          annualizedReturn1y: 0,
          annualizedReturn3y: 1.205,
          returnSources: {
            "3": { dataAsOf: "2026-06-30", sourceUrl: "https://trustee.test" },
          },
        },
        provenance: {
          verificationStatus: "verified",
          dataAsOf: "2026-08-31",
          freshnessPolicy: {
            returnsGraceDays: 45,
            threeYearReturnGraceDays: 90,
          },
        },
      },
      {
        fundClass: { schemeName: "Scheme A", verificationStatus: "verified" },
        provenance: { verificationStatus: "verified", dataAsOf: "2026-08-31" },
      },
      {
        fundClass: {
          schemeName: "Scheme B",
          verificationStatus: "pending_verification",
          annualizedReturn1y: 2,
        },
        provenance: { verificationStatus: "verified", dataAsOf: "2026-08-31" },
      },
    ];
    const quality = buildDataQuality(
      funds,
      "snapshot-a",
      new Date("2026-09-30T00:00:00Z"),
    );
    expect(quality.returns[0]).toMatchObject({
      eligible: 1,
      stale: 0,
      missing: 1,
      unverified: 1,
      total: 3,
    });
    expect(quality.returns[1]).toMatchObject({
      eligible: 0,
      stale: 1,
      missing: 1,
      unverified: 1,
      dataAsOf: { earliest: "2026-06-30", latest: "2026-06-30" },
    });
  });
});
