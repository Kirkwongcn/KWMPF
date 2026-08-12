import type { SourceRecord } from "./build-coverage";

export type ComparisonGroupEvidence = {
  fundClassId: string;
  fundType: "equity" | "bond" | "mixed" | "money_market" | "guaranteed" | "target_date";
  allocationProfile: string;
  sourceUrl: string;
  dataAsOf: string;
};

export type ClassifiedFundClass = SourceRecord & {
  comparisonGroup?: string;
  comparisonGroupStatus: "classified" | "insufficient" | "conflict";
  comparisonGroupEvidence?: ComparisonGroupEvidence[];
};

export function classifyComparisonGroups(
  records: SourceRecord[],
  evidence: ComparisonGroupEvidence[],
): ClassifiedFundClass[] {
  const byId = new Map<string, ComparisonGroupEvidence[]>();
  for (const item of evidence) {
    byId.set(item.fundClassId, [...(byId.get(item.fundClassId) ?? []), item]);
  }

  return records.map((record) => {
    const matches = byId.get(record.fundClassId) ?? [];
    const distinctGroups = new Set(matches.map((item) => `${item.fundType}:${item.allocationProfile}`));
    if (matches.length === 0) return { ...record, comparisonGroupStatus: "insufficient" };
    if (distinctGroups.size !== 1 || matches.some((item) => !/^https:\/\//.test(item.sourceUrl))) {
      return { ...record, comparisonGroupStatus: "conflict", comparisonGroupEvidence: matches };
    }
    const group = [...distinctGroups][0]!;
    return {
      ...record,
      comparisonGroup: group,
      comparisonGroupStatus: "classified",
      comparisonGroupEvidence: matches,
    };
  });
}
