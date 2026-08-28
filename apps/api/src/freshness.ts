export const DEFAULT_RETURNS_GRACE_DAYS = 45;
// 與 packages/coverage 的 FUND_OVERVIEW_GRACE_DAYS 一致；只在已發布資料沒有帶出
// freshnessPolicy 時才會用到這個預設值。
export const DEFAULT_FUND_OVERVIEW_GRACE_DAYS = 45;

export type FreshnessPolicy = {
  returnsGraceDays?: number;
  fundOverviewGraceDays?: number;
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
