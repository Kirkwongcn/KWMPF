import { pointInTimeAsOf, type FactSheetTemporalScopes } from "./fact-sheet-temporal";
import { mpfaFundTypeOf } from "./mpfa-fund-type";

/**
 * 每個發布快照凍結的比較組別平均值。網站只讀呢份，唔即場重算。
 *
 * 組別只用積金局基金類型（ADR 0011），組名係積金局中文基金類型原文，必須同
 * `apps/api/src/comparison-group.ts` 一致。冇積金局基金類型的基金唔入任何組別。
 * 平均值由本站按官方原值計算；唔再有三桶資產配置平均。
 */

export const COMPARISON_GROUP_STATS_MIN_SAMPLE = 3;

export type ComparisonGroupStatsFund = {
  fundClassId: string;
  verificationStatus?: string;
  fundType?: string;
  unavailableFields?: string[];
  fundRiskIndicator?: number;
  fundRiskAsOf?: string;
  factSheetDisclosure?: {
    unavailableFields?: string[];
    temporalScopes?: FactSheetTemporalScopes;
    topHoldings: { rank: number; percent?: number }[];
  };
};

export type ComparisonGroupStatsRow = {
  comparisonGroup: string;
  avgTop10Concentration: number | null;
  avgVolatility3y: number | null;
  fundCount: number;
  top10Count: number;
  volatilityCount: number;
  insufficientSample: boolean;
  sourceDates?: ComparisonGroupSourceDates;
};

export type ComparisonGroupStatsRowWithSourceDates = Omit<
  ComparisonGroupStatsRow,
  "sourceDates"
> & { sourceDates: ComparisonGroupSourceDates };

export type MetricSampleDates = {
  from: string | null;
  to: string | null;
  undatedCount: number;
};

export type ComparisonGroupSourceDates = {
  top10Concentration: MetricSampleDates;
  volatility3y: MetricSampleDates;
};

/** 積金局中文基金類型；冇或者唔喺官方清單就回傳 undefined。 */
export function comparisonGroupNameFor(fund: { fundType?: string }): string | undefined {
  return mpfaFundTypeOf(fund.fundType)?.zh;
}

export function buildComparisonGroupStats(
  funds: ComparisonGroupStatsFund[],
): ComparisonGroupStatsRowWithSourceDates[] {
  const groups = new Map<string, ComparisonGroupStatsFund[]>();
  for (const fund of funds) {
    if (fund.verificationStatus !== "verified") continue;
    const name = comparisonGroupNameFor(fund);
    if (!name) continue;
    const members = groups.get(name);
    if (members) members.push(fund);
    else groups.set(name, [fund]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([comparisonGroup, members]) => {
      const concentrations = members.flatMap((fund) => {
        const value = top10Concentration(fund);
        return value === undefined
          ? []
          : [
              {
                value,
                asOf: pointInTimeAsOf(
                  fund.factSheetDisclosure?.temporalScopes?.topHoldings,
                ),
              },
            ];
      });
      const volatilities = members.flatMap((fund) => {
        const value = volatility3y(fund);
        return value === undefined
          ? []
          : [{ value, asOf: fund.fundRiskAsOf }];
      });
      const insufficientSample = members.length < COMPARISON_GROUP_STATS_MIN_SAMPLE;
      return {
        comparisonGroup,
        avgTop10Concentration: averageMetric(
          concentrations.map((sample) => sample.value),
          insufficientSample,
        ),
        avgVolatility3y: averageMetric(
          volatilities.map((sample) => sample.value),
          insufficientSample,
        ),
        fundCount: members.length,
        top10Count: concentrations.length,
        volatilityCount: volatilities.length,
        insufficientSample,
        sourceDates: {
          top10Concentration: sampleDates(
            concentrations.map((sample) => sample.asOf),
          ),
          volatility3y: sampleDates(volatilities.map((sample) => sample.asOf)),
        },
      };
    });
}

function sampleDates(values: Array<string | undefined>): MetricSampleDates {
  const dates = values.flatMap((value) => {
    if (value === undefined || value === "") return [];
    if (!isIsoDate(value)) throw new Error(`Invalid source date: ${value}`);
    return [value];
  });
  dates.sort();
  return {
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
    undatedCount: values.length - dates.length,
  };
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function top10Concentration(fund: ComparisonGroupStatsFund): number | undefined {
  const disclosure = fund.factSheetDisclosure;
  if (!disclosure) return undefined;
  if (disclosure.unavailableFields?.includes("topHoldings")) return undefined;
  if (disclosure.topHoldings.length === 0) return undefined;
  let total = 0;
  for (const holding of disclosure.topHoldings) {
    if (!isFiniteNumber(holding.percent)) return undefined;
    total += holding.percent;
  }
  return total;
}

function volatility3y(fund: ComparisonGroupStatsFund): number | undefined {
  if (fund.unavailableFields?.includes("fundRiskIndicator")) return undefined;
  return isFiniteNumber(fund.fundRiskIndicator) ? fund.fundRiskIndicator : undefined;
}

function averageMetric(values: number[], insufficientSample: boolean): number | null {
  if (insufficientSample || values.length < COMPARISON_GROUP_STATS_MIN_SAMPLE) {
    return null;
  }
  return roundAverage(values);
}

function roundAverage(values: number[]): number {
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
