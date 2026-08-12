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
      fundType: "Equity Fund - Hong Kong Equity Fund",
      fundTypeDescriptor: "Equity Fund - Hong Kong Equity Fund",
      current: true,
      dataAsOf: "2026-06-30",
      sourceUrl:
        "https://mfp.mpfa.org.hk/mobile/eng/cf_detail.jsp?cf_id=429",
      returns: {
        1: { annualized: 6.09, cumulative: 6.09, dataAsOf: "2026-06-30" },
        5: { annualized: -3.92, cumulative: -18.1, dataAsOf: "2026-06-30" },
        10: { annualized: 1.23, cumulative: 13.04, dataAsOf: "2026-06-30" },
      },
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

  it("does not treat a protection page as a fund detail page", () => {
    expect(() => parseFundDetail("This page can't be displayed. incident ID: N/A", 466)).toThrow(
      "Name of MPF trustee is missing from cf_id 466",
    );
  });

  it("skips an explicitly unavailable return period", () => {
    const html = fixture("fund-detail.html").replace(
      "+1.23% p.a. / +13.04%",
      "n.a. / n.a.",
    );
    expect(parseFundDetail(html, 429).returns?.[10]).toBeUndefined();
  });
});
