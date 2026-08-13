import type { SourceRecord } from "./build-coverage";

export type FreshnessStatus = "verified" | "stale" | "failed_with_last_verified";

export type FreshnessPolicy = {
  kind: "monthly" | "current_status" | "fund_overview";
  asOf: string;
  today: string;
  graceDays?: number;
};

function daysBetween(start: string, end: string) {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    throw new Error("freshness dates must be ISO calendar dates");
  }
  return Math.floor((endTime - startTime) / 86_400_000);
}

export function classifyFreshness(policy: FreshnessPolicy): FreshnessStatus {
  const age = daysBetween(policy.asOf, policy.today);
  if (age < 0) throw new Error("data date cannot be in the future");
  if (policy.kind === "current_status") return age > 7 ? "stale" : "verified";
  const graceDays = policy.graceDays ?? (policy.kind === "monthly" ? 45 : 30);
  return age > graceDays ? "stale" : "verified";
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
    if (failed.has(`${record.fundClassId}\u0000current`)) next.current = old.current;
    if (failed.has(`${record.fundClassId}\u0000fundOverview`) && old.fundOverview) {
      next.fundOverview = { ...old.fundOverview };
    }
    return next;
  });
}
