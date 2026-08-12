import { describe, expect, it } from "vitest";
import { classifyComparisonGroups, type ComparisonGroupEvidence } from "../src/comparison-group";

const record = { fundClassId: "fund-a", identity: { trusteeName: "Trustee", schemeName: "Scheme", constituentFundName: "Fund", fundClassName: "Class I" }, current: true, dataAsOf: "2026-06-30" };
const evidence: ComparisonGroupEvidence = { fundClassId: "fund-a", fundType: "equity", allocationProfile: "global-equity", sourceUrl: "https://official.test/fund-a", dataAsOf: "2026-06-30" };

describe("comparison groups", () => {
  it("classifies only when explicit allocation evidence exists", () => {
    expect(classifyComparisonGroups([record], [evidence])[0]).toEqual(expect.objectContaining({ comparisonGroup: "equity:global-equity", comparisonGroupStatus: "classified" }));
  });

  it("keeps missing evidence out of comparison groups", () => {
    expect(classifyComparisonGroups([record], [])[0]).toEqual(expect.objectContaining({ comparisonGroupStatus: "insufficient" }));
    expect(classifyComparisonGroups([record], [evidence]).every((item) => item.comparisonGroupStatus === "classified")).toBe(true);
  });

  it("rejects conflicting allocation evidence instead of choosing one", () => {
    expect(classifyComparisonGroups([record], [evidence, { ...evidence, allocationProfile: "regional-equity" }])[0]).toEqual(expect.objectContaining({ comparisonGroupStatus: "conflict" }));
  });
});
