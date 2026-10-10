import { describe, expect, it } from "vitest";
import {
  applyOfficialCumulativeReturnOverlay,
  applyOfficialReturnOverlay,
  normalizeFundFactSheetReturns,
  splitReturnObservations,
  validateOfficialCumulativeReturnObservations,
  validateOfficialReturnObservations,
} from "../src/official-return-overlay";
import { buildPublicationInputs } from "../src/build-publication-input";

const record = {
  fundClassId: "fidelity-1",
  identity: {
    trusteeName: "Fidelity",
    schemeName: "Fidelity Retirement Master Trust",
    constituentFundName: "Global Equity Fund",
    fundClassName: "Class A",
  },
  current: true,
  dataAsOf: "2026-06-30",
};

const observation = (periodYears: 1 | 3 | 5 | 10, annualized: number) => ({
  fundClassId: "fidelity-1",
  periodYears,
  annualized,
  dataAsOf: "2025-12-31",
  sourceUrl: "https://official.test/fidelity.pdf",
  retrievedAt: "2026-08-12T00:00:00Z",
});

describe("official return overlay", () => {
  it("validates dates, sources, values, and duplicate period observations", () => {
    const result = validateOfficialReturnObservations(
      [observation(3, 3.2), { ...observation(3, 4.2), sourceUrl: "http://insecure.test/returns.pdf" }, { ...observation(5, Number.NaN) }, { ...observation(10, 1.2), dataAsOf: "2026-12-31" }],
      "2026-08-12",
    );
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(3);
    expect(result.coverageByPeriod).toEqual({ 1: 0, 3: 1, 5: 0, 10: 0 });
  });

  it("normalizes a legacy official parser result only when identity is unique", () => {
    const result = normalizeFundFactSheetReturns(
      [record],
      [{ schemeName: record.identity.schemeName, constituentFundName: record.identity.constituentFundName, dataAsOf: "2025-12-31", sourceUrl: "https://official.test/fidelity.pdf", annualizedReturn3Year: 3.2 }],
      "2026-08-12T00:00:00Z",
    );
    expect(result.observations).toEqual([expect.objectContaining({ fundClassId: "fidelity-1", periodYears: 3, annualized: 3.2 })]);
    expect(result.unmatched).toHaveLength(0);
    expect(result.ambiguous).toHaveLength(0);
  });

  it("does not guess a class when the legacy result matches multiple classes", () => {
    const result = normalizeFundFactSheetReturns(
      [record, { ...record, fundClassId: "fidelity-2", identity: { ...record.identity, fundClassName: "Class B" } }],
      [{ schemeName: record.identity.schemeName, constituentFundName: record.identity.constituentFundName, dataAsOf: "2025-12-31", sourceUrl: "https://official.test/fidelity.pdf", annualizedReturn3Year: 3.2 }],
      "2026-08-12T00:00:00Z",
    );
    expect(result.observations).toHaveLength(0);
    expect(result.ambiguous).toHaveLength(1);
  });

  it("applies verified observations without changing identity or current status", () => {
    const result = applyOfficialReturnOverlay([record], [observation(1, 2.1), observation(3, 3.2)]);
    expect(result.records[0]).toEqual(expect.objectContaining({ ...record, current: true }));
    expect(result.records[0]?.returns).toEqual({
      1: {
        annualized: 2.1,
        dataAsOf: "2025-12-31",
        sourceUrl: "https://official.test/fidelity.pdf",
        retrievedAt: "2026-08-12T00:00:00Z",
      },
      3: {
        annualized: 3.2,
        dataAsOf: "2025-12-31",
        sourceUrl: "https://official.test/fidelity.pdf",
        retrievedAt: "2026-08-12T00:00:00Z",
      },
    });
    expect(result.applied).toHaveLength(2);
  });

  it("matches official short class labels to platform Class labels", () => {
    const result = normalizeFundFactSheetReturns(
      [{ ...record, identity: { ...record.identity, fundClassName: "Class A" } }],
      [{ schemeName: record.identity.schemeName, constituentFundName: record.identity.constituentFundName, fundClassName: "A", dataAsOf: "2025-12-31", sourceUrl: "https://official.test/returns.pdf", annualizedReturn3Year: 3.2 }],
      "2026-08-13T00:00:00Z",
    );
    expect(result.observations).toHaveLength(1);
  });

  it("keeps unknown and duplicate observations out of the candidate overlay", () => {
    const result = applyOfficialReturnOverlay(
      [record],
      [observation(3, 3.2), observation(3, 4.2), { ...observation(5, 5.1), fundClassId: "missing" }],
    );
    expect(result.applied).toHaveLength(1);
    expect(result.conflicts).toHaveLength(1);
    expect(result.unmatched).toHaveLength(1);
    expect(result.records[0]?.returns?.[3]?.annualized).toBe(3.2);
  });

  it("does not overwrite a return already present in coverage", () => {
    const existing = { ...record, returns: { 3: { annualized: 1.5, dataAsOf: "2025-06-30" } } };
    const result = applyOfficialReturnOverlay([existing], [observation(3, 3.2)]);
    expect(result.applied).toHaveLength(0);
    expect(result.conflicts).toHaveLength(1);
    expect(result.records[0]?.returns?.[3]?.annualized).toBe(1.5);
  });
});

describe("official cumulative return overlay (ADR 0014)", () => {
  const sha = "a".repeat(64);
  const cumulative = (overrides: Record<string, unknown> = {}) => ({
    fundClassId: "fidelity-1",
    periodYears: 3 as const,
    basis: "cumulative" as const,
    cumulative: 9.2,
    printed: "9.20",
    dataAsOf: "2026-08-31",
    sourceUrl: "https://official.test/monthly.pdf",
    retrievedAt: "2026-10-05T00:00:00Z",
    sourceSha256: sha,
    ...overrides,
  });

  it("splits a mixed candidate file without changing old annualized rows", () => {
    const split = splitReturnObservations([observation(3, 3.2), cumulative()]);
    expect(split.annualized).toEqual([observation(3, 3.2)]);
    expect(split.cumulative).toEqual([cumulative()]);
  });

  it("rejects other periods, bad hashes, insecure sources, future dates and duplicates", () => {
    const result = validateOfficialCumulativeReturnObservations(
      [
        cumulative(),
        cumulative({ fundClassId: "x", periodYears: 5 }),
        cumulative({ fundClassId: "y", sourceSha256: "abc" }),
        cumulative({ fundClassId: "z", sourceUrl: "http://insecure.test/a.pdf" }),
        cumulative({ fundClassId: "w", dataAsOf: "2026-12-31" }),
        cumulative({ fundClassId: "v", cumulative: Number.NaN }),
        cumulative({ fundClassId: "u", printed: "9.30" }),
        cumulative({ fundClassId: "t", cumulative: null, printed: "0.00" }),
        cumulative({ fundClassId: "s", cumulative: 0, printed: "-" }),
        cumulative(),
      ] as never,
      "2026-10-05",
    );
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(9);
  });

  it("accepts the official dash or N/A only as a null value", () => {
    const result = validateOfficialCumulativeReturnObservations(
      [
        cumulative({ cumulative: null, printed: "-" }),
        cumulative({ fundClassId: "bct", cumulative: null, printed: "N/A" }),
        cumulative({ fundClassId: "bad", cumulative: 0, printed: "N/A" }),
      ] as never,
      "2026-10-05",
    );
    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(1);
  });

  it("keeps its own source and date apart from the annualized three-year return", () => {
    const withAnnualized = applyOfficialReturnOverlay([record], [observation(3, 3.2)]).records;
    const result = applyOfficialCumulativeReturnOverlay(withAnnualized, [cumulative()]);
    expect(result.applied).toHaveLength(1);
    const target = result.records[0]!;
    expect(target.returns?.[3]).toMatchObject({ annualized: 3.2, dataAsOf: "2025-12-31" });
    expect(target.returns?.[3]?.cumulative).toBeUndefined();
    expect(target.cumulativeReturns?.[3]).toEqual({
      cumulative: 9.2,
      printed: "9.20",
      dataAsOf: "2026-08-31",
      sourceUrl: "https://official.test/monthly.pdf",
      retrievedAt: "2026-10-05T00:00:00Z",
    });
    // 原紀錄唔被改動。
    expect(withAnnualized[0]!.cumulativeReturns).toBeUndefined();
  });

  it("reports unknown funds and a second value for the same fund instead of guessing", () => {
    const result = applyOfficialCumulativeReturnOverlay([record], [
      cumulative(),
      cumulative({ cumulative: 10 }),
      cumulative({ fundClassId: "unknown" }),
    ] as never);
    expect(result.applied).toHaveLength(1);
    expect(result.conflicts).toHaveLength(1);
    expect(result.unmatched).toHaveLength(1);
  });

  it("publishes the cumulative value with its own source block", () => {
    const records = applyOfficialCumulativeReturnOverlay([record], [cumulative()]).records;
    const [input] = buildPublicationInputs(records as never);
    expect(input!.publicFields).toMatchObject({
      cumulativeReturn3y: 9.2,
      cumulativeReturnSources: {
        "3": {
          printed: "9.20",
          dataAsOf: "2026-08-31",
          sourceUrl: "https://official.test/monthly.pdf",
          retrievedAt: "2026-10-05T00:00:00Z",
        },
      },
    });
    expect(input!.publicFields?.annualizedReturn3y).toBeUndefined();
    expect(input!.publicFields?.returnsAsOf).toBeUndefined();
  });

  it("publishes the official dash as unavailable with its source, never as zero", () => {
    const records = applyOfficialCumulativeReturnOverlay(
      [record],
      [cumulative({ cumulative: null, printed: "-" })] as never,
    ).records;
    const [input] = buildPublicationInputs(records as never);
    expect(input!.publicFields?.cumulativeReturn3y).toBeUndefined();
    expect(input!.publicFields?.cumulativeReturnSources?.["3"]).toMatchObject({
      printed: "-",
      dataAsOf: "2026-08-31",
    });
    expect(input!.unavailableFields).toContain("cumulativeReturn3y");
  });
});
