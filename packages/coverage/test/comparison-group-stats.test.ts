import { describe, expect, it } from "vitest";
import {
  COMPARISON_GROUP_STATS_MIN_SAMPLE,
  buildComparisonGroupStats,
  comparisonGroupNameFor,
  type ComparisonGroupStatsFund,
} from "../src/comparison-group-stats";

const holdings = (...percents: number[]) => ({
  temporalScopes: {
    topHoldings: { kind: "point-in-time" as const, asOf: "2026-05-31" },
  },
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
    fundType: "Equity Fund - Hong Kong Equity Fund",
    fundRiskAsOf: "2026-08-31",
    factSheetDisclosure: holdings(12, 8, 7),
    fundRiskIndicator: 18,
    ...overrides,
  };
}

describe("comparison group naming", () => {
  it("uses the official MPFA Chinese fund type only", () => {
    expect(comparisonGroupNameFor({ fundType: "Equity Fund - Hong Kong Equity Fund" })).toBe(
      "股票基金 - 香港股票基金",
    );
    expect(comparisonGroupNameFor({ fundType: "Guaranteed Fund" })).toBe("保證基金");
  });

  it("puts a fund with no official MPFA type in no group", () => {
    expect(comparisonGroupNameFor({ fundType: "Equity Fund (North America)" })).toBeUndefined();
    expect(comparisonGroupNameFor({})).toBeUndefined();
  });
});

describe("buildComparisonGroupStats", () => {
  it("writes one frozen row per comparison group", () => {
    const rows = buildComparisonGroupStats([
      fund("hk-a"),
      fund("hk-b"),
      fund("hk-c", { fundRiskIndicator: 12 }),
      fund("bond-a", {
        fundType: "Bond Fund - Hong Kong Dollar Bond Fund",
        fundRiskIndicator: 3,
      }),
      fund("unofficial", { fundType: "Equity Fund (North America)" }),
    ]);

    expect(rows.map((row) => row.comparisonGroup)).toEqual([
      "債券基金 - 港元債券基金",
      "股票基金 - 香港股票基金",
    ]);
    expect(rows[1]).toMatchObject({
      fundCount: 3,
      top10Count: 3,
      volatilityCount: 3,
      insufficientSample: false,
      avgTop10Concentration: 27,
      avgVolatility3y: 16,
      sourceDates: {
        top10Concentration: { from: "2026-05-31", to: "2026-05-31", undatedCount: 0 },
        volatility3y: { from: "2026-08-31", to: "2026-08-31", undatedCount: 0 },
      },
    });
    expect(rows[0]?.insufficientSample).toBe(true);
    expect(rows[0]?.avgTop10Concentration).toBeNull();
    expect(rows[0]?.avgVolatility3y).toBeNull();
  });

  it("treats a group smaller than the sample threshold as insufficient", () => {
    expect(COMPARISON_GROUP_STATS_MIN_SAMPLE).toBe(3);
    const [row] = buildComparisonGroupStats([fund("a"), fund("b")]);
    expect(row).toMatchObject({
      fundCount: 2,
      insufficientSample: true,
      avgTop10Concentration: null,
      avgVolatility3y: null,
    });
  });

  it("does not output a metric average when fewer than three funds disclose that metric", () => {
    const [row] = buildComparisonGroupStats([
      fund("a"),
      fund("b"),
      fund("c", { unavailableFields: ["fundRiskIndicator"] }),
      fund("d", { unavailableFields: ["fundRiskIndicator"] }),
    ]);

    expect(row).toMatchObject({
      fundCount: 4,
      volatilityCount: 2,
      insufficientSample: false,
      avgVolatility3y: null,
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

  it("keeps field dates separate and counts valid samples with no explicit field date", () => {
    const [row] = buildComparisonGroupStats([
      fund("dated-a"),
      fund("undated", {
        factSheetDisclosure: { topHoldings: [{ rank: 1, percent: 20 }] },
        fundRiskAsOf: undefined,
      }),
      fund("dated-b", {
        factSheetDisclosure: {
          temporalScopes: {
            topHoldings: { kind: "point-in-time", asOf: "2026-07-31" },
          },
          topHoldings: [{ rank: 1, percent: 20 }],
        },
        fundRiskAsOf: "2026-08-31",
      }),
    ]);

    expect(row?.sourceDates).toEqual({
      top10Concentration: { from: "2026-05-31", to: "2026-07-31", undatedCount: 1 },
      volatility3y: { from: "2026-08-31", to: "2026-08-31", undatedCount: 1 },
    });
  });
});
