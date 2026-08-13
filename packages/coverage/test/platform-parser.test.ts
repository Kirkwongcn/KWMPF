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

  it("extracts risk and public cost fields without inferring missing values", () => {
    const html = `<table>
      <tr><td>Name of MPF trustee</td><td>Trustee</td></tr>
      <tr><td>Name of MPF scheme</td><td>Scheme</td></tr>
      <tr><td>Name of the constituent fund</td><td>Fund</td></tr>
      <tr><td>Fund Class</td><td>Class I</td></tr>
      <tr><td>Fund Type</td><td>Equity</td></tr>
      <tr><td>Fund Type - Full Descriptor</td><td>Equity Fund</td></tr>
      <tr><td>Fund size (HKD Million)</td><td>As at 31 July 2026 10</td></tr>
      <tr><td>Risk Class</td><td>6</td></tr>
      <tr><td>Latest FER</td><td>1.30424%</td></tr>
      <tr><td>Management Fee</td><td>1.03% p.a.</td></tr>
      <tr><td>On-going Cost Illustration (OCI) – 1 Year</td><td>HKD 15</td></tr>
    </table>`;

    expect(parseFundDetail(html, 429).fundOverview).toEqual({
      riskClass: 6,
      latestFer: 1.30424,
      managementFee: 1.03,
      oci1yHkd: 15,
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

  it("preserves an official zero return while skipping an unavailable period", () => {
    const html = fixture("fund-detail.html")
      .replace("+6.09% p.a. / +6.09%", "0% p.a. / 0%")
      .replace("+1.23% p.a. / +13.04%", "n.a. / n.a.");
    const result = parseFundDetail(html, 219);

    expect(result.returns?.[1]).toEqual({
      annualized: 0,
      cumulative: 0,
      dataAsOf: "2026-06-30",
    });
    expect(result.returns?.[10]).toBeUndefined();
  });
});
