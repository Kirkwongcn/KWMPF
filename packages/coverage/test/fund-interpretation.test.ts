import { describe, expect, it } from "vitest";
import { interpretFund } from "../src/fund-interpretation";
import type { ComparisonGroupStatsRow } from "../src/comparison-group-stats";
import { interpretationThresholds } from "../src/interpretation-thresholds";

const group: ComparisonGroupStatsRow = {
  comparisonGroup: "股票基金 - 香港股票基金",
  avgTop10Concentration: 50, avgVolatility3y: 50, fundCount: 3,
  top10Count: 3, volatilityCount: 3, insufficientSample: false,
  sourceDates: {
    top10Concentration: { from: "2026-05-31", to: "2026-05-31", undatedCount: 0 },
    volatility3y: { from: "2026-08-31", to: "2026-08-31", undatedCount: 0 },
  },
};
const values = (value: number) => ({ top10Concentration: value, volatility3y: value });

describe("fund interpretation", () => {
  it.each([[47.99, "lower"], [48, "similar"], [50, "similar"], [52, "similar"], [52.01, "higher"]])("classifies %s independently for all factors", (value, status) => {
    const result = interpretFund(values(Number(value)), group);
    for (const factor of [result.top10Concentration, result.volatility3y]) expect(factor.status).toBe(status);
  });
  it("prints neutral Chinese wording and no editorial allocation factor", () => {
    const result = interpretFund({ top10Concentration: 47, volatility3y: 51 }, group);
    expect(result.top10Concentration.text).toBe("十大持倉佔比 47%，比同組別平均低 3 個百分點。");
    expect(result.volatility3y.text).toBe("3年波幅 51%，與同組別平均相若。");
    expect(result).not.toHaveProperty("equity");
  });
  it("does not round a just-outside value into similar", () => {
    expect(interpretFund(values(52.001), group).top10Concentration.status).toBe("higher");
  });
  it("accepts a decimal boundary despite floating point subtraction", () => {
    expect(interpretFund(values(4.1), { ...group, avgVolatility3y: 2.1 }).volatility3y.status).toBe("similar");
  });
  it("suppresses all conclusions for an insufficient group", () => {
    for (const overrides of [{ insufficientSample: true }, { fundCount: 2 }]) {
      const result = interpretFund(values(60), { ...group, ...overrides });
      expect(result.top10Concentration.status).toBe("insufficient-sample");
      expect(result.volatility3y.text).toContain("同組別樣本不足，未能比較");
    }
  });
  it("suppresses only the metric with fewer than three observations", () => {
    const result = interpretFund(values(60), { ...group, volatilityCount: 2, avgVolatility3y: null });
    expect(result.top10Concentration.status).toBe("higher");
    expect(result.volatility3y.status).toBe("insufficient-sample");
  });
  it.each([undefined, null, NaN, Infinity])("never substitutes a missing or invalid value: %s", (value) => {
    expect(interpretFund({ top10Concentration: value }, group).top10Concentration.status).toBe("unavailable");
  });
  it("rejects missing averages and preserves real zero", () => {
    expect(interpretFund(values(0), group).top10Concentration.status).toBe("lower");
    expect(interpretFund(values(0), { ...group, avgTop10Concentration: null }).top10Concentration.status).toBe("unavailable");
  });
  it("supports independent thresholds with versioned output", () => {
    const result = interpretFund(values(53), group, { ...interpretationThresholds, version: "test-2", top10Concentration: 2, volatility3y: 4 });
    expect(result.thresholdVersion).toBe("test-2");
    expect(result.thresholdStatus).toBe("trial");
    expect(result.top10Concentration.status).toBe("higher");
    expect(result.volatility3y.status).toBe("similar");
  });
  it.each([-1, NaN, Infinity])("rejects invalid configured thresholds: %s", (volatility3y) => {
    expect(() => interpretFund(values(50), group, { ...interpretationThresholds, volatility3y })).toThrow("Invalid interpretation threshold");
  });
});
