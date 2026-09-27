import type { MappedAllocation } from "./allocation-label-map";
import { pointInTimeAsOf, type FactSheetTemporalScopes } from "./fact-sheet-temporal";

/**
 * 每個發布快照凍結的比較組別平均值。網站只讀呢份，唔即場重算。
 *
 * 組別口徑必須同 `apps/api/src/comparison-group.ts` 一致：有 Lipper 分類就用它，
 * 否則以「平台分類：」前綴自成一組。
 */

export const COMPARISON_GROUP_STATS_MIN_SAMPLE = 3;
export const PLATFORM_GROUP_PREFIX = "平台分類：";

export type ComparisonGroupStatsFund = {
  fundClassId: string;
  verificationStatus?: string;
  lipperCategory?: string;
  fundType?: string;
  fundCategory?: string;
  unavailableFields?: string[];
  fundRiskIndicator?: number;
  mappedAllocation?: MappedAllocation;
  fundRiskAsOf?: string;
  factSheetDisclosure?: {
    unavailableFields?: string[];
    temporalScopes?: FactSheetTemporalScopes;
    topHoldings: { rank: number; percent?: number }[];
  };
};

export type AverageAllocation = {
  equity: number;
  bond: number;
  cashAndOther: number;
};

export type ComparisonGroupStatsRow = {
  comparisonGroup: string;
  avgAllocation: AverageAllocation | null;
  avgTop10Concentration: number | null;
  avgVolatility3y: number | null;
  fundCount: number;
  allocationCount: number;
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
  allocation: MetricSampleDates;
  top10Concentration: MetricSampleDates;
  volatility3y: MetricSampleDates;
};

export function comparisonGroupNameFor(fund: {
  lipperCategory?: string;
  fundType?: string;
  fundCategory?: string;
}): string {
  const lipper = fund.lipperCategory?.trim();
  if (lipper) return lipper;
  const platform = fund.fundType?.trim() || fund.fundCategory?.trim() || "未分類";
  return `${PLATFORM_GROUP_PREFIX}${platform}`;
}

export function buildComparisonGroupStats(
  funds: ComparisonGroupStatsFund[],
): ComparisonGroupStatsRowWithSourceDates[] {
  const groups = new Map<string, ComparisonGroupStatsFund[]>();
  for (const fund of funds) {
    if (fund.verificationStatus !== "verified") continue;
    const name = comparisonGroupNameFor(fund);
    const members = groups.get(name);
    if (members) members.push(fund);
    else groups.set(name, [fund]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([comparisonGroup, members]) => {
      const allocations = members.flatMap((fund) => {
        const buckets = allocationBuckets(fund);
        return buckets ? [{ buckets, asOf: fund.mappedAllocation?.asOf }] : [];
      });
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
        avgAllocation: averageAllocation(
          allocations.map((sample) => sample.buckets),
          insufficientSample,
        ),
        avgTop10Concentration: averageMetric(
          concentrations.map((sample) => sample.value),
          insufficientSample,
        ),
        avgVolatility3y: averageMetric(
          volatilities.map((sample) => sample.value),
          insufficientSample,
        ),
        fundCount: members.length,
        allocationCount: allocations.length,
        top10Count: concentrations.length,
        volatilityCount: volatilities.length,
        insufficientSample,
        sourceDates: {
          allocation: sampleDates(allocations.map((sample) => sample.asOf)),
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

function allocationBuckets(
  fund: ComparisonGroupStatsFund,
): AverageAllocation | undefined {
  const mapped = fund.mappedAllocation;
  if (!mapped || "unavailable" in mapped) return undefined;
  const { equity, bond, cashAndOther } = mapped.buckets;
  if (![equity, bond, cashAndOther].every(isFiniteNumber)) return undefined;
  return { equity, bond, cashAndOther };
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

function averageAllocation(
  values: AverageAllocation[],
  insufficientSample: boolean,
): AverageAllocation | null {
  if (insufficientSample || values.length < COMPARISON_GROUP_STATS_MIN_SAMPLE) {
    return null;
  }
  return {
    equity: roundAverage(values.map((value) => value.equity)),
    bond: roundAverage(values.map((value) => value.bond)),
    cashAndOther: roundAverage(values.map((value) => value.cashAndOther)),
  };
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
