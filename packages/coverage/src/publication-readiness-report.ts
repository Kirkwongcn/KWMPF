import { buildPublicationPreflight, type PublicationInput } from "./publication-preflight";

export function buildPublicationReadinessReport(records: PublicationInput[]) {
  const preflight = buildPublicationPreflight(records);
  const missingByField = new Map<string, number>();
  for (const issue of preflight.issues) {
    for (const field of issue.missing) {
      missingByField.set(field, (missingByField.get(field) ?? 0) + 1);
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
    issues: preflight.issues,
  };
}
