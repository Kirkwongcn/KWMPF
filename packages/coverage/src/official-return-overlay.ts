import type { SourceRecord } from "./build-coverage";
import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

export type OfficialReturnObservation = {
  fundClassId: string;
  periodYears: 1 | 3 | 5 | 10;
  annualized: number;
  dataAsOf: string;
  sourceUrl: string;
  retrievedAt: string;
};

// 受託人官方披露的「累積回報」（ADR 0014）。同年率化分開存放、分開比較，
// 唔會換算做年率化，亦唔會入年率化排名。
export type OfficialCumulativeReturnObservation = {
  fundClassId: string;
  periodYears: 3;
  basis: "cumulative";
  /** `null` 代表官方印「-」：官方未提供，唔當 0（紅線 2）。 */
  cumulative: number | null;
  /** 官方印出的原文（例如 "9.20" 或 "-"），顯示時照用，唔補 0、唔四捨五入。 */
  printed: string;
  dataAsOf: string;
  sourceUrl: string;
  retrievedAt: string;
  sourceSha256: string;
};

export type CumulativeReturnOverlayResult = {
  records: SourceRecord[];
  applied: OfficialCumulativeReturnObservation[];
  unmatched: OfficialCumulativeReturnObservation[];
  conflicts: OfficialCumulativeReturnObservation[];
};

/**
 * 候選檔同時載年率化（冇 basis）同累積（basis: "cumulative"）兩類紀錄。
 * 舊檔只得年率化，原樣歸入 annualized。
 */
export function splitReturnObservations(rows: unknown[]): {
  annualized: OfficialReturnObservation[];
  cumulative: OfficialCumulativeReturnObservation[];
} {
  const annualized: OfficialReturnObservation[] = [];
  const cumulative: OfficialCumulativeReturnObservation[] = [];
  for (const row of rows) {
    if (row && typeof row === "object" && (row as { basis?: unknown }).basis === "cumulative")
      cumulative.push(row as OfficialCumulativeReturnObservation);
    else annualized.push(row as OfficialReturnObservation);
  }
  return { annualized, cumulative };
}

export function validateOfficialCumulativeReturnObservations(
  observations: OfficialCumulativeReturnObservation[],
  today = new Date().toISOString().slice(0, 10),
): { valid: OfficialCumulativeReturnObservation[]; invalid: OfficialCumulativeReturnObservation[] } {
  const valid: OfficialCumulativeReturnObservation[] = [];
  const invalid: OfficialCumulativeReturnObservation[] = [];
  const seen = new Set<string>();
  for (const observation of observations) {
    const ok =
      observation.basis === "cumulative" &&
      observation.periodYears === 3 &&
      typeof observation.fundClassId === "string" &&
      typeof observation.printed === "string" &&
      (observation.printed === "-"
        ? observation.cumulative === null
        : typeof observation.cumulative === "number" &&
          Number.isFinite(observation.cumulative) &&
          /^-?\d+(?:\.\d+)?$/.test(observation.printed) &&
          Number(observation.printed) === observation.cumulative) &&
      /^\d{4}-\d{2}-\d{2}$/.test(observation.dataAsOf) &&
      observation.dataAsOf <= today &&
      /^https:\/\//.test(observation.sourceUrl) &&
      typeof observation.retrievedAt === "string" &&
      /^[0-9a-f]{64}$/.test(observation.sourceSha256) &&
      !seen.has(observation.fundClassId);
    if (ok) {
      seen.add(observation.fundClassId);
      valid.push(observation);
    } else invalid.push(observation);
  }
  return { valid, invalid };
}

/** 累積回報寫入獨立的 cumulativeReturns，唔會同 returns[3] 共用日期或來源。 */
export function applyOfficialCumulativeReturnOverlay(
  records: SourceRecord[],
  observations: OfficialCumulativeReturnObservation[],
): CumulativeReturnOverlayResult {
  const byId = new Map(records.map((record) => [record.fundClassId, record]));
  const applied: OfficialCumulativeReturnObservation[] = [];
  const unmatched: OfficialCumulativeReturnObservation[] = [];
  const conflicts: OfficialCumulativeReturnObservation[] = [];
  const seen = new Set<string>();
  const next = records.map((record) => ({
    ...record,
    cumulativeReturns: record.cumulativeReturns ? { ...record.cumulativeReturns } : undefined,
  }));
  const nextById = new Map(next.map((record) => [record.fundClassId, record]));
  for (const observation of observations) {
    const record = byId.get(observation.fundClassId);
    if (!record) {
      unmatched.push(observation);
      continue;
    }
    if (
      seen.has(observation.fundClassId) ||
      record.cumulativeReturns?.[3] !== undefined ||
      record.returns?.[3]?.cumulative !== undefined
    ) {
      conflicts.push(observation);
      continue;
    }
    seen.add(observation.fundClassId);
    const target = nextById.get(observation.fundClassId)!;
    target.cumulativeReturns = {
      ...target.cumulativeReturns,
      3: {
        cumulative: observation.cumulative,
        printed: observation.printed,
        dataAsOf: observation.dataAsOf,
        sourceUrl: observation.sourceUrl,
        retrievedAt: observation.retrievedAt,
      },
    };
    applied.push(observation);
  }
  return { records: next, applied, unmatched, conflicts };
}

export type ReturnOverlayResult = {
  records: SourceRecord[];
  applied: OfficialReturnObservation[];
  unmatched: OfficialReturnObservation[];
  conflicts: OfficialReturnObservation[];
};

export type NormalizedReturnResult = {
  observations: OfficialReturnObservation[];
  unmatched: FundFactSheetReturn[];
  ambiguous: FundFactSheetReturn[];
};

export type ReturnObservationValidation = {
  valid: OfficialReturnObservation[];
  invalid: OfficialReturnObservation[];
  coverageByPeriod: Record<1 | 3 | 5 | 10, number>;
};

export function validateOfficialReturnObservations(
  observations: OfficialReturnObservation[],
  today = new Date().toISOString().slice(0, 10),
): ReturnObservationValidation {
  const valid: OfficialReturnObservation[] = [];
  const invalid: OfficialReturnObservation[] = [];
  const seen = new Set<string>();
  for (const observation of observations) {
    const periodValid = [1, 3, 5, 10].includes(observation.periodYears);
    const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(observation.dataAsOf) && observation.dataAsOf <= today;
    const valueValid = Number.isFinite(observation.annualized);
    const sourceValid = /^https:\/\//.test(observation.sourceUrl);
    const key = `${observation.fundClassId}\u0000${observation.periodYears}`;
    if (!periodValid || !dateValid || !valueValid || !sourceValid || seen.has(key)) invalid.push(observation);
    else {
      seen.add(key);
      valid.push(observation);
    }
  }
  const coverageByPeriod = { 1: 0, 3: 0, 5: 0, 10: 0 } as Record<1 | 3 | 5 | 10, number>;
  for (const observation of valid) coverageByPeriod[observation.periodYears] += 1;
  return { valid, invalid, coverageByPeriod };
}

function identityKey(schemeName: string, constituentFundName: string) {
  const aliases: Record<string, string> = {
    "信安中國股票基金": "Principal China Equity Fund",
    "信安恒指基金": "Principal Hang Seng Index Tracking Fund",
    "信安香港股票基金": "Principal Hong Kong Equity Fund",
    "信安亞洲股票基金": "Principal Asian Equity Fund",
    "信安美國股票基金": "Principal US Equity Fund",
    "信安國際股票基金": "Principal International Equity Fund",
    "信安進取策略基金": "Principal Aggressive Strategy Fund",
    "信安環球增長基金": "Principal Global Growth Fund",
    "信安長線增值基金": "Principal Long Term Accumulation Fund",
    "信安核心累積基金": "Principal Core Accumulation Fund",
    "信安平穩回報基金": "Principal Stable Yield Fund",
    "信安65歲後基金": "Principal Age 65 Plus Fund",
    "信安國際債券基金": "Principal International Bond Fund",
    "信安亞洲債券基金": "Principal Asian Bond Fund",
    "信安香港債券基金": "Principal Hong Kong Bond Fund",
    "信安港元儲蓄基金": "Principal HK Dollar Savings Fund",
    "信安強積金保守基金": "Principal MPF Conservative Fund",
  };
  const fund = (aliases[constituentFundName] ?? constituentFundName)
    .replace(/[’‘]/g, "'")
    .replace(/^principal\s*-?\s+/i, "")
    .replace(/^-\s+/, "");
  return `${schemeName.replace(/[–—]/g, "-")}\u0000${fund}`.toLocaleLowerCase();
}

export function normalizeFundFactSheetReturns(
  records: SourceRecord[],
  returns: FundFactSheetReturn[],
  retrievedAt: string,
): NormalizedReturnResult {
  const matches = new Map<string, SourceRecord[]>();
  for (const record of records) {
    const key = identityKey(record.identity.schemeName, record.identity.constituentFundName);
    matches.set(key, [...(matches.get(key) ?? []), record]);
  }
  const observations: OfficialReturnObservation[] = [];
  const unmatched: FundFactSheetReturn[] = [];
  const ambiguous: FundFactSheetReturn[] = [];
  for (const item of returns) {
    const candidates = matches.get(identityKey(item.schemeName, item.constituentFundName)) ?? [];
    const filtered = item.fundClassName
      ? candidates.filter((record) => normalizeClassName(record.identity.fundClassName) === normalizeClassName(item.fundClassName!))
      : candidates;
    if (filtered.length === 0) unmatched.push(item);
    else if (filtered.length !== 1) ambiguous.push(item);
    else observations.push({ fundClassId: filtered[0]!.fundClassId, periodYears: 3, annualized: item.annualizedReturn3Year, dataAsOf: item.dataAsOf, sourceUrl: item.sourceUrl, retrievedAt });
  }
  return { observations, unmatched, ambiguous };
}

function normalizeClassName(value: string) {
  return value.replace(/^class\s+/i, "").trim().toLocaleLowerCase();
}

export function applyOfficialReturnOverlay(
  records: SourceRecord[],
  observations: OfficialReturnObservation[],
): ReturnOverlayResult {
  const byId = new Map(records.map((record) => [record.fundClassId, record]));
  const applied: OfficialReturnObservation[] = [];
  const unmatched: OfficialReturnObservation[] = [];
  const conflicts: OfficialReturnObservation[] = [];
  const seen = new Set<string>();
  const next = records.map((record) => ({ ...record, returns: record.returns ? { ...record.returns } : undefined }));

  for (const observation of observations) {
    const key = `${observation.fundClassId}\u0000${observation.periodYears}`;
    const record = byId.get(observation.fundClassId);
    if (!record) {
      unmatched.push(observation);
      continue;
    }
    if (seen.has(key) || record.returns?.[observation.periodYears]?.annualized !== undefined) {
      conflicts.push(observation);
      continue;
    }
    seen.add(key);
    const target = next.find((candidate) => candidate.fundClassId === record.fundClassId)!;
    target.returns = {
      ...target.returns,
      [observation.periodYears]: {
        annualized: observation.annualized,
        dataAsOf: observation.dataAsOf,
        sourceUrl: observation.sourceUrl,
        retrievedAt: observation.retrievedAt,
      },
    };
    applied.push(observation);
  }

  return { records: next, applied, unmatched, conflicts };
}
