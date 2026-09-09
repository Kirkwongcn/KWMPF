import {
  COMPARISON_GROUP_STATS_MIN_SAMPLE,
  type ComparisonGroupStatsRow,
} from "./comparison-group-stats";
import { interpretationThresholds } from "./interpretation-thresholds";

export type InterpretationValues = {
  equity?: number | null;
  top10Concentration?: number | null;
  volatility3y?: number | null;
};
export type InterpretationThresholds = {
  version: string;
  status: string;
  equity: number;
  top10Concentration: number;
  volatility3y: number;
};
export type FactorInterpretation = {
  status: "higher" | "lower" | "similar" | "insufficient-sample" | "unavailable";
  text: string;
};

export function interpretFund(
  values: InterpretationValues,
  group: ComparisonGroupStatsRow,
  thresholds: InterpretationThresholds = interpretationThresholds,
) {
  for (const value of [thresholds.equity, thresholds.top10Concentration, thresholds.volatility3y]) {
    if (!Number.isFinite(value) || value < 0) throw new Error("Invalid interpretation threshold");
  }
  function factor(
    label: string,
    value: number | null | undefined,
    average: number | null,
    count: number,
    threshold: number,
  ): FactorInterpretation {
    if (group.insufficientSample || group.fundCount < COMPARISON_GROUP_STATS_MIN_SAMPLE || count < COMPARISON_GROUP_STATS_MIN_SAMPLE) {
      return { status: "insufficient-sample", text: `${label}：同組別樣本不足，未能比較。` };
    }
    if (value == null || !Number.isFinite(value) || average == null || !Number.isFinite(average)) {
      return { status: "unavailable", text: `${label}：資料不足，未能比較。` };
    }
    const difference = value - average;
    const distance = Math.abs(difference);
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(average)) * 4;
    if (distance <= threshold + tolerance) {
      return { status: "similar", text: `${label} ${value}%，與同組別平均相若。` };
    }
    const status = difference > 0 ? "higher" : "lower";
    const displayed = Number(distance.toFixed(2));
    const gap = displayed === 0 ? "不足 0.01" : `${displayed}`;
    return { status, text: `${label} ${value}%，比同組別平均${status === "higher" ? "高" : "低"} ${gap} 個百分點。` };
  }
  return {
    thresholdVersion: thresholds.version,
    thresholdStatus: thresholds.status,
    equity: factor("股票配置（編輯歸類，非官方分類）", values.equity, group.avgAllocation?.equity ?? null, group.allocationCount, thresholds.equity),
    top10Concentration: factor("十大持倉佔比", values.top10Concentration, group.avgTop10Concentration, group.top10Count, thresholds.top10Concentration),
    volatility3y: factor("3年波幅", values.volatility3y, group.avgVolatility3y, group.volatilityCount, thresholds.volatility3y),
  };
}
