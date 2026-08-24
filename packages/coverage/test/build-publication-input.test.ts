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

  it("carries official five and ten year returns when the source provides them", () => {
    const result = buildPublicationInputs([
      {
        fundClassId: "fund-b",
        identity: {
          trusteeName: "T",
          schemeName: "S",
          constituentFundName: "F",
          fundClassName: "C",
        },
        current: true,
        dataAsOf: "2026-07-31",
        sourceUrl: "https://example.test/fund-b",
        returns: {
          1: { annualized: 4.2, dataAsOf: "2026-07-31" },
          5: { annualized: 6.1, dataAsOf: "2026-07-31" },
          10: { annualized: 5.4, dataAsOf: "2026-07-31" },
        },
      },
    ])[0]!;

    expect(result.publicFields).toMatchObject({
      annualizedReturn1y: 4.2,
      annualizedReturn5y: 6.1,
      annualizedReturn10y: 5.4,
    });
  });

  it("omits long horizon returns the source never published", () => {
    const result = buildPublicationInputs([
      {
        fundClassId: "fund-c",
        identity: {
          trusteeName: "T",
          schemeName: "S",
          constituentFundName: "F",
          fundClassName: "C",
        },
        current: true,
        dataAsOf: "2026-07-31",
        sourceUrl: "https://example.test/fund-c",
        returns: { 1: { annualized: 4.2, dataAsOf: "2026-07-31" } },
      },
    ])[0]!;

    expect(result.publicFields).not.toHaveProperty("annualizedReturn5y");
    expect(result.publicFields).not.toHaveProperty("annualizedReturn10y");
  });

  it("carries official cumulative returns for the long horizons", () => {
    const result = buildPublicationInputs([
      {
        fundClassId: "fund-d",
        identity: {
          trusteeName: "T",
          schemeName: "S",
          constituentFundName: "F",
          fundClassName: "C",
        },
        current: true,
        dataAsOf: "2026-07-31",
        sourceUrl: "https://example.test/fund-d",
        returns: {
          1: { annualized: 29.58, cumulative: 29.58, dataAsOf: "2026-07-31" },
          5: { annualized: 4.2, cumulative: 22.85, dataAsOf: "2026-07-31" },
          10: { annualized: 9.41, cumulative: 145.86, dataAsOf: "2026-07-31" },
        },
      },
    ])[0]!;

    expect(result.publicFields).toMatchObject({
      cumulativeReturn5y: 22.85,
      cumulativeReturn10y: 145.86,
    });
  });

  it("carries the one year cumulative return the source publishes", () => {
    const result = buildPublicationInputs([
      {
        fundClassId: "fund-e",
        identity: {
          trusteeName: "T",
          schemeName: "S",
          constituentFundName: "F",
          fundClassName: "C",
        },
        current: true,
        dataAsOf: "2026-07-31",
        sourceUrl: "https://example.test/fund-e",
        returns: {
          1: { annualized: 29.58, cumulative: 29.58, dataAsOf: "2026-07-31" },
        },
      },
    ])[0]!;

    expect(result.publicFields).toMatchObject({ cumulativeReturn1y: 29.58 });
  });

  it("omits cumulative returns the source never published", () => {
    const result = buildPublicationInputs([
      {
        fundClassId: "fund-f",
        identity: {
          trusteeName: "T",
          schemeName: "S",
          constituentFundName: "F",
          fundClassName: "C",
        },
        current: true,
        dataAsOf: "2026-07-31",
        sourceUrl: "https://example.test/fund-f",
        returns: {
          5: { annualized: 6.1, dataAsOf: "2026-07-31" },
        },
      },
    ])[0]!;

    expect(result.publicFields).toMatchObject({ annualizedReturn5y: 6.1 });
    expect(result.publicFields).not.toHaveProperty("cumulativeReturn5y");
  });
});
