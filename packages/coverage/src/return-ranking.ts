export const DEFAULT_RETURN_PERIODS = [1, 3, 5, 10] as const;
export type ReturnPeriod = (typeof DEFAULT_RETURN_PERIODS)[number];

export type RankingExclusionReason =
  | "insufficient"
  | "stale"
  | "pending_verification"
  | "source_conflict"
  | "not_comparable";

export type ReturnObservation = {
  value: number;
  dataAsOf: string;
  stale?: boolean;
  comparable?: boolean;
};

export type ReturnRankingFund = {
  fundClassId: string;
  fundClassName: string;
  comparisonGroup: string;
  verificationStatus: "verified" | "pending_verification" | "source_conflict";
  returns: Partial<Record<ReturnPeriod, ReturnObservation>>;
};

export type ReturnRankingRow = {
  fundClassId: string;
  fundClassName: string;
  comparisonGroup: string;
  periodYears: ReturnPeriod;
  value: number;
  displayValue: string;
  rank: number;
  dataAsOf: string;
  metric: "annualized_return";
  sortDirection: "descending";
};

export type ReturnRankingExclusion = {
  fundClassId: string;
  fundClassName: string;
  comparisonGroup: string;
  periodYears: ReturnPeriod;
  reason: RankingExclusionReason;
};

export type ReturnRankingResult = {
  periods: readonly ReturnPeriod[];
  methodology: {
    metric: "annualized_return";
    sortDirection: "descending";
    displayPrecision: 2;
    grouping: "comparison_group";
  };
  rankings: ReturnRankingRow[];
  exclusions: ReturnRankingExclusion[];
};

function exclusionReason(fund: ReturnRankingFund, observation?: ReturnObservation): RankingExclusionReason | undefined {
  if (!observation) return "insufficient";
  if (fund.verificationStatus === "pending_verification") return "pending_verification";
  if (fund.verificationStatus === "source_conflict") return "source_conflict";
  if (observation.stale) return "stale";
  if (observation.comparable === false) return "not_comparable";
  if (!Number.isFinite(observation.value)) return "insufficient";
  return undefined;
}

export function rankDefaultReturns(funds: ReturnRankingFund[]): ReturnRankingResult {
  const rankings: ReturnRankingRow[] = [];
  const exclusions: ReturnRankingExclusion[] = [];

  for (const periodYears of DEFAULT_RETURN_PERIODS) {
    const eligible = funds.flatMap((fund) => {
      const observation = fund.returns[periodYears];
      const reason = exclusionReason(fund, observation);
      if (reason) {
        exclusions.push({ fundClassId: fund.fundClassId, fundClassName: fund.fundClassName, comparisonGroup: fund.comparisonGroup, periodYears, reason });
        return [];
      }
      return [{ fund, observation: observation! }];
    });

    const groups = new Map<string, typeof eligible>();
    for (const item of eligible) groups.set(item.fund.comparisonGroup, [...(groups.get(item.fund.comparisonGroup) ?? []), item]);
    for (const [comparisonGroup, group] of groups) {
      const sorted = group.sort((a, b) => Number(b.observation.value.toFixed(2)) - Number(a.observation.value.toFixed(2)));
      let previousDisplayValue: number | undefined;
      let previousRank = 0;
      sorted.forEach(({ fund, observation }, index) => {
        const displayValue = observation.value.toFixed(2);
        const displayNumber = Number(displayValue);
        const rank = displayNumber === previousDisplayValue ? previousRank : index + 1;
        previousDisplayValue = displayNumber;
        previousRank = rank;
        rankings.push({ fundClassId: fund.fundClassId, fundClassName: fund.fundClassName, comparisonGroup, periodYears, value: observation.value, displayValue: `${displayValue}%`, rank, dataAsOf: observation.dataAsOf, metric: "annualized_return", sortDirection: "descending" });
      });
    }
  }

  rankings.sort((a, b) => a.periodYears - b.periodYears || a.comparisonGroup.localeCompare(b.comparisonGroup) || a.rank - b.rank || a.fundClassId.localeCompare(b.fundClassId));
  return { periods: DEFAULT_RETURN_PERIODS, methodology: { metric: "annualized_return", sortDirection: "descending", displayPrecision: 2, grouping: "comparison_group" }, rankings, exclusions };
}
