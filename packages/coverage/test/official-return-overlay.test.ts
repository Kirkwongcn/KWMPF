import { describe, expect, it } from "vitest";
import { applyOfficialReturnOverlay } from "../src/official-return-overlay";

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
  it("applies verified observations without changing identity or current status", () => {
    const result = applyOfficialReturnOverlay([record], [observation(1, 2.1), observation(3, 3.2)]);
    expect(result.records[0]).toEqual(expect.objectContaining({ ...record, current: true }));
    expect(result.records[0]?.returns).toEqual({
      1: { annualized: 2.1, dataAsOf: "2025-12-31" },
      3: { annualized: 3.2, dataAsOf: "2025-12-31" },
    });
    expect(result.applied).toHaveLength(2);
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
