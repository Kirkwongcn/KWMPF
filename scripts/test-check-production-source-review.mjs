#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const checker = path.join(
  scriptDirectory,
  "check-production-source-review.mjs",
);
const temporaryDirectory = fs.mkdtempSync(
  path.join(process.cwd(), ".tmp-source-review-"),
);
const sourcesRoot = path.join(temporaryDirectory, "sources");
const sourceDate = "2026-08-31";

const anomalyFixtures = [
  {
    kind: "fee_changed",
    fundClassId: "mpfa-cf-131",
    field: "oci1yHkd",
    detail: "oci1yHkd 由 17 改為 18",
  },
  {
    kind: "fee_changed",
    fundClassId: "mpfa-cf-1579",
    field: "latestFer",
    detail: "latestFer 由 1.24314 改為 1.24313",
  },
];

const sourceRecords = [
  {
    fundClassId: "mpfa-cf-131",
    dataAsOf: sourceDate,
    sourceUrl: "https://mfp.mpfa.org.hk/mobile/eng/cf_detail.jsp?cf_id=131",
    fundOverview: { oci1yHkd: 18 },
  },
  {
    fundClassId: "mpfa-cf-1579",
    dataAsOf: sourceDate,
    sourceUrl: "https://mfp.mpfa.org.hk/eng/cf_detail.jsp?cf_id=1579",
    fundOverview: { latestFer: 1.24313 },
  },
];

function makeReport(
  {
    outcome = "ready",
    publishable = true,
    requiresReview = false,
    candidateDataAsOf = sourceDate,
    sourceFailures = [],
    blockedRecords = 0,
    anomalies = requiresReview ? anomalyFixtures : [],
  } = {},
  date,
) {
  return {
    decision: {
      outcome,
      publishable,
      candidateDataAsOf,
      reasons: ["fixture decision"],
    },
    readiness: { ready: true, blockedRecords },
    audit: {
      batchId: `candidate-${date}`,
      requiresReview,
      anomalies,
      sourceFailures,
    },
  };
}

function writeBatch(date, reportOptions = {}, { includeReport = true } = {}) {
  const directory = path.join(sourcesRoot, date);
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });

  const sourceFile = path.join(directory, "mpf-fund-platform.json");
  const reportFile = path.join(directory, "refresh-report.json");
  const dispositionFile = path.join(directory, "review-disposition.json");
  const source = {
    sourceDataAsOf: sourceDate,
    records: sourceRecords,
  };
  const report = makeReport(reportOptions, date);

  fs.writeFileSync(sourceFile, JSON.stringify(source));
  if (includeReport) fs.writeFileSync(reportFile, JSON.stringify(report));

  return { directory, sourceFile, reportFile, dispositionFile };
}

function fileHash(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function makeDisposition(files) {
  const source = JSON.parse(fs.readFileSync(files.sourceFile, "utf8"));
  const report = JSON.parse(fs.readFileSync(files.reportFile, "utf8"));
  return {
    schemaVersion: 1,
    batchId: report.audit.batchId,
    sourceSnapshotSha256: fileHash(files.sourceFile),
    refreshReportSha256: fileHash(files.reportFile),
    reviewer: "fixture-reviewer",
    reviewedAt: "2026-09-29T00:00:00.000Z",
    decision: "accept",
    decisionReasons: report.decision.reasons,
    reason:
      "Each flagged value was checked against its official MPFA fund detail page.",
    anomalies: report.audit.anomalies.map((anomaly) => {
      const record = source.records.find(
        (item) => item.fundClassId === anomaly.fundClassId,
      );
      return {
        kind: anomaly.kind,
        fundClassId: anomaly.fundClassId,
        field: anomaly.field,
        reportDetail: anomaly.detail,
        candidateValue: record.fundOverview[anomaly.field],
        reviewedAsOf: source.sourceDataAsOf,
        evidenceUrl: record.sourceUrl,
        evidenceNote: `MPFA detail page matches ${anomaly.field} for ${anomaly.fundClassId}.`,
      };
    }),
  };
}

function addDisposition(files, transform = (value) => value) {
  const disposition = transform(makeDisposition(files));
  fs.writeFileSync(files.dispositionFile, JSON.stringify(disposition));
  return disposition;
}

function check(sourceSnapshot, allowOlder = "false") {
  return spawnSync(
    process.execPath,
    [checker, sourceSnapshot, allowOlder, sourcesRoot],
    { encoding: "utf8" },
  );
}

function assertFails(result, pattern) {
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, pattern);
}

try {
  fs.mkdirSync(sourcesRoot, { recursive: true });

  writeBatch("2026-09-26", { candidateDataAsOf: sourceDate });
  assert.equal(check("2026-09-26/mpf-fund-platform.json").status, 0);

  writeBatch("2026-09-27", {
    outcome: "needs_review",
    publishable: false,
    requiresReview: true,
  });
  assertFails(
    check("2026-09-27/mpf-fund-platform.json"),
    /has no review disposition/,
  );
  assertFails(
    check("2026-09-27/mpf-fund-platform.json", "true"),
    /has no review disposition/,
  );

  const reviewedFiles = writeBatch("2026-09-29", {
    outcome: "needs_review",
    publishable: false,
    requiresReview: true,
  });
  addDisposition(reviewedFiles);
  const accepted = check("2026-09-29/mpf-fund-platform.json");
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(
    accepted.stdout,
    /Review disposition: `accepted for this exact source and report`/,
  );

  addDisposition(reviewedFiles, (value) => {
    value.anomalies.pop();
    return value;
  });
  assertFails(
    check("2026-09-29/mpf-fund-platform.json"),
    /cover every reported anomaly exactly once/,
  );

  addDisposition(reviewedFiles, (value) => {
    value.anomalies[1] = { ...value.anomalies[0] };
    return value;
  });
  assertFails(
    check("2026-09-29/mpf-fund-platform.json"),
    /anomalies do not match the report exactly/,
  );

  addDisposition(reviewedFiles, (value) => {
    value.batchId = "different-batch";
    return value;
  });
  assertFails(
    check("2026-09-29/mpf-fund-platform.json"),
    /batchId does not match/,
  );

  addDisposition(reviewedFiles, (value) => {
    value.anomalies[0].reportDetail = "edited report detail";
    return value;
  });
  assertFails(
    check("2026-09-29/mpf-fund-platform.json"),
    /reportDetail does not match/,
  );

  addDisposition(reviewedFiles, (value) => {
    value.reviewedAt = "2099-01-01T00:00:00.000Z";
    return value;
  });
  assertFails(
    check("2026-09-29/mpf-fund-platform.json"),
    /reviewedAt is in the future/,
  );

  addDisposition(reviewedFiles, (value) => {
    value.anomalies[0].candidateValue = 17;
    return value;
  });
  assertFails(
    check("2026-09-29/mpf-fund-platform.json"),
    /candidateValue does not match/,
  );

  addDisposition(reviewedFiles, (value) => {
    value.anomalies[0].evidenceUrl =
      "https://example.com/eng/cf_detail.jsp?cf_id=131";
    return value;
  });
  assertFails(
    check("2026-09-29/mpf-fund-platform.json"),
    /evidence URL is not the official MPFA detail page/,
  );

  addDisposition(reviewedFiles, (value) => {
    value.anomalies[0].reviewedAsOf = "2026-07-31";
    return value;
  });
  assertFails(
    check("2026-09-29/mpf-fund-platform.json"),
    /reviewedAsOf does not match the source date/,
  );

  addDisposition(reviewedFiles);
  fs.appendFileSync(reviewedFiles.sourceFile, " ");
  assertFails(
    check("2026-09-29/mpf-fund-platform.json"),
    /source snapshot hash does not match/,
  );

  const changedReportFiles = writeBatch("2026-09-29", {
    outcome: "needs_review",
    publishable: false,
    requiresReview: true,
  });
  addDisposition(changedReportFiles);
  fs.appendFileSync(changedReportFiles.reportFile, " ");
  assertFails(
    check("2026-09-29/mpf-fund-platform.json"),
    /refresh report hash does not match/,
  );

  const failureFiles = writeBatch("2026-09-29", {
    outcome: "needs_review",
    publishable: false,
    requiresReview: true,
    sourceFailures: ["source unavailable"],
  });
  addDisposition(failureFiles);
  assertFails(
    check("2026-09-29/mpf-fund-platform.json"),
    /records source failures/,
  );

  const blockedFiles = writeBatch("2026-09-29", {
    outcome: "needs_review",
    publishable: false,
    requiresReview: true,
    blockedRecords: 1,
  });
  addDisposition(blockedFiles);
  assertFails(
    check("2026-09-29/mpf-fund-platform.json"),
    /readiness is not approved/,
  );

  const noAnomalyFiles = writeBatch("2026-09-29", {
    outcome: "needs_review",
    publishable: false,
    requiresReview: true,
    anomalies: [],
  });
  addDisposition(noAnomalyFiles);
  assertFails(
    check("2026-09-29/mpf-fund-platform.json"),
    /cannot approve an empty anomaly list/,
  );

  const olderReviewedFiles = writeBatch("2026-09-28", {
    outcome: "needs_review",
    publishable: false,
    requiresReview: true,
  });
  addDisposition(olderReviewedFiles);
  assertFails(
    check("2026-09-28/mpf-fund-platform.json"),
    /older than 2026-09-29/,
  );
  assert.equal(check("2026-09-28/mpf-fund-platform.json", "true").status, 0);

  const noNewDataFiles = writeBatch("2026-09-30", {
    outcome: "no_new_data",
    publishable: false,
  });
  assert.equal(check("2026-09-30/mpf-fund-platform.json").status, 0);
  fs.writeFileSync(noNewDataFiles.dispositionFile, "{}");
  assertFails(
    check("2026-09-30/mpf-fund-platform.json"),
    /review disposition is unexpected/,
  );

  writeBatch("2026-09-25", { candidateDataAsOf: sourceDate });
  assertFails(
    check("2026-09-25/mpf-fund-platform.json"),
    /older than 2026-09-30/,
  );
  assert.equal(check("2026-09-25/mpf-fund-platform.json", "true").status, 0);

  writeBatch("2026-09-24", {}, { includeReport: false });
  assertFails(
    check("2026-09-24/mpf-fund-platform.json", "true"),
    /has no refresh report/,
  );

  writeBatch("2026-09-23", { candidateDataAsOf: "2026-08-30" });
  assertFails(
    check("2026-09-23/mpf-fund-platform.json", "true"),
    /does not match source date/,
  );

  assertFails(check("../2026-09-30/mpf-fund-platform.json"), /must use/);

  console.log("Production source review preflight checks passed.");
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
