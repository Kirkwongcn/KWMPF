import { describe, expect, it } from "vitest";
import { buildPublicationInputs } from "../src/build-publication-input";

describe("publication input builder", () => {
  it("carries only explicitly sourced public fields", () => {
    const result = buildPublicationInputs([
      {
        fundClassId: "fund-a",
        identity: {
          trusteeName: "T",
          schemeName: "S",
          constituentFundName: "F",
          fundClassName: "C",
        },
        current: true,
        dataAsOf: "2026-07-31",
        sourceUrl: "https://example.test/fund-a",
        returns: { 1: { annualized: 4.2, dataAsOf: "2026-07-31" } },
        fundOverview: { managementFee: 0.8 },
      },
    ])[0]!;

    expect(result).toMatchObject({
      fundClassId: "fund-a",
      status: "verified",
      publicFields: { annualizedReturn1y: 4.2, managementFee: 0.8 },
    });
    expect(result.publicFields).not.toHaveProperty("riskClass");
    expect(result.publicFields).not.toHaveProperty("oci1yHkd");
  });
});
