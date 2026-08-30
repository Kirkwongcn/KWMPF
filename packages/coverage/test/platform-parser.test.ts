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
      fundSizeHkdMillion: 3344.42,
      fundSizeAsOf: "2026-06-30",
      launchDate: "2006-09-01",
      calendarYearReturns: {
        2022: -21.22,
        2023: -12.7,
        2024: 15.08,
        2025: 34.98,
      },
      sinceLaunchReturn: {
        annualized: 5.72,
        cumulative: 203.2,
        dataAsOf: "2026-06-30",
      },
      unavailableFields: ["oci5yHkd", "calendarYearReturn2021"],
      fundOverview: {
        riskClass: 6,
        fundRiskIndicator: 18.49,
        latestFer: 1.30424,
        managementFee: 1.03,
        trusteeCustodianFee: 0.14,
        empfPlatformFee: 0.29,
        memberServicingFee: 0.2,
        investmentManagementFee: 0.4,
        guaranteeCharge: 0,
        joiningFee: 0,
        contributionCharge: 0,
        bidSpread: 0,
        offerSpread: 0,
        withdrawalCharge: 0,
        oci1yHkd: 15,
        oci3yHkd: 46,
        feeCaps: ["trusteeCustodianFee"],
        feeDisclosures: {
          annualFee: [
            "(Based on Number of Members)",
            "1 to 14, Up to HKD3,000",
            "15 to 29, Up to HKD1,500",
            "30 or more HKD0",
          ].join("\n"),
        },
      },
    });
  });

  it("keeps an `Up to` disclosure as a cap rather than an actual rate", () => {
    const html = fixture("fund-detail.html").replace(
      "<td>1.03% p.a.</td>",
      "<td>Up to 1.205% p.a.</td>",
    );
    const overview = parseFundDetail(html, 429).fundOverview;

    expect(overview?.managementFee).toBe(1.205);
    expect(overview?.feeCaps).toContain("managementFee");
  });

  it("keeps a tiered fee disclosure as text instead of reading a tier boundary as the rate", () => {
    const overview = parseFundDetail(fixture("fund-detail.html"), 429)
      .fundOverview as { annualFee?: number; feeDisclosures?: Record<string, string> };

    expect(overview.annualFee).toBeUndefined();
    expect(overview.feeDisclosures?.annualFee).toContain("Based on Number of Members");
  });

  it("keeps the official line breaks so a tier boundary never merges into the amount above it", () => {
    const overview = parseFundDetail(fixture("fund-detail.html"), 429)
      .fundOverview as { feeDisclosures?: Record<string, string> };
    const annualFee = overview.feeDisclosures?.annualFee ?? "";

    expect(annualFee.split("\n")).toEqual([
      "(Based on Number of Members)",
      "1 to 14, Up to HKD3,000",
      "15 to 29, Up to HKD1,500",
      "30 or more HKD0",
    ]);
    expect(annualFee).not.toContain("HKD3,00015");
    expect(annualFee).not.toContain("HKD1,50030");
  });

  it("keeps a footnote marker apart from the line it annotates", () => {
    const html = fixture("fund-detail.html").replace(
      "<tr><td>Joining Fee</td><td>0%</td></tr>",
      '<tr><td>Joining Fee</td><td align="center"><div align="left">Employer: Currently waived<br>Self-employed Person: HK$500 *<br>* The Trustee shall have full discretion to waive the joining fee.</div></td></tr>',
    );
    const overview = parseFundDetail(html, 429).fundOverview as {
      joiningFee?: number;
      feeDisclosures?: Record<string, string>;
    };

    expect(overview.joiningFee).toBeUndefined();
    expect(overview.feeDisclosures?.joiningFee).toBe(
      [
        "Employer: Currently waived",
        "Self-employed Person: HK$500 *",
        "* The Trustee shall have full discretion to waive the joining fee.",
      ].join("\n"),
    );
  });

  it("records an unavailable fee component instead of treating it as zero", () => {
    const result = parseFundDetail(fixture("fund-detail.html"), 429);

    expect(result.fundOverview?.oci5yHkd).toBeUndefined();
    expect(result.unavailableFields).toContain("oci5yHkd");
  });

  it("reads a fee label whose spacing or dash differs from the usual layout", () => {
    const html = fixture("fund-detail.html")
      .replace("Trustee Fee/ Custodian Fee", "Trustee Fee / Custodian Fee")
      .replace(
        "On-going Cost Illustration (OCI) – 3 Year",
        "On-going Cost Illustration (OCI) - 3 Year",
      );
    const overview = parseFundDetail(html, 429).fundOverview;

    expect(overview?.trusteeCustodianFee).toBe(0.14);
    expect(overview?.oci3yHkd).toBe(46);
  });

  it("keeps the fund size date apart from the return dates", () => {
    const html = fixture("fund-detail.html").replace(
      "3,344.42 (as at 30 June 2026)",
      "3,344.42 (as at 31 May 2026)",
    );
    const result = parseFundDetail(html, 429);

    expect(result.fundSizeAsOf).toBe("2026-05-31");
    expect(result.returns?.[1]?.dataAsOf).toBe("2026-06-30");
  });

  it("records an unavailable calendar year instead of treating it as zero", () => {
    const result = parseFundDetail(fixture("fund-detail.html"), 429);

    expect(result.calendarYearReturns?.["2021"]).toBeUndefined();
    expect(result.unavailableFields).toContain("calendarYearReturn2021");
  });

  it("reads a launch date written with a short month name", () => {
    const html = fixture("fund-detail.html").replace(
      "1 Sep 2006",
      "17 February 2025",
    );

    expect(parseFundDetail(html, 429).launchDate).toBe("2025-02-17");
  });

  it("fails loudly when the launch date is unreadable", () => {
    const html = fixture("fund-detail.html").replace("1 Sep 2006", "Sept 2006");

    expect(() => parseFundDetail(html, 429)).toThrow(
      "Launch Date is unreadable on cf_id 429",
    );
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

  const riskIndicatorHtml = (value: string) => `<table>
      <tr><td>Name of MPF trustee</td><td>Trustee</td></tr>
      <tr><td>Name of MPF scheme</td><td>Scheme</td></tr>
      <tr><td>Name of the constituent fund</td><td>Fund</td></tr>
      <tr><td>Fund Class</td><td>Class I</td></tr>
      <tr><td>Fund Type</td><td>Equity</td></tr>
      <tr><td>Fund Type - Full Descriptor</td><td>Equity Fund</td></tr>
      <tr><td>Fund size (HKD Million)</td><td>As at 31 July 2026 10</td></tr>
      <tr><td>Risk Class</td><td>6</td></tr>
      <tr><td><a href="mpp_glossary.jsp#fund_risk_indicator " target="_blank">Fund Risk Indicator</a></td><td><div align="left">${value}</div></td></tr>
    </table>`;

  it("reads the fund risk indicator as an annualized standard deviation percentage", () => {
    expect(
      parseFundDetail(riskIndicatorHtml("6.51%"), 429).fundOverview,
    ).toEqual({ riskClass: 6, fundRiskIndicator: 6.51 });
  });

  it("keeps a platform zero risk indicator as zero rather than dropping it", () => {
    expect(
      parseFundDetail(riskIndicatorHtml("0.00%"), 429).fundOverview,
    ).toEqual({ riskClass: 6, fundRiskIndicator: 0 });
  });

  // 成立不足三年的基金官方寫 `n.a.`，要走「資料不足」，不可當成 0 或用風險級別代替。
  it("records an unavailable risk indicator instead of substituting a number", () => {
    const record = parseFundDetail(riskIndicatorHtml("n.a."), 429);
    expect(record.fundOverview).toEqual({ riskClass: 6 });
    expect(record.unavailableFields).toContain("fundRiskIndicator");
  });

  // 風險指標不是收費，對不上格式不可退回 feeDisclosures，要報錯。
  it("fails explicitly when the risk indicator is not a percentage", () => {
    expect(() => parseFundDetail(riskIndicatorHtml("Up to 6.51%"), 429)).toThrow(
      /Fund Risk Indicator is unreadable on cf_id 429/,
    );
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
