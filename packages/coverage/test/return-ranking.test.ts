import { describe, expect, it } from "vitest";
import { rankDefaultReturns, type ReturnRankingFund } from "../src/return-ranking";

const observation = (value: number, dataAsOf = "2026-06-30") => ({ value, dataAsOf });
const funds: ReturnRankingFund[] = [
  { fundClassId: "a", fundClassName: "A Equity", comparisonGroup: "equity", verificationStatus: "verified", returns: { 1: observation(5.004), 3: observation(12), 5: observation(20), 10: observation(40) } },
  { fundClassId: "b", fundClassName: "B Equity", comparisonGroup: "equity", verificationStatus: "verified", returns: { 1: observation(5.003), 3: observation(11), 5: observation(19), 10: observation(39) } },
  { fundClassId: "c", fundClassName: "C Bond", comparisonGroup: "bond", verificationStatus: "verified", returns: { 1: observation(3), 3: observation(9), 5: observation(15), 10: observation(25) } },
  { fundClassId: "d", fundClassName: "D Equity", comparisonGroup: "equity", verificationStatus: "pending_verification", returns: { 1: observation(99), 3: observation(99), 5: observation(99), 10: observation(99) } },
  { fundClassId: "e", fundClassName: "E Equity", comparisonGroup: "equity", verificationStatus: "verified", returns: { 1: { ...observation(8), stale: true } } },
];

describe("default return rankings", () => {
  it("ranks only within comparison groups and uses descending annualized returns", () => {
    const result = rankDefaultReturns(funds);
    expect(result.periods).toEqual([1, 3, 5, 10]);
    expect(result.methodology.grouping).toBe("comparison_group");
    expect(result.rankings.filter((row) => row.periodYears === 1).map((row) => [row.comparisonGroup, row.fundClassId, row.rank])).toEqual([
      ["bond", "c", 1],
      ["equity", "a", 1],
      ["equity", "b", 1],
    ]);
  });

  it("excludes invalid observations without changing the published value explanation", () => {
    const result = rankDefaultReturns(funds);
    expect(result.rankings.find((row) => row.fundClassId === "a" && row.periodYears === 1)).toMatchObject({ displayValue: "5.00%", dataAsOf: "2026-06-30" });
    expect(result.exclusions).toEqual(expect.arrayContaining([
      expect.objectContaining({ fundClassId: "d", periodYears: 1, reason: "pending_verification" }),
      expect.objectContaining({ fundClassId: "e", periodYears: 1, reason: "stale" }),
      expect.objectContaining({ fundClassId: "e", periodYears: 3, reason: "insufficient" }),
    ]));
  });

  it("excludes an explicitly carried-forward observation while retaining its value metadata", () => {
    const result = rankDefaultReturns([
      { fundClassId: "carried", fundClassName: "Carried Equity", comparisonGroup: "equity", verificationStatus: "verified", returns: { 1: { value: 7.25, dataAsOf: "2026-06-30", status: "failed_with_last_verified" } } },
    ]);
    expect(result.rankings).toHaveLength(0);
    expect(result.exclusions).toContainEqual(expect.objectContaining({ fundClassId: "carried", reason: "stale" }));
  });
});
