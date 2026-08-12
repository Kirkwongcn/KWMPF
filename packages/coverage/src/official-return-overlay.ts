import type { SourceRecord } from "./build-coverage";

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
