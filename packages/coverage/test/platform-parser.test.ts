import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFundDetail, parseFundIds } from "../src/platform-parser";

const fixture = (name: string) =>
  readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");

describe("MPF Fund Platform parser", () => {
  it("extracts normalized fund-class navigation keys", () => {
    expect(parseFundIds(fixture("platform-list.html"))).toEqual([429, 430]);
  });

  it("extracts the complete fund-class identity and source date", () => {
    expect(parseFundDetail(fixture("fund-detail.html"), 429)).toEqual({
      fundClassId: "mpfa-cf-429",
      identity: {
        trusteeName: "Bank Consortium Trust Company Limited",
        schemeName: "BCT MPF Scheme Series 800",
        constituentFundName: "Principal Hong Kong Equity Fund",
        fundClassName: "Class I",
      },
      current: true,
      dataAsOf: "2026-06-30",
      sourceUrl:
        "https://mfp.mpfa.org.hk/mobile/eng/cf_detail.jsp?cf_id=429",
    });
  });

  it("fails explicitly when the platform removes a required label", () => {
    expect(() =>
      parseFundDetail(
        fixture("fund-detail.html").replace("Fund Class", "Share Class"),
        429,
      ),
    ).toThrow("Fund Class is missing from cf_id 429");
  });
});
