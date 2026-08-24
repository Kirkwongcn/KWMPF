import { describe, expect, it } from "vitest";
import { buildPublicationPreflight } from "../src/publication-preflight";

const complete = {
  fundClassId: "fund-a",
  identity: { trusteeName: "Trustee", schemeName: "Scheme", constituentFundName: "Fund", fundClassName: "Class I" },
  current: true,
  status: "verified" as const,
  dataAsOf: "2026-06-30",
  sourceUrl: "https://official.test/fund-a",
  publicFields: { annualizedReturn1y: 4.2, riskClass: 4, latestFer: 1.2, managementFee: 0.8, oci1yHkd: 2.4 },
};

describe("publication preflight", () => {
  it("accepts a complete traceable public payload", () => {
    expect(buildPublicationPreflight([complete])).toEqual({ ready: true, accepted: 1, blocked: 0, issues: [] });
  });

  it("does not require long horizon returns to publish", () => {
    expect(buildPublicationPreflight([complete]).ready).toBe(true);
    expect(
      buildPublicationPreflight([
        {
          ...complete,
          publicFields: { ...complete.publicFields, annualizedReturn5y: 6.1 },
        },
      ]).ready,
    ).toBe(true);
  });

  it("blocks records with missing public fields instead of creating partial payloads", () => {
    const result = buildPublicationPreflight([{ ...complete, publicFields: { annualizedReturn1y: 4.2 } }]);
    expect(result.ready).toBe(false);
    expect(result.accepted).toBe(0);
    expect(result.blocked).toBe(1);
    expect(result.issues).toEqual([expect.objectContaining({ fundClassId: "fund-a", missing: expect.arrayContaining(["riskClass", "latestFer", "managementFee", "oci1yHkd"]) })]);
  });
});
