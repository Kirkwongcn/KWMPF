import { describe, expect, it } from "vitest";
import { detectCandidateAnomalies } from "../src/candidate-anomalies";

const identity = { trusteeName: "T", schemeName: "S", constituentFundName: "F", fundClassName: "I" };
const base = { fundClassId: "a", identity, current: true, dataAsOf: "2026-06-30", returns: { 3: { annualized: 5, dataAsOf: "2026-06-30" } }, fundOverview: { fee: 0.8, monthlyReturn: 35, allocationTotal: 102 } };

describe("candidate anomaly report", () => {
  it("reports all configured data anomalies and versions the policy", () => {
    const result = detectCandidateAnomalies(
      [{ ...base, identity: { ...identity, fundClassName: "II" }, returns: { 3: { annualized: 6, dataAsOf: "2026-06-30" } }, fundOverview: { fee: 1, monthlyReturn: 35, allocationTotal: 102 } }],
      [base],
      [{ sourceType: "trustee_fund_list", consecutiveFailures: 2 }],
    );
    expect(result.policyVersion).toBe("2026-08-29.v3");
    expect(result.requiresReview).toBe(true);
    expect(new Set(result.anomalies.map((item) => item.kind))).toEqual(new Set(["identity_changed", "same_date_value_revised", "large_monthly_return", "allocation_total_out_of_range", "fee_changed", "source_failed_twice"]));
  });

  it("treats a whitespace-only source rewrite as the same identity", () => {
    const renamed = { ...base, identity: { ...identity, constituentFundName: " F  A " } };
    const original = { ...base, identity: { ...identity, constituentFundName: "F A" } };
    const result = detectCandidateAnomalies([renamed], [original], []);
    expect(result.anomalies.filter((item) => item.kind === "identity_changed")).toEqual([]);
  });

  it("reports a fee change on every configured platform fee field", () => {
    const before = { ...base, fundOverview: { managementFee: 1.2, latestFer: 1.67, oci1yHkd: 18 } };
    const after = { ...base, fundOverview: { managementFee: 1.2, latestFer: 1.71, oci1yHkd: 19 } };
    const result = detectCandidateAnomalies([after], [before], []);
    expect(result.anomalies.map((item) => item.field)).toEqual(["latestFer", "oci1yHkd"]);
  });

  it("reports a change in a newly parsed fee component", () => {
    const before = { ...base, fundOverview: { trusteeCustodianFee: 0.14, empfPlatformFee: 0.29, oci3yHkd: 46 } };
    const after = { ...base, fundOverview: { trusteeCustodianFee: 0.18, empfPlatformFee: 0.29, oci3yHkd: 52 } };
    const result = detectCandidateAnomalies([after], [before], []);
    expect(result.anomalies.map((item) => item.field)).toEqual(["oci3yHkd", "trusteeCustodianFee"]);
    expect(result.requiresReview).toBe(true);
  });

  it("reports a fee that stops being a single rate or stops being disclosed", () => {
    const before = { ...base, fundOverview: { managementFee: 1.18, trusteeCustodianFee: 0.14 } };
    const after = {
      ...base,
      fundOverview: { feeDisclosures: { managementFee: "1.18% p.a. - 1.8% p.a." } },
    };
    const result = detectCandidateAnomalies([after], [before], []);
    expect(result.anomalies.map((item) => [item.field, item.detail])).toEqual([
      ["managementFee", "managementFee 由 1.18 改為 1.18% p.a. - 1.8% p.a."],
      ["trusteeCustodianFee", "trusteeCustodianFee 由 0.14 改為 官方未再披露"],
    ]);
  });

  it("does not report a fee field that the parser newly started covering", () => {
    const before = { ...base, fundOverview: { managementFee: 1.18 } };
    const after = { ...base, fundOverview: { managementFee: 1.18, oci3yHkd: 46, empfPlatformFee: 0.29 } };
    const result = detectCandidateAnomalies([after], [before], []);
    expect(result.anomalies).toEqual([]);
    expect(result.requiresReview).toBe(false);
  });

  it("does not trigger review for a clean candidate", () => {
    const clean = { ...base, fundOverview: { fee: 0.8, monthlyReturn: 2, allocationTotal: 100 } };
    const result = detectCandidateAnomalies([clean], [clean], [{ sourceType: "trustee_fund_list", consecutiveFailures: 1 }]);
    expect(result).toEqual({ policyVersion: "2026-08-29.v3", anomalies: [], requiresReview: false });
  });
});
