export const DEFAULT_RETURNS_GRACE_DAYS = 45;
// 每個基金類別自己嘅 fundOverviewGraceDays 已經按計劃財政年結日及法定基金概覽發布期限
// 算好（見 packages/coverage 的 fundOverviewGraceDaysFor），寫死喺發布 payload 入面。
// 呢個係冇財政年結日資料嘅舊快照先會用到嘅最後備援值。
export const DEFAULT_FUND_OVERVIEW_GRACE_DAYS = 45;

export type FreshnessPolicy = {
  returnsGraceDays?: number;
  fundOverviewGraceDays?: number;
  // 規則本身版本號；已發布快照凍住計算時嘅版本，規則改變不會回溯改寫舊批次。
  fundOverviewPolicyVersion?: number;
};

export type PublishedFreshness = {
  status: "verified" | "stale";
  dataAsOf: string;
  graceDays: number;
  ageDays: number | null;
};

const DAY_MS = 86_400_000;

export function evaluateFreshness(
  dataAsOf: string,
  graceDays: number,
  today: Date = new Date(),
): PublishedFreshness {
  const asOf = Date.parse(`${dataAsOf}T00:00:00Z`);
  if (!Number.isFinite(asOf)) {
    return { status: "stale", dataAsOf, graceDays, ageDays: null };
  }
  const midnight = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const ageDays = Math.floor((midnight - asOf) / DAY_MS);
  return {
    status: ageDays > graceDays ? "stale" : "verified",
    dataAsOf,
    graceDays,
    ageDays,
  };
}

export function returnsGraceDays(policy?: FreshnessPolicy) {
  return policy?.returnsGraceDays ?? DEFAULT_RETURNS_GRACE_DAYS;
}

export function fundOverviewGraceDays(policy?: FreshnessPolicy) {
  return policy?.fundOverviewGraceDays ?? DEFAULT_FUND_OVERVIEW_GRACE_DAYS;
}
