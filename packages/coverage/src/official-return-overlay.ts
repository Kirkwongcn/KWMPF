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
      ? candidates.filter((record) => record.identity.fundClassName.toLocaleLowerCase() === item.fundClassName!.toLocaleLowerCase())
      : candidates;
    if (filtered.length === 0) unmatched.push(item);
    else if (filtered.length !== 1) ambiguous.push(item);
    else observations.push({ fundClassId: filtered[0]!.fundClassId, periodYears: 3, annualized: item.annualizedReturn3Year, dataAsOf: item.dataAsOf, sourceUrl: item.sourceUrl, retrievedAt });
  }
  return { observations, unmatched, ambiguous };
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
      },
    };
    applied.push(observation);
  }

  return { records: next, applied, unmatched, conflicts };
}
