import { describe, expect, it } from "vitest";
import { calculateCustomReturns, rankLowerVolatility, type VolatilityFund } from "../src/custom-ranking";

const prices = (start: number, end: number) => [{ month: "2025-01", unitPrice: start }, { month: "2026-01", unitPrice: end }];
const volatilityFund = (id: string, value: number): VolatilityFund => ({ fundClassId: id, fundClassName: id, comparisonGroup: "equity", monthlyReturns: Array.from({ length: 36 }, (_, index) => ({ month: `${2023 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`, value })) });

describe("custom return and volatility rankings", () => {
  it("calculates cumulative returns without annualizing or interpolating", () => {
    const result = calculateCustomReturns([
      { fundClassId: "a", fundClassName: "A", comparisonGroup: "equity", prices: prices(100, 110) },
      { fundClassId: "b", fundClassName: "B", comparisonGroup: "equity", prices: [{ month: "2025-01", unitPrice: 100 }] },
    ], "2025-01", "2026-01");
    expect(result.annualized).toBe(false);
    expect(result.rows[0]).toMatchObject({ cumulativeReturn: 10, displayValue: "10.00%" });
    expect(result.exclusions).toEqual([{ fundClassId: "b", fundClassName: "B", comparisonGroup: "equity", reason: "missing_endpoint" }]);
  });

  it("rejects short or incomplete periods", () => {
    const fund = { fundClassId: "a", fundClassName: "A", comparisonGroup: "equity", prices: prices(100, 110) };
    expect(calculateCustomReturns([fund], "2025-01-15", "2026-01").exclusions[0]?.reason).toBe("incomplete_month");
    expect(calculateCustomReturns([fund], "2025-01", "2025-12").exclusions[0]?.reason).toBe("less_than_12_months");
  });

  it("labels and ranks complete three-year volatility from low to high or reverse", () => {
    const result = rankLowerVolatility([volatilityFund("low", 0.01), volatilityFund("high", 0.03)]);
    expect(result.label).toBe("較低波幅排序");
    expect(result.rows.map((row) => row.fundClassId)).toEqual(["low", "high"]);
    expect(rankLowerVolatility([volatilityFund("low", 0.01), volatilityFund("high", 0.03)], "high_to_low").rows.map((row) => row.fundClassId)).toEqual(["high", "low"]);
    expect(rankLowerVolatility([volatilityFund("short", 0.01)].map((fund) => ({ ...fund, monthlyReturns: fund.monthlyReturns.slice(1) })).concat([])).exclusions).toEqual([{ fundClassId: "short", reason: "missing_month" }]);
  });

  it("excludes a 36-row series when its months are not consecutive", () => {
    const fund = volatilityFund("gap", 0.02);
    fund.monthlyReturns[12] = { month: "2024-02", value: 0.02 };
    expect(rankLowerVolatility([fund]).exclusions).toEqual([{ fundClassId: "gap", reason: "missing_month" }]);
  });
});
