import type { SourceRecord } from "./build-coverage";

export type FreshnessStatus = "verified" | "stale" | "failed_with_last_verified";

export const MONTHLY_GRACE_DAYS = 45;
export const CURRENT_STATUS_GRACE_DAYS = 7;

// 版本號寫入發布 payload；規則本身改變只影響之後新建的批次，已發布快照凍住舊版本號
// 計出嚟嘅寬限日數，不會被回溯改寫（見 docs/adr/0006-fund-overview-freshness-by-fiscal-period.md）。
export const FUND_OVERVIEW_POLICY_VERSION = 1;

// 《強積金投資基金披露守則》D3.1–D3.4：受託人每個財政期須發兩份基金便覽——一份「截至
// 財政期終結日」，連同週年權益報表喺財政期終結後三個月內發出（D3.3，引用《強積金計劃
// 規例》第 56(1) 條權益報表期限）；另一份「截至財政期終結後六個月」，須喺該匯報日起
// 兩個月內分發（D3.4）。持倉、資產配置、風險及 FER 依賴呢兩份便覽，所以邊一個法定期限
// 適用要睇資料截至日最近一份係邊份。查證見 docs/research/2026-09-10-fund-fact-sheet-
// publication-deadline.md。
export const FIRST_FUND_FACT_SHEET_DEADLINE_MONTHS = 3;
export const SECOND_FUND_FACT_SHEET_DEADLINE_MONTHS = 2;
export const FUND_OVERVIEW_STATUTORY_GRACE_DAYS = 30;
// 冇財政年結日（例如舊快照未帶呢個欄位）先退回呢個保守值，同月度週期睇齊。
export const FUND_OVERVIEW_FALLBACK_GRACE_DAYS = 45;

export type FreshnessPolicy = {
  kind: "monthly" | "current_status" | "fund_overview";
  asOf: string;
  today: string;
  graceDays?: number;
  // 計劃財政期終結日，月日格式（例如 `11-30`），只喺 kind 為 `fund_overview` 時用到。
  financialPeriodEndDate?: string;
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

function daysInMonth(year: number, month1to12: number) {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

// 加月分要遷就月尾（例如 30 Nov + 6 個月 = 30 May，唔可以溢位去 31 May 之後嗰個月）。
function addMonthsClamped(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  const total = month - 1 + months;
  const targetYear = year + Math.floor(total / 12);
  const targetMonth = (((total % 12) + 12) % 12) + 1;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

type FundFactSheetMilestone = { date: string; deadlineMonths: number };

function fundFactSheetMilestones(
  financialPeriodEndDate: string,
  year: number,
): FundFactSheetMilestone[] {
  const periodEnd = `${year}-${financialPeriodEndDate}`;
  return [
    { date: periodEnd, deadlineMonths: FIRST_FUND_FACT_SHEET_DEADLINE_MONTHS },
    {
      date: addMonthsClamped(periodEnd, 6),
      deadlineMonths: SECOND_FUND_FACT_SHEET_DEADLINE_MONTHS,
    },
  ];
}

// 揀返資料截至日之前最近嗰一份基金便覽嘅匯報日，先知道套邊個法定期限（3 個月定 2 個月）。
function latestFundFactSheetMilestone(
  financialPeriodEndDate: string,
  asOf: string,
): FundFactSheetMilestone {
  const asOfYear = Number(asOf.slice(0, 4));
  const candidates = [asOfYear - 1, asOfYear, asOfYear + 1]
    .flatMap((year) => fundFactSheetMilestones(financialPeriodEndDate, year))
    .filter((milestone) => milestone.date <= asOf);
  return candidates.reduce((latest, candidate) =>
    candidate.date > latest.date ? candidate : latest,
  );
}

// 逐個基金類別計返「法定基金概覽發布期限 + 30 日規格寬限」摺埋做一個寬限日數，
// 套落原有以 asOf 起計嘅 age-based 判斷（見 classifyFreshness）。
export function fundOverviewGraceDaysFor(
  financialPeriodEndDate: string | undefined,
  asOf: string,
): number {
  if (!financialPeriodEndDate) return FUND_OVERVIEW_FALLBACK_GRACE_DAYS;
  const milestone = latestFundFactSheetMilestone(financialPeriodEndDate, asOf);
  const deadline = addMonthsClamped(milestone.date, milestone.deadlineMonths);
  return daysBetween(milestone.date, deadline) + FUND_OVERVIEW_STATUTORY_GRACE_DAYS;
}

export function classifyFreshness(policy: FreshnessPolicy): FreshnessStatus {
  const age = daysBetween(policy.asOf, policy.today);
  if (age < 0) throw new Error("data date cannot be in the future");
  if (policy.kind === "current_status")
    return age > CURRENT_STATUS_GRACE_DAYS ? "stale" : "verified";
  const graceDays =
    policy.graceDays ??
    (policy.kind === "monthly"
      ? MONTHLY_GRACE_DAYS
      : fundOverviewGraceDaysFor(policy.financialPeriodEndDate, policy.asOf));
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
      ? {
          fundOverviewStatus: classifyFreshness({
            kind: "fund_overview",
            asOf: record.dataAsOf,
            today,
            financialPeriodEndDate: record.financialPeriodEndDate,
          }),
        }
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
