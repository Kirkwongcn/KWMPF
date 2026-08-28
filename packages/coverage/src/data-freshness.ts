import type { SourceRecord } from "./build-coverage";

export type FreshnessStatus = "verified" | "stale" | "failed_with_last_verified";

export const MONTHLY_GRACE_DAYS = 45;
// 規格的 30 日是由每個計劃的法定基金概覽披露期限起算，但現時唯一來源是每月一次的官方
// 基金平台，只帶得出月結截至日期。由月結日起算 30 日會令風險級別及費用在下一輪官方
// 資料發布之前約兩星期就轉為 stale，並把整個費用及風險排名清空。在收集到各計劃財政
// 年結日之前，先與月度週期看齊。
export const FUND_OVERVIEW_GRACE_DAYS = 45;
export const CURRENT_STATUS_GRACE_DAYS = 7;

export type FreshnessPolicy = {
  kind: "monthly" | "current_status" | "fund_overview";
  asOf: string;
  today: string;
  graceDays?: number;
};

function daysBetween(start: string, end: string) {
  const normalizedStart = /^\d{4}-\d{2}$/.test(start)
    ? `${start}-${new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)), 0)).getUTCDate().toString().padStart(2, "0")}`
    : start;
  const startTime = Date.parse(`${normalizedStart}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    throw new Error(`freshness dates must be ISO calendar dates: ${start} -> ${normalizedStart}, ${end}`);
  }
  return Math.floor((endTime - startTime) / 86_400_000);
}

export function classifyFreshness(policy: FreshnessPolicy): FreshnessStatus {
  const age = daysBetween(policy.asOf, policy.today);
  if (age < 0) throw new Error("data date cannot be in the future");
  if (policy.kind === "current_status")
    return age > CURRENT_STATUS_GRACE_DAYS ? "stale" : "verified";
  const graceDays =
    policy.graceDays ??
    (policy.kind === "monthly" ? MONTHLY_GRACE_DAYS : FUND_OVERVIEW_GRACE_DAYS);
  return age > graceDays ? "stale" : "verified";
}

export function applyFreshnessStatuses<T extends SourceRecord>(
  records: T[],
  today: string,
): Array<
  Omit<T, "returns"> & {
    currentStatus: FreshnessStatus;
    fundOverviewStatus?: FreshnessStatus;
    returns?: SourceRecord["returns"];
  }
> {
  return records.map((record) => ({
    ...record,
    currentStatus: classifyFreshness({ kind: "current_status", asOf: record.dataAsOf, today }),
    ...(record.fundOverview
      ? { fundOverviewStatus: classifyFreshness({ kind: "fund_overview", asOf: record.dataAsOf, today }) }
      : {}),
    ...(record.returns
      ? {
          returns: Object.fromEntries(
            Object.entries(record.returns).map(([period, observation]) => [
              period,
              { ...observation, status: classifyFreshness({ kind: "monthly", asOf: observation!.dataAsOf, today }) },
            ]),
          ) as SourceRecord["returns"],
        }
      : {}),
  })) as Array<
    Omit<T, "returns"> & {
      currentStatus: FreshnessStatus;
      fundOverviewStatus?: FreshnessStatus;
      returns?: SourceRecord["returns"];
    }
  >;
}

export type FailedField = {
  fundClassId: string;
  field: "returns" | "current" | "fundOverview";
};

export function carryForwardFailedFields(
  current: SourceRecord[],
  previous: SourceRecord[],
  failures: FailedField[],
) {
  const previousById = new Map(previous.map((record) => [record.fundClassId, record]));
  const failed = new Set(failures.map((failure) => `${failure.fundClassId}\u0000${failure.field}`));
  return current.map((record) => {
    const old = previousById.get(record.fundClassId);
    if (!old) return record;
    const next = { ...record };
    if (failed.has(`${record.fundClassId}\u0000returns`) && old.returns) {
      next.returns = Object.fromEntries(
        Object.entries(old.returns).map(([period, observation]) => [period, { ...observation, status: "failed_with_last_verified" }]),
      ) as SourceRecord["returns"];
    }
    if (failed.has(`${record.fundClassId}\u0000current`)) {
      next.current = old.current;
      next.currentStatus = "failed_with_last_verified";
    }
    if (failed.has(`${record.fundClassId}\u0000fundOverview`) && old.fundOverview) {
      next.fundOverview = { ...old.fundOverview };
      next.fundOverviewStatus = "failed_with_last_verified";
    }
    return next;
  });
}
