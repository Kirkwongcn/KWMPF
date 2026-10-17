import { expect, it } from "vitest";
import {
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
      fundClassId: "f-bad",
      label: "f-bad / Unit Class A",
      periodYears: 5,
      trusteeValue: 3.69,
      trusteeDataAsOf: DATE,
      platformValue: 3.72,
      platformDataAsOf: DATE,
    },
    {
      fundClassId: "f-bad",
      label: "f-bad / Unit Class A",
      periodYears: 10,
      trusteeValue: 5.71,
      trusteeDataAsOf: DATE,
      platformValue: 5.78,
      platformDataAsOf: DATE,
    },
  ]);
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
