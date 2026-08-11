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
});
