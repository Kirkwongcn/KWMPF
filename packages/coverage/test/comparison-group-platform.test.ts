import { describe, expect, it } from "vitest";
import { buildPlatformComparisonEvidence, comparisonEvidenceFromPlatformRecord } from "../src/comparison-group";

const base = { fundClassId: "fund-a", identity: { trusteeName: "Trustee", schemeName: "Scheme", constituentFundName: "Fund", fundClassName: "Class I" }, current: true, dataAsOf: "2026-06-30", sourceUrl: "https://mfp.mpfa.org.hk/mobile/eng/cf_detail.jsp?cf_id=1" };

describe("MPF Fund Platform comparison evidence", () => {
  it("maps official fund type and full descriptor without guessing", () => {
    expect(comparisonEvidenceFromPlatformRecord({ ...base, fundType: "Mixed Assets Fund - 61% to 80% Equity", fundTypeDescriptor: "Mixed Assets Fund - Global - Maximum Equity around 70%" })).toEqual({ fundClassId: "fund-a", fundType: "mixed", allocationProfile: "Mixed Assets Fund - Global - Maximum Equity around 70%", sourceUrl: base.sourceUrl, dataAsOf: "2026-06-30" });
  });

  it("omits records with missing or unsupported official classification", () => {
    expect(comparisonEvidenceFromPlatformRecord(base)).toBeUndefined();
    expect(buildPlatformComparisonEvidence([{ ...base, fundType: "Unclassified Fund", fundTypeDescriptor: "Unknown" }])).toEqual([]);
    expect(buildPlatformComparisonEvidence([{ ...base, fundType: "Mixed Assets Fund", fundTypeDescriptor: "n.a." }])).toEqual([]);
  });
});
