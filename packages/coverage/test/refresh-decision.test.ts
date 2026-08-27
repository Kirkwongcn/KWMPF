import { describe, expect, it } from "vitest";
import {
  decideRefresh,
  renderRefreshSummary,
  summarizeAnomalyKinds,
  type RefreshAudit,
  type RefreshReadiness,
} from "../src/refresh-decision";

const readyReadiness: RefreshReadiness = {
  ready: true,
  inputRecords: 451,
  acceptedRecords: 451,
  blockedRecords: 0,
  missingByField: {},
};

const cleanAudit: RefreshAudit = {
  batchId: "candidate-2026-08-31",
  policyVersion: "2026-08-27.v2",
  requiresReview: false,
  anomalies: [],
  affectedFundClassIds: [],
};

describe("refresh decision", () => {
  it("reports no new data when the source date has not moved", () => {
    const decision = decideRefresh({
      previousDataAsOf: "2026-07-31",
      candidateDataAsOf: "2026-07-31",
      readiness: readyReadiness,
      audit: cleanAudit,
    });
    expect(decision.outcome).toBe("no_new_data");
    expect(decision.publishable).toBe(false);
  });

  it("blocks a candidate that fails the publication preflight", () => {
    const decision = decideRefresh({
      previousDataAsOf: "2026-07-31",
      candidateDataAsOf: "2026-08-31",
      readiness: {
        ready: false,
        inputRecords: 451,
        acceptedRecords: 449,
        blockedRecords: 2,
        missingByField: { managementFee: 2 },
      },
      audit: cleanAudit,
    });
    expect(decision.outcome).toBe("blocked");
    expect(decision.publishable).toBe(false);
    expect(decision.reasons.join("\n")).toContain("managementFee");
  });

  it("requires review before a candidate with anomalies can publish", () => {
    const decision = decideRefresh({
      previousDataAsOf: "2026-07-31",
      candidateDataAsOf: "2026-08-31",
      readiness: readyReadiness,
      audit: {
        ...cleanAudit,
        requiresReview: true,
        anomalies: [
          { kind: "fee_changed", fundClassId: "mpfa-cf-102", field: "latestFer", detail: "" },
          { kind: "fee_changed", fundClassId: "mpfa-cf-103", field: "latestFer", detail: "" },
          { kind: "identity_changed", fundClassId: "mpfa-cf-104", detail: "" },
        ],
        affectedFundClassIds: ["mpfa-cf-102", "mpfa-cf-103", "mpfa-cf-104"],
      },
    });
    expect(decision.outcome).toBe("needs_review");
    expect(decision.publishable).toBe(false);
    expect(decision.reasons.join("\n")).toContain("費率改變：2 項");
  });

  it("marks a clean candidate with a new source date as publishable", () => {
    const decision = decideRefresh({
      previousDataAsOf: "2026-07-31",
      candidateDataAsOf: "2026-08-31",
      readiness: readyReadiness,
      audit: cleanAudit,
    });
    expect(decision.outcome).toBe("ready");
    expect(decision.publishable).toBe(true);
  });

  it("blocks before it reviews when a candidate both fails preflight and has anomalies", () => {
    const decision = decideRefresh({
      previousDataAsOf: "2026-07-31",
      candidateDataAsOf: "2026-08-31",
      readiness: { ...readyReadiness, ready: false, blockedRecords: 1 },
      audit: { ...cleanAudit, requiresReview: true, anomalies: [{ kind: "fee_changed", detail: "" }] },
    });
    expect(decision.outcome).toBe("blocked");
  });

  it("groups anomalies by kind, most frequent first", () => {
    expect(
      summarizeAnomalyKinds([
        { kind: "fee_changed", detail: "" },
        { kind: "identity_changed", detail: "" },
        { kind: "fee_changed", detail: "" },
      ]),
    ).toEqual([
      { kind: "fee_changed", count: 2 },
      { kind: "identity_changed", count: 1 },
    ]);
  });

  it("writes a summary that never claims the public site has changed", () => {
    const markdown = renderRefreshSummary(
      decideRefresh({
        previousDataAsOf: "2026-07-31",
        candidateDataAsOf: "2026-08-31",
        readiness: readyReadiness,
        audit: cleanAudit,
      }),
      {
        readiness: readyReadiness,
        audit: cleanAudit,
        snapshotPath: "data/sources/2026-08-31/mpf-fund-platform.json",
        expectedCounts: { fundClasses: 451, schemes: 24 },
        expectedCountsSource: "https://mfp.mpfa.org.hk/eng/mpp_download_asset_size.jsp",
      },
    );
    expect(markdown).toContain("2026-07-31");
    expect(markdown).toContain("**2026-08-31**");
    expect(markdown).toContain("Deploy production");
    expect(markdown).toContain("公開網站在此 PR 合併後仍然不會改變");
    expect(markdown).toContain("mpp_download_asset_size.jsp");
  });
});
