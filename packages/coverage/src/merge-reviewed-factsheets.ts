import type { SourceRecord } from "./build-coverage";
import type { OfficialReturnObservation } from "./official-return-overlay";
import type { compareAnnualized, Target } from "./annualized-factsheet-review";

type ReviewedRow = ReturnType<typeof compareAnnualized>[number];
export type FactsheetReview = {
  summary: {
    checked: number;
    newer: number;
    revisions: number;
    older: number;
    failures: number;
  };
  reports: {
    url: string;
    sha256: string;
    retrievedAt: string;
    additionalFundNames: string[];
    rows: ReviewedRow[];
  }[];
  errors: { url: string; fundClassIds: string[]; error: string }[];
};

// These literal PDF names and IDs were reconciled in the 2026-11-12 audit.
export function verifyPlatformIdentity(
  target: Target,
  records: SourceRecord[],
) {
  const name =
    target.id === "mpfa-cf-1579" &&
    target.name === "China HK DynamicAssetAllocation Fund"
      ? "China HK Dynamic Asset Allocation Fund"
      : target.name.replace(/[’‘]/g, "'");
  const matches = records.filter(
    (record) =>
      record.current &&
      record.identity.schemeName === target.scheme &&
      record.identity.constituentFundName === name,
  );
  if (matches.length !== 1 || matches[0]!.fundClassId !== target.id)
    throw new Error("Platform identity changed or ambiguous: " + target.id);
}

export function mergeReviewedFactsheets(
  base: OfficialReturnObservation[],
  review: FactsheetReview,
  platform: SourceRecord[],
  monthlyConflicts: ReadonlySet<string>,
) {
  const updates = new Map<string, OfficialReturnObservation>();
  const quarantined = [];
  const seen = new Set<string>();
  for (const report of review.reports) {
    for (const row of report.rows) {
      if (seen.has(row.fundClassId))
        throw new Error("Duplicate reviewed fund: " + row.fundClassId);
      seen.add(row.fundClassId);
      if (row.status !== "newer") continue;
      const old = base.find(
        (x) => x.fundClassId === row.fundClassId && x.periodYears === 3,
      );
      if (
        !old ||
        old.dataAsOf !== row.previousDate ||
        old.annualized !== row.previousAnnualized ||
        row.dataAsOf <= old.dataAsOf ||
        !/^[0-9a-f]{64}$/.test(report.sha256)
      )
        throw new Error(
          "Annualized review has a different base or invalid evidence: " +
            row.fundClassId,
        );
      const record = platform.find((x) => x.fundClassId === row.fundClassId);
      const existing = record?.returns?.[3];
      if (
        report.additionalFundNames.length > 0 ||
        !record ||
        monthlyConflicts.has(row.fundClassId) ||
        existing?.annualized !== undefined
      ) {
        quarantined.push({
          ...row,
          sourceUrl: report.url,
          sourceSha256: report.sha256,
          platformReturn: existing ?? null,
          reason:
            report.additionalFundNames.length > 0
              ? "additional-fund-identities"
              : !record
                ? "missing-platform-identity"
                : monthlyConflicts.has(row.fundClassId)
                  ? "monthly-official-conflict"
                  : "platform-already-discloses",
        });
        continue;
      }
      updates.set(row.fundClassId, {
        ...old,
        annualized: row.annualized,
        dataAsOf: row.dataAsOf,
        sourceUrl: report.url,
        retrievedAt: report.retrievedAt,
        sourceSha256: report.sha256,
      });
    }
  }
  return {
    annualized: base.map(
      (row) => (row.periodYears === 3 && updates.get(row.fundClassId)) || row,
    ),
    report: { ...review, applied: [...updates.keys()], quarantined },
  };
}
