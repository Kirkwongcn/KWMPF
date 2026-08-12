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

const fundTypes: Record<string, ComparisonGroupEvidence["fundType"]> = {
  "equity fund": "equity",
  "bond fund": "bond",
  "mixed assets fund": "mixed",
  "money market fund": "money_market",
  "mpf conservative fund": "guaranteed",
  "guaranteed fund": "guaranteed",
};

export function comparisonEvidenceFromPlatformRecord(
  record: SourceRecord,
): ComparisonGroupEvidence | undefined {
  if (!record.fundType || !record.fundTypeDescriptor || !record.sourceUrl) return undefined;
  const type = Object.entries(fundTypes).find(([label]) => record.fundType!.toLocaleLowerCase().startsWith(label))?.[1];
  if (!type) return undefined;
  return {
    fundClassId: record.fundClassId,
    fundType: type,
    allocationProfile: record.fundTypeDescriptor,
    sourceUrl: record.sourceUrl,
    dataAsOf: record.dataAsOf,
  };
}

export function buildPlatformComparisonEvidence(records: SourceRecord[]) {
  return records.flatMap((record) => {
    const evidence = comparisonEvidenceFromPlatformRecord(record);
    return evidence ? [evidence] : [];
  });
}

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
