import { describe, expect, it } from "vitest";
import { parseSourceSnapshot } from "../src/input";

describe("official source input", () => {
  it("fails explicitly when a record loses a required identity field", () => {
    expect(() =>
      parseSourceSnapshot({
        sourceType: "mpf_fund_platform",
        sourceUrl: "https://official.test/platform",
        retrievedAt: "2026-08-11T00:00:00Z",
        records: [
          {
            fundClassId: "fund-a",
            identity: {
              trusteeName: "Trustee A",
              schemeName: "Scheme A",
              constituentFundName: "Fund A",
            },
            current: true,
            dataAsOf: "2026-06-30",
          },
        ],
      }),
    ).toThrow("records[0].identity.fundClassName must be a non-empty string");
  });

  it("preserves overview and unavailable-field provenance for readiness", () => {
    const snapshot = parseSourceSnapshot({
      sourceType: "mpf_fund_platform",
      sourceUrl: "https://official.test/platform",
      retrievedAt: "2026-08-13T00:00:00Z",
      sourceDataAsOf: "2026-07-31",
      records: [
        {
          fundClassId: "fund-a",
          identity: {
            trusteeName: "Trustee A",
            schemeName: "Scheme A",
            constituentFundName: "Fund A",
            fundClassName: "Class I",
          },
          current: true,
          dataAsOf: "2026-07-31",
          fundOverview: { riskClass: 4, managementFee: 0.8 },
          unavailableFields: ["latestFer", "oci1yHkd"],
        },
      ],
    });

    expect(snapshot.records[0]).toMatchObject({
      fundOverview: { riskClass: 4, managementFee: 0.8 },
      unavailableFields: ["latestFer", "oci1yHkd"],
    });
  });

  const withRecord = (extra: Record<string, unknown>) => ({
    sourceType: "mpf_fund_platform",
    sourceUrl: "https://official.test/platform",
    retrievedAt: "2026-08-29T00:00:00Z",
    sourceDataAsOf: "2026-07-31",
    records: [
      {
        fundClassId: "fund-a",
        identity: {
          trusteeName: "Trustee A",
          schemeName: "Scheme A",
          constituentFundName: "Fund A",
          fundClassName: "Class I",
        },
        current: true,
        dataAsOf: "2026-07-31",
        ...extra,
      },
    ],
  });

  it("carries fund size, launch date and calendar year returns into the snapshot", () => {
    const snapshot = parseSourceSnapshot(
      withRecord({
        fundSizeHkdMillion: 12974.87,
        fundSizeAsOf: "2026-07-31",
        launchDate: "2012-09-03",
        calendarYearReturns: { 2024: 21.9, 2025: 16.49 },
        sinceLaunchReturn: {
          annualized: 12.39,
          cumulative: 407.79,
          dataAsOf: "2026-07-31",
        },
      }),
    );

    expect(snapshot.records[0]).toMatchObject({
      fundSizeHkdMillion: 12974.87,
      fundSizeAsOf: "2026-07-31",
      launchDate: "2012-09-03",
      calendarYearReturns: { 2024: 21.9, 2025: 16.49 },
      sinceLaunchReturn: {
        annualized: 12.39,
        cumulative: 407.79,
        dataAsOf: "2026-07-31",
      },
    });
  });

  it("omits fund size and launch fields a snapshot never carried", () => {
    const snapshot = parseSourceSnapshot(withRecord({}));

    expect(snapshot.records[0]).not.toHaveProperty("fundSizeHkdMillion");
    expect(snapshot.records[0]).not.toHaveProperty("launchDate");
    expect(snapshot.records[0]).not.toHaveProperty("calendarYearReturns");
    expect(snapshot.records[0]).not.toHaveProperty("sinceLaunchReturn");
  });

  it("refuses a malformed fund size or calendar year instead of dropping it", () => {
    expect(() =>
      parseSourceSnapshot(withRecord({ fundSizeHkdMillion: "12,974.87" })),
    ).toThrow("records[0].fundSizeHkdMillion must be a finite number");

    expect(() =>
      parseSourceSnapshot(withRecord({ calendarYearReturns: { "20xx": 1 } })),
    ).toThrow("keys must be four-digit years");

    expect(() =>
      parseSourceSnapshot(
        withRecord({
          sinceLaunchReturn: { annualized: 1, cumulative: 2 },
        }),
      ),
    ).toThrow("records[0].sinceLaunchReturn.dataAsOf must be a non-empty string");
  });
});
