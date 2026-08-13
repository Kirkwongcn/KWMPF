import { describe, expect, it } from "vitest";
import { buildPublicationPayload } from "../src/build-publication-payload";

const complete = {
  fundClassId: "fund-a",
  identity: {
    trusteeName: "Trustee",
    schemeName: "Scheme",
    constituentFundName: "Fund",
    fundClassName: "Class I",
  },
  current: true,
  status: "verified",
  dataAsOf: "2026-06-30",
  sourceUrl: "https://official.test/fund-a",
  publicFields: {
    annualizedReturn1y: 4.2,
    riskClass: 4,
    latestFer: 1.2,
    managementFee: 0.8,
    oci1yHkd: 2.4,
  },
};

describe("publication payload builder", () => {
  it("returns complete records only after preflight passes", () => {
    expect(buildPublicationPayload([complete])).toMatchObject({
      ready: true,
      records: [complete],
      preflight: { accepted: 1, blocked: 0 },
    });
  });

  it("returns no records when any public field is missing", () => {
    const result = buildPublicationPayload([
      complete,
      { ...complete, fundClassId: "fund-b", publicFields: undefined },
    ]);

    expect(result.ready).toBe(false);
    expect(result.records).toEqual([]);
    expect(result.preflight.blocked).toBe(1);
    expect(result.preflight.issues[0]?.fundClassId).toBe("fund-b");
  });
});
