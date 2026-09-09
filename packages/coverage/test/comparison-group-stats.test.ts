import { describe, expect, it } from "vitest";
import type { MappedAllocation } from "../src/allocation-label-map";
import {
  COMPARISON_GROUP_STATS_MIN_SAMPLE,
  buildComparisonGroupStats,
  comparisonGroupNameFor,
  type ComparisonGroupStatsFund,
} from "../src/comparison-group-stats";

const buckets = (
  equity: number,
  bond: number,
  cashAndOther: number,
): MappedAllocation => ({
  official: false,
  mapVersion: "2026-09-08",
  asOf: "2026-06-30",
  sourceHeading: "Asset Allocation",
  buckets: { equity, bond, cashAndOther },
});

const holdings = (...percents: number[]) => ({
  topHoldings: percents.map((percent, index) => ({
    rank: index + 1,
    percent,
  })),
});

function fund(
  id: string,
  overrides: Partial<ComparisonGroupStatsFund> = {},
): ComparisonGroupStatsFund {
  return {
    fundClassId: id,
    verificationStatus: "verified",
    lipperCategory: "Hong Kong Equity",
    fundType: "Equity Fund - Hong Kong Equity Fund",
    mappedAllocation: buckets(90, 5, 5),
    factSheetDisclosure: holdings(12, 8, 7),
    fundRiskIndicator: 18,
    ...overrides,
  };
}

describe("comparison group naming", () => {
  it("uses the Lipper category when present", () => {
    expect(
      comparisonGroupNameFor({
        lipperCategory: "Hong Kong Equity",
        fundType: "Equity Fund - Hong Kong Equity Fund",
      }),
    ).toBe("Hong Kong Equity");
  });

  it("prefixes a platform-only group so it cannot merge into a same-named Lipper category", () => {
    expect(comparisonGroupNameFor({ lipperCategory: "Guaranteed Fund" })).toBe(
      "Guaranteed Fund",
    );
    expect(comparisonGroupNameFor({ fundType: "Guaranteed Fund" })).toBe(
      "平台分類：Guaranteed Fund",
    );
  });

  it("falls back to the platform descriptor, then 未分類", () => {
    expect(
      comparisonGroupNameFor({ fundCategory: "Equity Fund (North America)" }),
    ).toBe("平台分類：Equity Fund (North America)");
    expect(comparisonGroupNameFor({})).toBe("平台分類：未分類");
  });
});

describe("buildComparisonGroupStats", () => {
  it("writes one frozen row per comparison group", () => {
    const rows = buildComparisonGroupStats([
      fund("hk-a"),
      fund("hk-b"),
      fund("hk-c", { mappedAllocation: buckets(80, 10, 10), fundRiskIndicator: 12 }),
      fund("bond-a", {
        lipperCategory: "Hong Kong Dollar Bond",
        mappedAllocation: buckets(0, 95, 5),
        fundRiskIndicator: 3,
      }),
    ]);

    expect(rows.map((row) => row.comparisonGroup)).toEqual([
      "Hong Kong Dollar Bond",
      "Hong Kong Equity",
    ]);
    expect(rows[1]).toMatchObject({
      fundCount: 3,
      allocationCount: 3,
      top10Count: 3,
      volatilityCount: 3,
      insufficientSample: false,
      avgAllocation: { equity: 86.67, bond: 6.67, cashAndOther: 6.67 },
      avgTop10Concentration: 27,
      avgVolatility3y: 16,
    });
    expect(rows[0]?.insufficientSample).toBe(true);
    expect(rows[0]?.avgAllocation).toBeNull();
    expect(rows[0]?.avgTop10Concentration).toBeNull();
    expect(rows[0]?.avgVolatility3y).toBeNull();
  });

  it("treats a group smaller than the sample threshold as insufficient", () => {
    expect(COMPARISON_GROUP_STATS_MIN_SAMPLE).toBe(3);
    const [row] = buildComparisonGroupStats([fund("a"), fund("b")]);
    expect(row).toMatchObject({
      fundCount: 2,
      insufficientSample: true,
      avgAllocation: null,
      avgTop10Concentration: null,
      avgVolatility3y: null,
    });
  });

  it("does not output a metric average when fewer than three funds disclose that metric", () => {
    const [row] = buildComparisonGroupStats([
      fund("a"),
      fund("b"),
      fund("c", { mappedAllocation: { official: false, mapVersion: "x", unavailable: true, reason: "not-asset-class" } }),
      fund("d", {
        mappedAllocation: { official: false, mapVersion: "x", unavailable: true, reason: "chart-only" },
      }),
    ]);

    expect(row).toMatchObject({
      fundCount: 4,
      allocationCount: 2,
      insufficientSample: false,
      avgAllocation: null,
      avgTop10Concentration: 27,
    });
  });

  it("excludes unverified funds from the group count and the averages", () => {
    const [row] = buildComparisonGroupStats([
      fund("a"),
      fund("b"),
      fund("c"),
      fund("pending", { verificationStatus: "pending_review", fundRiskIndicator: 99 }),
    ]);

    expect(row?.fundCount).toBe(3);
    expect(row?.avgVolatility3y).toBe(18);
  });

  it("skips a top-10 concentration when any holding has no disclosed weight", () => {
    const [row] = buildComparisonGroupStats([
      fund("a"),
      fund("b"),
      fund("c", {
        factSheetDisclosure: {
          topHoldings: [
            { rank: 1, percent: 10 },
            { rank: 2 },
          ],
        },
      }),
    ]);

    expect(row).toMatchObject({
      top10Count: 2,
      avgTop10Concentration: null,
    });
  });

  it("skips holdings marked unavailable and volatility listed in unavailableFields", () => {
    const [row] = buildComparisonGroupStats([
      fund("a"),
      fund("b"),
      fund("c", {
        factSheetDisclosure: {
          unavailableFields: ["topHoldings"],
          topHoldings: [{ rank: 1, percent: 40 }],
        },
        unavailableFields: ["fundRiskIndicator"],
        fundRiskIndicator: 1,
      }),
    ]);

    expect(row).toMatchObject({
      top10Count: 2,
      volatilityCount: 2,
      avgTop10Concentration: null,
      avgVolatility3y: null,
    });
  });

  it("returns no rows when every fund is unverified", () => {
    expect(
      buildComparisonGroupStats([
        fund("a", { verificationStatus: "pending_review" }),
      ]),
    ).toEqual([]);
  });
});
