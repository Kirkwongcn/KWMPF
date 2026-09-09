import { describe, expect, it } from "vitest";
import { toAllocationLabelLookup } from "../src/allocation-label-lookup";
import { normalizeLabel, type AllocationLabelMapFile } from "../src/allocation-label-map";
import type { PublishedFactSheetDisclosure } from "../src/fact-sheet-disclosure-lookup";

const file: AllocationLabelMapFile = {
  generatedAt: "2026-09-08",
  version: 1,
  source: "test",
  buckets: ["equity", "bond", "cash_and_other"],
  entries: [
    { key: normalizeLabel("Equities 股票"), bucket: "equity", examples: ["Equities 股票"] },
    { key: normalizeLabel("Bonds 債券"), bucket: "bond", examples: ["Bonds 債券"] },
    { key: normalizeLabel("Cash 現金"), bucket: "cash_and_other", examples: ["Cash 現金"] },
  ],
};

function disclosure(
  overrides: Partial<PublishedFactSheetDisclosure> = {},
): PublishedFactSheetDisclosure {
  return {
    schemeName: "Test Scheme",
    constituentFundName: "Test Fund",
    factSheetFile: "test.pdf",
    factSheetUrl: "https://example.test/test.pdf",
    factSheetSource: "trustee",
    factSheetAsOf: "2026-06-30",
    allocations: [
      {
        heading: "Fund Allocation by Asset Class 資產類別投資分布",
        entries: [
          { label: "Equities 股票", percent: 70 },
          { label: "Bonds 債券", percent: 25 },
          { label: "Cash 現金", percent: 5 },
        ],
      },
    ],
    topHoldings: [],
    unavailableFields: [],
    unavailableReasons: {},
    unavailableKinds: {},
    ...overrides,
  };
}

describe("allocation label lookup", () => {
  it("maps a disclosure onto editorial buckets using the committed table", () => {
    const lookup = toAllocationLabelLookup(file);
    expect(lookup.mapOf(disclosure())).toEqual({
      official: false,
      mapVersion: "2026-09-08",
      asOf: "2026-06-30",
      sourceHeading: "Fund Allocation by Asset Class 資產類別投資分布",
      buckets: { equity: 70, bond: 25, cashAndOther: 5 },
    });
  });

  it("refuses an empty map instead of guessing buckets", () => {
    expect(() => toAllocationLabelLookup({ ...file, entries: [] })).toThrow(
      "Allocation label map has no entries",
    );
  });
});
