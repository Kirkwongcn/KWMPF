import type { SourceRecord } from "./build-coverage";
import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";

function key(schemeName: string, constituentFundName: string) {
  const normalizedFund = constituentFundName.replace(/^principal\s*-?\s+/i, "");
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
    const identityKey = key(record.identity.schemeName, record.identity.constituentFundName);
    byFund.set(identityKey, [...(byFund.get(identityKey) ?? []), record]);
  }
  const applied = new Map(records.map((record) => [record.fundClassId, record]));
  const unmatched: FundFactSheetReturn[] = [];
  const ambiguous: FundFactSheetReturn[] = [];

  for (const factSheet of factSheets) {
    const matches = byFund.get(key(factSheet.schemeName, factSheet.constituentFundName)) ?? [];
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
