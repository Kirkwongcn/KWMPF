import {
  evaluateFreshness,
  returnGraceDaysForPeriod,
  type FreshnessPolicy,
} from "./freshness";

type QualityFund = {
  fundClass: {
    id?: string;
    schemeName: string;
    verificationStatus: string;
    annualizedReturn1y?: number;
    annualizedReturn3y?: number;
    annualizedReturn5y?: number;
    annualizedReturn10y?: number;
    dataAsOf?: string;
    returnsAsOf?: string;
    returnSources?: Record<string, { dataAsOf: string; sourceUrl: string }>;
  };
  provenance?: {
    dataAsOf?: string;
    retrievedAt?: string;
    verificationStatus?: string;
    freshnessPolicy?: FreshnessPolicy;
  };
};

const periods = [
  [1, "annualizedReturn1y"],
  [3, "annualizedReturn3y"],
  [5, "annualizedReturn5y"],
  [10, "annualizedReturn10y"],
] as const;

export function buildDataQuality(
  funds: QualityFund[],
  snapshotId: string | null,
  today = new Date(),
) {
  const evaluatedOn = today.toISOString().slice(0, 10);
  const returns = periods.map(([periodYears, field]) => {
    let eligible = 0,
      stale = 0,
      missing = 0,
      unverified = 0;
    const dates: string[] = [];
    for (const published of funds) {
      if (
        published.fundClass.verificationStatus !== "verified" ||
        published.provenance?.verificationStatus !== "verified"
      ) {
        unverified++;
        continue;
      }
      const value = published.fundClass[field];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        missing++;
        continue;
      }
      const asOf =
        published.fundClass.returnSources?.[String(periodYears)]?.dataAsOf ??
        published.fundClass.returnsAsOf ??
        published.provenance?.dataAsOf ??
        published.fundClass.dataAsOf ??
        "";
      const freshness = evaluateFreshness(
        asOf,
        returnGraceDaysForPeriod(
          published.provenance?.freshnessPolicy,
          periodYears,
        ),
        today,
      );
      if (freshness.status === "verified") eligible++;
      else stale++;
      if (freshness.ageDays !== null) dates.push(asOf);
    }
    dates.sort();
    return {
      periodYears,
      eligible,
      stale,
      missing,
      unverified,
      total: funds.length,
      dataAsOf: dates.length
        ? { earliest: dates[0], latest: dates[dates.length - 1] }
        : null,
    };
  });
  const retrieved = funds
    .map((f) => f.provenance?.retrievedAt)
    .filter((d): d is string => typeof d === "string")
    .sort();
  return {
    snapshotId,
    evaluatedOn,
    evaluationTimezone: "UTC",
    fundClassCount: funds.length,
    retrievedAt: retrieved.at(-1) ?? null,
    returns,
    methodology:
      "按每個基金類別、每個期間的官方截至日期及已發布 freshness policy 評估；可用不代表基金較佳，不同組別不可合併排名。",
  };
}
