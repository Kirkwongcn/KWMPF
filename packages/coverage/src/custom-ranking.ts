export type MonthlyPrice = { month: string; unitPrice: number };

export type CustomReturnFund = {
  fundClassId: string;
  fundClassName: string;
  comparisonGroup: string;
  prices: MonthlyPrice[];
};

export type VolatilityFund = {
  fundClassId: string;
  fundClassName: string;
  comparisonGroup: string;
  monthlyReturns: Array<{ month: string; value: number }>;
};

export type CustomReturnRow = {
  fundClassId: string;
  fundClassName: string;
  comparisonGroup: string;
  startMonth: string;
  endMonth: string;
  cumulativeReturn: number;
  displayValue: string;
};

export type RankingExclusion = {
  fundClassId: string;
  fundClassName: string;
  comparisonGroup: string;
  reason: "missing_endpoint" | "less_than_12_months" | "incomplete_month" | "missing_month";
};

export type VolatilityRow = {
  fundClassId: string;
  fundClassName: string;
  comparisonGroup: string;
  annualizedVolatility: number;
  displayValue: string;
  rank: number;
  direction: "low_to_high" | "high_to_low";
};

function monthPattern(month: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

function monthIndex(month: string) {
  const [year = 0, value = 0] = month.split("-").map(Number);
  return year * 12 + value;
}

function completeMonths(startMonth: string, endMonth: string) {
  if (!monthPattern(startMonth) || !monthPattern(endMonth)) return -1;
  return monthIndex(endMonth) - monthIndex(startMonth);
}

export function calculateCustomReturns(funds: CustomReturnFund[], startMonth: string, endMonth: string) {
  const months = completeMonths(startMonth, endMonth);
  const rows: CustomReturnRow[] = [];
  const exclusions: RankingExclusion[] = [];
  for (const fund of funds) {
    const start = fund.prices.find((price) => price.month === startMonth);
    const end = fund.prices.find((price) => price.month === endMonth);
    const reason = !monthPattern(startMonth) || !monthPattern(endMonth) ? "incomplete_month" : months < 12 ? "less_than_12_months" : !start || !end ? "missing_endpoint" : undefined;
    if (reason) {
      exclusions.push({ fundClassId: fund.fundClassId, fundClassName: fund.fundClassName, comparisonGroup: fund.comparisonGroup, reason });
      continue;
    }
    const cumulativeReturn = Number(((end!.unitPrice / start!.unitPrice - 1) * 100).toFixed(2));
    rows.push({ fundClassId: fund.fundClassId, fundClassName: fund.fundClassName, comparisonGroup: fund.comparisonGroup, startMonth, endMonth, cumulativeReturn, displayValue: `${cumulativeReturn.toFixed(2)}%` });
  }
  rows.sort((a, b) => a.comparisonGroup.localeCompare(b.comparisonGroup) || b.cumulativeReturn - a.cumulativeReturn || a.fundClassId.localeCompare(b.fundClassId));
  return { rows, exclusions, annualized: false as const };
}

function standardDeviation(values: number[]) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

function hasConsecutiveMonths(months: string[]) {
  const sorted = months.toSorted();
  return sorted.every((month, index) => index === 0 || monthIndex(month) === monthIndex(sorted[index - 1]!) + 1);
}

export function rankLowerVolatility(funds: VolatilityFund[], direction: "low_to_high" | "high_to_low" = "low_to_high") {
  const rows: VolatilityRow[] = [];
  const exclusions: Array<{ fundClassId: string; reason: "missing_month" }> = [];
  for (const fund of funds) {
    if (fund.monthlyReturns.length !== 36 || new Set(fund.monthlyReturns.map((item) => item.month)).size !== 36 || !hasConsecutiveMonths(fund.monthlyReturns.map((item) => item.month))) {
      exclusions.push({ fundClassId: fund.fundClassId, reason: "missing_month" });
      continue;
    }
    const annualizedVolatility = standardDeviation(fund.monthlyReturns.map((item) => item.value)) * Math.sqrt(12) * 100;
    rows.push({ fundClassId: fund.fundClassId, fundClassName: fund.fundClassName, comparisonGroup: fund.comparisonGroup, annualizedVolatility, displayValue: `${annualizedVolatility.toFixed(2)}%`, rank: 0, direction });
  }
  rows.sort((a, b) => (direction === "low_to_high" ? a.annualizedVolatility - b.annualizedVolatility : b.annualizedVolatility - a.annualizedVolatility) || a.fundClassId.localeCompare(b.fundClassId));
  rows.forEach((row, index) => { row.rank = index + 1; });
  return { rows, exclusions, label: "較低波幅排序" as const, annualized: true as const };
}
