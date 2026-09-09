import { describe, expect, it } from "vitest";
import { interpretFund } from "../src/fund-interpretation";
import type { ComparisonGroupStatsRow } from "../src/comparison-group-stats";
import { interpretationThresholds } from "../src/interpretation-thresholds";

const group: ComparisonGroupStatsRow = {
  comparisonGroup: "test", avgAllocation: { equity: 50, bond: 40, cashAndOther: 10 },
  avgTop10Concentration: 50, avgVolatility3y: 50, fundCount: 3,
  allocationCount: 3, top10Count: 3, volatilityCount: 3, insufficientSample: false,
};
const values = (value: number) => ({ equity: value, top10Concentration: value, volatility3y: value });

describe("fund interpretation", () => {
  it.each([[47.99, "lower"], [48, "similar"], [50, "similar"], [52, "similar"], [52.01, "higher"]])("classifies %s independently for all factors", (value, status) => {
    const result = interpretFund(values(Number(value)), group);
    for (const factor of [result.equity, result.top10Concentration, result.volatility3y]) expect(factor.status).toBe(status);
  });
  it("prints neutral Chinese wording and editorial attribution", () => {
    const result = interpretFund({ equity: 53, top10Concentration: 47, volatility3y: 51 }, group);
    expect(result.equity.text).toBe("股票配置（編輯歸類，非官方分類） 53%，比同組別平均高 3 個百分點。");
    expect(result.top10Concentration.text).toBe("十大持倉佔比 47%，比同組別平均低 3 個百分點。");
    expect(result.volatility3y.text).toBe("3年波幅 51%，與同組別平均相若。");
  });
  it("does not round a just-outside value into similar", () => {
    expect(interpretFund(values(52.001), group).equity.status).toBe("higher");
  });
  it("accepts a decimal boundary despite floating point subtraction", () => {
    expect(interpretFund(values(4.1), { ...group, avgVolatility3y: 2.1 }).volatility3y.status).toBe("similar");
  });
  it("suppresses all conclusions for an insufficient group", () => {
    for (const overrides of [{ insufficientSample: true }, { fundCount: 2 }]) {
      const result = interpretFund(values(60), { ...group, ...overrides });
      expect(result.equity.status).toBe("insufficient-sample");
      expect(result.top10Concentration.status).toBe("insufficient-sample");
      expect(result.volatility3y.text).toContain("同組別樣本不足，未能比較");
    }
  });
  it("suppresses only the metric with fewer than three observations", () => {
    const result = interpretFund(values(60), { ...group, volatilityCount: 2, avgVolatility3y: null });
    expect(result.equity.status).toBe("higher");
    expect(result.volatility3y.status).toBe("insufficient-sample");
  });
  it.each([undefined, null, NaN, Infinity])("never substitutes a missing or invalid value: %s", (value) => {
    expect(interpretFund({ equity: value }, group).equity.status).toBe("unavailable");
  });
  it("rejects missing averages and preserves real zero", () => {
    expect(interpretFund(values(0), group).equity.status).toBe("lower");
    expect(interpretFund(values(0), { ...group, avgAllocation: null }).equity.status).toBe("unavailable");
  });
  it("supports independent thresholds with versioned output", () => {
    const result = interpretFund(values(53), group, { ...interpretationThresholds, version: "test-2", equity: 3, volatility3y: 4 });
    expect(result.thresholdVersion).toBe("test-2");
    expect(result.thresholdStatus).toBe("trial");
    expect(result.equity.status).toBe("similar");
    expect(result.top10Concentration.status).toBe("higher");
    expect(result.volatility3y.status).toBe("similar");
  });
  it.each([-1, NaN, Infinity])("rejects invalid configured thresholds: %s", (equity) => {
    expect(() => interpretFund(values(50), group, { ...interpretationThresholds, equity })).toThrow("Invalid interpretation threshold");
  });
});
