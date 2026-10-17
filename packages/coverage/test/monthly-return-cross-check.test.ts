import { expect, it } from "vitest";
import {
  DocumentRejectedError,
  verifyDocument,
  type CrossCheckPlatformRecord,
  type MatchedRow,
  type SourceDocument,
} from "../src/monthly-return-cross-check";

const DATE = "2026-09-30";
const OLD_DATE = "2026-08-31";

function row(
  fundClassId: string,
  overrides: Partial<MatchedRow> = {},
): MatchedRow {
  return {
    fundClassId,
    label: `${fundClassId} / Unit Class A`,
    oneYear: 0.88,
    threeYears: 2.66,
    fiveYears: 3.69,
    tenYears: 5.71,
    printedThreeYears: "2.66",
    ...overrides,
  };
}

function document(
  matched: MatchedRow[],
  overrides: Partial<SourceDocument> = {},
): SourceDocument {
  return {
    kind: "manulife-monthly-summary-pdf",
    schemeName: "Manulife Global Select (MPF) Scheme",
    url: "https://trustee.example.test/monthly.pdf",
    retrievedAt: "2026-10-15T00:00:00.000Z",
    sha256: "a".repeat(64),
    bytes: 100,
    dataAsOf: DATE,
    rows: matched.length,
    failed: [],
    matched,
    ...overrides,
  };
}

function platformRecord(
  fundClassId: string,
  returns: CrossCheckPlatformRecord["returns"],
): CrossCheckPlatformRecord {
  return { fundClassId, returns };
}

const options = (checkRecords: CrossCheckPlatformRecord[], fundClassIds: string[]) => ({
  schemeRecords: fundClassIds.map((fundClassId) => ({ fundClassId })),
  checkRecords,
});

it("longer-period official conflict quarantines only that row and records both numbers", () => {
  const records = [
    platformRecord("f-ok", {
      1: { annualized: 0.88, cumulative: 0.88, dataAsOf: DATE },
      5: { cumulative: 3.69, dataAsOf: DATE },
      10: { cumulative: 5.71, dataAsOf: DATE },
    }),
    platformRecord("f-bad", {
      1: { annualized: 0.88, cumulative: 0.88, dataAsOf: DATE },
      5: { cumulative: 3.72, dataAsOf: DATE },
      10: { cumulative: 5.78, dataAsOf: DATE },
    }),
  ];
  const result = verifyDocument(document([row("f-ok"), row("f-bad")]), options(records, ["f-ok", "f-bad"]));
  expect(result.observations.map((observation) => observation.fundClassId)).toEqual(["f-ok"]);
  expect(result.source.quarantinedRows).toEqual(["f-bad"]);
  expect(result.conflicts).toEqual([
    {
      schemeName: "Manulife Global Select (MPF) Scheme",
      fundClassId: "f-bad",
      label: "f-bad / Unit Class A",
      periodYears: 5,
      trusteeValue: 3.69,
      trusteePrinted: null,
      trusteeDataAsOf: DATE,
      platformValue: 3.72,
      platformDataAsOf: DATE,
      sourceUrl: "https://trustee.example.test/monthly.pdf",
      sourceSha256: "a".repeat(64),
    },
    {
      schemeName: "Manulife Global Select (MPF) Scheme",
      fundClassId: "f-bad",
      label: "f-bad / Unit Class A",
      periodYears: 10,
      trusteeValue: 5.71,
      trusteePrinted: null,
      trusteeDataAsOf: DATE,
      platformValue: 5.78,
      platformDataAsOf: DATE,
      sourceUrl: "https://trustee.example.test/monthly.pdf",
      sourceSha256: "a".repeat(64),
    },
  ]);
});

it("conflict records carry printed source text and trustee document provenance (ADR 0016)", () => {
  const records = [
    platformRecord("f-ok", {
      1: { annualized: 0.88, cumulative: 0.88, dataAsOf: DATE },
      5: { cumulative: 3.69, dataAsOf: DATE },
    }),
    platformRecord("f-bad", {
      1: { annualized: 0.88, cumulative: 0.88, dataAsOf: DATE },
      5: { cumulative: 3.72, dataAsOf: DATE },
      10: { cumulative: 5.78, dataAsOf: DATE },
    }),
  ];
  const result = verifyDocument(
    document([
      row("f-ok"),
      row("f-bad", { fiveYears: 3.7, printedFiveYears: "3.70", printedTenYears: "-" }),
    ]),
    options(records, ["f-ok", "f-bad"]),
  );
  const five = result.conflicts.find((conflict) => conflict.periodYears === 5)!;
  // 印出「3.70」照錄原文，序列化數字 3.7 唔可以頂替（紅線 1）。
  expect(five.trusteePrinted).toBe("3.70");
  expect(five.trusteeValue).toBe(3.7);
  expect(five).toMatchObject({
    schemeName: "Manulife Global Select (MPF) Scheme",
    sourceUrl: "https://trustee.example.test/monthly.pdf",
    sourceSha256: "a".repeat(64),
  });
});

it("rejection keeps recorded conflicts on the error so both official numbers survive (ADR 0016)", () => {
  const records = [
    platformRecord("f-bad", {
      1: { annualized: 0.88, cumulative: 0.88, dataAsOf: DATE },
      5: { cumulative: 3.72, dataAsOf: DATE },
    }),
  ];
  let thrown: unknown;
  try {
    verifyDocument(document([row("f-bad")]), options(records, ["f-bad"]));
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(DocumentRejectedError);
  const error = thrown as DocumentRejectedError;
  expect(error.conflicts).toHaveLength(1);
  expect(error.conflicts[0]).toMatchObject({ fundClassId: "f-bad", trusteeValue: 3.69, platformValue: 3.72 });
  expect(error.message).toMatch(
    /official-source conflicts recorded: f-bad 5-year trustee 3\.69 \(as of 2026-09-30\) vs platform 3\.72 \(as of 2026-09-30\)/,
  );
});

it("one-year rejection still records 5/10-year conflicts like the old parser did (ADR 0016)", () => {
  const records = [
    platformRecord("f-bad", {
      1: { annualized: 0.9, cumulative: 0.9, dataAsOf: DATE },
      5: { cumulative: 3.72, dataAsOf: DATE },
    }),
  ];
  let thrown: unknown;
  try {
    verifyDocument(document([row("f-bad", { oneYear: 0.88 })]), options(records, ["f-bad"]));
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(DocumentRejectedError);
  const error = thrown as DocumentRejectedError;
  expect(error.message).toMatch(/cross-check failed: f-bad 1-year source 0\.88 vs platform 0\.9/);
  expect(error.conflicts).toHaveLength(1);
  expect(error.conflicts[0]!.periodYears).toBe(5);
  expect(error.message).toMatch(/official-source conflicts recorded: f-bad 5-year/);
});

it("one-year mismatch still rejects the whole document", () => {
  const records = [
    platformRecord("f-bad", { 1: { annualized: 0.9, cumulative: 0.9, dataAsOf: DATE } }),
  ];
  expect(() =>
    verifyDocument(document([row("f-bad", { oneYear: 0.88 })]), options(records, ["f-bad"])),
  ).toThrow(/cross-check failed: f-bad 1-year source 0.88 vs platform 0.9/);
});

it("a document where every matched row conflicts is rejected entirely", () => {
  const records = [
    platformRecord("f-bad", {
      1: { annualized: 0.88, cumulative: 0.88, dataAsOf: DATE },
      5: { cumulative: 3.72, dataAsOf: DATE },
    }),
  ];
  expect(() =>
    verifyDocument(document([row("f-bad")]), options(records, ["f-bad"])),
  ).toThrow(/official-source conflict quarantine covers all 1 matched row\(s\) of/);
});

it("longer-period platform value dated differently is not compared and not quarantined", () => {
  const records = [
    platformRecord("f-ok", {
      1: { annualized: 0.88, cumulative: 0.88, dataAsOf: DATE },
      5: { cumulative: 99.99, dataAsOf: OLD_DATE },
    }),
  ];
  const result = verifyDocument(document([row("f-ok")]), options(records, ["f-ok"]));
  expect(result.conflicts).toEqual([]);
  expect(result.source.quarantinedRows).toEqual([]);
  expect(result.observations).toHaveLength(1);
});

it("officially-not-disclosed one-year rows still pass when the platform has none", () => {
  const records = [platformRecord("f-na", {})];
  const result = verifyDocument(
    document([row("f-na", { oneYear: null, threeYears: null, fiveYears: null, tenYears: null })]),
    options(records, ["f-na"]),
  );
  expect(result.conflicts).toEqual([]);
  expect(result.source.officialNotDisclosed).toEqual(["f-na"]);
  expect(result.source.oneYearCrossChecks).toBe(1);
});
