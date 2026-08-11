import { describe, expect, it } from "vitest";
import {
  buildCoverage,
  serializeCoverage,
  type SourceSnapshot,
} from "../src/build-coverage";

const identity = {
  trusteeName: "Trustee A",
  schemeName: "Scheme A",
  constituentFundName: "Fund A",
  fundClassName: "Class I",
};

function source(
  sourceType: SourceSnapshot["sourceType"],
  records: SourceSnapshot["records"],
): SourceSnapshot {
  return {
    sourceType,
    sourceUrl: `https://official.test/${sourceType}`,
    retrievedAt: "2026-08-11T00:00:00Z",
    records,
  };
}

describe("coverage manifest", () => {
  it("marks only identities confirmed current by all three official sources as current", () => {
    const matchingRecord = {
      fundClassId: "fund-a-class-i",
      identity,
      current: true,
      dataAsOf: "2026-06-30",
    };
    const conflictingRecord = {
      fundClassId: "fund-b-class-i",
      identity: { ...identity, constituentFundName: "Fund B" },
      current: true,
      dataAsOf: "2026-06-30",
    };

    const result = buildCoverage([
      source("mpf_fund_platform", [matchingRecord, conflictingRecord]),
      source("trustee_fund_list", [
        matchingRecord,
        {
          ...conflictingRecord,
          identity: { ...conflictingRecord.identity, fundClassName: "Class T" },
        },
      ]),
      source("official_scheme_document", [matchingRecord, conflictingRecord]),
    ]);

    expect(result.records).toEqual([
      expect.objectContaining({
        fundClassId: "fund-a-class-i",
        status: "verified",
        current: true,
        rankingEligible: true,
        conflicts: [],
      }),
      expect.objectContaining({
        fundClassId: "fund-b-class-i",
        status: "pending_verification",
        current: false,
        rankingEligible: false,
        conflicts: [
          expect.objectContaining({
            sourceType: "trustee_fund_list",
            reason: "identity_mismatch",
            dataAsOf: "2026-06-30",
          }),
        ],
      }),
    ]);
  });

  it("detects coverage changes and assigns every trustee to one stable batch of at most four", () => {
    const currentRecords = Array.from({ length: 9 }, (_, index) => ({
      fundClassId: `fund-${index + 1}`,
      identity: {
        trusteeName: `Trustee ${String.fromCharCode(65 + index)}`,
        schemeName: `Scheme ${index + 1}`,
        constituentFundName: `Fund ${index + 1}`,
        fundClassName: "Class I",
      },
      current: true,
      dataAsOf: "2026-06-30",
    }));
    const previous = {
      records: [
        {
          fundClassId: "fund-1",
          identity: {
            ...currentRecords[0]!.identity,
            fundClassName: "Old Class",
          },
        },
        { fundClassId: "removed-fund", identity },
      ],
    };

    const result = buildCoverage(
      [
        source("mpf_fund_platform", currentRecords),
        source("trustee_fund_list", currentRecords),
        source("official_scheme_document", currentRecords),
      ],
      previous,
    );

    expect(result.changes).toEqual({
      added: currentRecords.slice(1).map((record) => record.fundClassId),
      removed: ["removed-fund"],
      identityChanged: ["fund-1"],
    });
    expect(result.trusteeBatches.map((batch) => batch.trustees)).toEqual([
      ["Trustee A", "Trustee B", "Trustee C", "Trustee D"],
      ["Trustee E", "Trustee F", "Trustee G", "Trustee H"],
      ["Trustee I"],
    ]);
    expect(
      new Set(result.trusteeBatches.flatMap((batch) => batch.trustees)).size,
    ).toBe(9);

    const addedTrusteeRecord = {
      fundClassId: "fund-10",
      identity: {
        trusteeName: "Trustee AA",
        schemeName: "Scheme 10",
        constituentFundName: "Fund 10",
        fundClassName: "Class I",
      },
      current: true,
      dataAsOf: "2026-06-30",
    };
    const expanded = [...currentRecords, addedTrusteeRecord];
    const rebuilt = buildCoverage(
      [
        source("mpf_fund_platform", expanded),
        source("trustee_fund_list", expanded),
        source("official_scheme_document", expanded),
      ],
      result,
    );

    expect(rebuilt.trusteeBatches[0]?.trustees).toEqual([
      "Trustee A",
      "Trustee B",
      "Trustee C",
      "Trustee D",
    ]);
    expect(rebuilt.trusteeBatches[1]?.trustees).toEqual([
      "Trustee E",
      "Trustee F",
      "Trustee G",
      "Trustee H",
    ]);
    expect(rebuilt.trusteeBatches[2]?.trustees).toEqual([
      "Trustee I",
      "Trustee AA",
    ]);
  });

  it("produces identical bytes when the same official snapshots arrive in a different order", () => {
    const record = {
      fundClassId: "fund-a-class-i",
      identity,
      current: true,
      dataAsOf: "2026-06-30",
    };
    const sources = [
      source("mpf_fund_platform", [record]),
      source("trustee_fund_list", [record]),
      source("official_scheme_document", [record]),
    ];

    expect(serializeCoverage(buildCoverage(sources))).toBe(
      serializeCoverage(buildCoverage([...sources].reverse())),
    );
  });

  it("fails closed when an official snapshot misses its declared fund-class total", () => {
    const platform = source("mpf_fund_platform", []);
    platform.expectedCounts = { fundClasses: 451 };

    expect(() => buildCoverage([platform])).toThrow(
      "mpf_fund_platform expected 451 fund classes but received 0",
    );
  });

  it("dates and links a missing-source conflict", () => {
    const record = {
      fundClassId: "fund-a-class-i",
      identity,
      current: true,
      dataAsOf: "2026-06-30",
    };

    const result = buildCoverage([
      source("mpf_fund_platform", [record]),
      source("trustee_fund_list", []),
      source("official_scheme_document", []),
    ]);

    expect(result.records[0]?.conflicts).toContainEqual({
      sourceType: "trustee_fund_list",
      sourceUrl: "https://official.test/trustee_fund_list",
      checkedAt: "2026-08-11T00:00:00Z",
      reason: "missing_source",
    });
  });
});
