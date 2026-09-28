export type FactSheetSourceManifestEntry = {
  scheme: string;
  factSheetUrl: string;
  status: string;
  sha256?: string;
};

export type AuditedFactSheetPeriodNonDisclosure = {
  classification: "period-not-disclosed";
  scheme: string;
  factSheetUrl: string;
  sha256: string;
  periodYears: number;
  dataAsOf: string;
  reviewedAt: string;
  pageNumbers: number[];
  evidencePath: string;
  explanation: string;
};

const auditedPeriodNonDisclosures: readonly AuditedFactSheetPeriodNonDisclosure[] = [
  {
    classification: "period-not-disclosed",
    scheme: "Manulife RetireChoice (MPF) Scheme",
    factSheetUrl:
      "https://www.manulife.com.hk/content/dam/insurance/hk/en/documents/products/mpf/retirechoice-scheme/fundfact-sheet.pdf",
    sha256: "0248313a0e14d2e9b5abb1599473b21bb984db60f549c958f741a4e31e45f4a5",
    periodYears: 3,
    dataAsOf: "2026-07-31",
    reviewedAt: "2026-09-28",
    pageNumbers: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25],
    evidencePath: "docs/agents/fact-sheet-source-notes.md",
    explanation:
      "The cumulative table lists 1 month, 3 months, 1 year, 5 years, 10 years, and since inception; the annualized table lists 1, 5, and 10 years and since inception. Neither table discloses a 3-year period.",
  },
];

export function findAuditedFactSheetPeriodNonDisclosure(
  entry: FactSheetSourceManifestEntry,
  periodYears: number,
): AuditedFactSheetPeriodNonDisclosure | undefined {
  if (entry.status !== "downloaded") return undefined;
  return auditedPeriodNonDisclosures.find(
    (audit) =>
      audit.periodYears === periodYears &&
      audit.scheme === entry.scheme &&
      audit.factSheetUrl === entry.factSheetUrl &&
      audit.sha256 === entry.sha256,
  );
}

export class UnsupportedFactSheetParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedFactSheetParserError";
  }
}
