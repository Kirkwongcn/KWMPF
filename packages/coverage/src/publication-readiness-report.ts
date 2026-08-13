import { buildPublicationPreflight, type PublicationInput } from "./publication-preflight";

export function buildPublicationReadinessReport(records: PublicationInput[]) {
  const preflight = buildPublicationPreflight(records);
  const missingByField = new Map<string, number>();
  const unavailableByField = new Map<string, number>();
  for (const issue of preflight.issues) {
    for (const field of issue.missing) {
      missingByField.set(field, (missingByField.get(field) ?? 0) + 1);
      if (records.find((record) => record.fundClassId === issue.fundClassId)?.unavailableFields?.includes(field)) {
        unavailableByField.set(field, (unavailableByField.get(field) ?? 0) + 1);
      }
    }
  }

  return {
    ready: preflight.ready,
    inputRecords: records.length,
    acceptedRecords: preflight.accepted,
    blockedRecords: preflight.blocked,
    missingByField: Object.fromEntries(
      [...missingByField.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ),
    unavailableByField: Object.fromEntries(
      [...unavailableByField.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ),
    blockedDetails: preflight.issues.map((issue) => {
      const record = records.find(
        (candidate) => candidate.fundClassId === issue.fundClassId,
      );
      return {
        fundClassId: issue.fundClassId,
        identity: record?.identity,
        sourceUrl: record?.sourceUrl,
        dataAsOf: record?.dataAsOf,
        missing: issue.missing,
        officialUnavailable: issue.missing.filter((field) =>
          record?.unavailableFields?.includes(field),
        ),
      };
    }),
    issues: preflight.issues,
  };
}
