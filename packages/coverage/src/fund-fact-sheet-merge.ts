import type { SourceRecord } from "./build-coverage";
import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

function key(schemeName: string, constituentFundName: string) {
  const bilingualAliases: Record<string, string> = {
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
  const normalizedFund = (bilingualAliases[constituentFundName] ?? constituentFundName)
    .replace(/^principal\s*-?\s+/i, "")
    .replace(/^-\s+/, "");
  return `${schemeName}\u0000${normalizedFund}`.toLocaleLowerCase();
}

export type FundFactSheetMergeResult = {
  records: SourceRecord[];
  unmatched: FundFactSheetReturn[];
  ambiguous: FundFactSheetReturn[];
};

export function mergeFundFactSheetReturns(
  records: SourceRecord[],
  factSheets: FundFactSheetReturn[],
): FundFactSheetMergeResult {
  const byFund = new Map<string, SourceRecord[]>();
  for (const record of records) {
    const baseKey = key(record.identity.schemeName, record.identity.constituentFundName);
    const classKey = `${baseKey}\u0000${record.identity.fundClassName ?? ""}`.toLocaleLowerCase();
    byFund.set(baseKey, [...(byFund.get(baseKey) ?? []), record]);
    byFund.set(classKey, [...(byFund.get(classKey) ?? []), record]);
  }
  const applied = new Map(records.map((record) => [record.fundClassId, record]));
  const unmatched: FundFactSheetReturn[] = [];
  const ambiguous: FundFactSheetReturn[] = [];

  for (const factSheet of factSheets) {
    const baseKey = key(factSheet.schemeName, factSheet.constituentFundName);
    const identityKey = factSheet.fundClassName ? `${baseKey}\u0000${factSheet.fundClassName}`.toLocaleLowerCase() : baseKey;
    const matches = byFund.get(identityKey) ?? [];
    if (matches.length === 0) {
      unmatched.push(factSheet);
      continue;
    }
    if (matches.length !== 1) {
      ambiguous.push(factSheet);
      continue;
    }
    const match = matches[0]!;
    applied.set(match.fundClassId, {
      ...match,
      returns: {
        ...match.returns,
        3: {
          ...match.returns?.[3],
          annualized: factSheet.annualizedReturn3Year,
          dataAsOf: factSheet.dataAsOf,
        },
      },
    });
  }

  return { records: records.map((record) => applied.get(record.fundClassId)!), unmatched, ambiguous };
}
