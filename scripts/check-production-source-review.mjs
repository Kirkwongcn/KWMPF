#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const [sourceSnapshot, allowOlder, sourcesRootArgument = "data/sources"] =
  process.argv.slice(2);

function fail(message) {
  console.error(`Production source preflight failed: ${message}`);
  process.exit(1);
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function validTimestamp(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${label} is missing or invalid JSON (${error.message}).`);
  }
}

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function anomalyKey(anomaly) {
  return JSON.stringify([anomaly.kind, anomaly.fundClassId, anomaly.field]);
}

function validateOfficialEvidenceUrl(value, fundClassId) {
  const match = /^mpfa-cf-(\d+)$/.exec(fundClassId ?? "");
  if (!match || typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "mfp.mpfa.org.hk" &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      url.hash === "" &&
      /^\/(mobile\/)?eng\/cf_detail\.jsp$/.test(url.pathname) &&
      url.searchParams.getAll("cf_id").length === 1 &&
      url.searchParams.get("cf_id") === match[1]
    );
  } catch {
    return false;
  }
}

function validateReviewDisposition({
  dispositionFile,
  sourceFile,
  reportFile,
  source,
  report,
}) {
  const disposition = readJson(dispositionFile, "review disposition");
  const anomalies = report.audit.anomalies;
  if (!Array.isArray(anomalies) || anomalies.length === 0) {
    fail("review disposition cannot approve an empty anomaly list.");
  }
  if (disposition.schemaVersion !== 1) {
    fail("review disposition has an unsupported schemaVersion.");
  }
  if (disposition.batchId !== report.audit.batchId) {
    fail("review disposition batchId does not match the refresh report.");
  }
  if (!/^[a-f0-9]{64}$/.test(disposition.sourceSnapshotSha256 ?? "")) {
    fail("review disposition has an invalid sourceSnapshotSha256.");
  }
  if (disposition.sourceSnapshotSha256 !== sha256(sourceFile)) {
    fail(
      "review disposition source snapshot hash does not match the source file.",
    );
  }
  if (!/^[a-f0-9]{64}$/.test(disposition.refreshReportSha256 ?? "")) {
    fail("review disposition has an invalid refreshReportSha256.");
  }
  if (disposition.refreshReportSha256 !== sha256(reportFile)) {
    fail(
      "review disposition refresh report hash does not match the report file.",
    );
  }
  if (
    typeof disposition.reviewer !== "string" ||
    disposition.reviewer.trim().length < 2
  ) {
    fail("review disposition must identify the reviewer.");
  }
  if (!validTimestamp(disposition.reviewedAt)) {
    fail("review disposition reviewedAt must be a UTC ISO timestamp.");
  }
  if (Date.parse(disposition.reviewedAt) > Date.now() + 5 * 60 * 1000) {
    fail("review disposition reviewedAt is in the future.");
  }
  if (disposition.decision !== "accept") {
    fail("review disposition decision must be accept.");
  }
  if (
    !Array.isArray(disposition.decisionReasons) ||
    disposition.decisionReasons.length !== report.decision.reasons.length ||
    disposition.decisionReasons.some(
      (reason, index) => reason !== report.decision.reasons[index],
    )
  ) {
    fail(
      "review disposition must reproduce every refresh decision reason exactly.",
    );
  }
  if (
    typeof disposition.reason !== "string" ||
    disposition.reason.trim().length < 20
  ) {
    fail("review disposition must include a substantive review reason.");
  }
  if (!Array.isArray(disposition.anomalies)) {
    fail("review disposition must list every reported anomaly.");
  }
  if (
    typeof report.audit.batchId !== "string" ||
    report.audit.batchId.trim().length === 0
  ) {
    fail("refresh report is missing its audit batchId.");
  }
  if (disposition.anomalies.length !== anomalies.length) {
    fail("review disposition must cover every reported anomaly exactly once.");
  }

  const reportedByKey = new Map();
  const supportedFields = new Set([
    "latestFer",
    "oci1yHkd",
    "oci3yHkd",
    "oci5yHkd",
  ]);
  for (const anomaly of anomalies) {
    if (
      !anomaly ||
      anomaly.kind !== "fee_changed" ||
      typeof anomaly.kind !== "string" ||
      typeof anomaly.fundClassId !== "string" ||
      !supportedFields.has(anomaly.field) ||
      typeof anomaly.detail !== "string"
    ) {
      fail("refresh report contains an invalid anomaly record.");
    }
    const key = anomalyKey(anomaly);
    if (reportedByKey.has(key)) {
      fail("refresh report contains duplicate anomaly records.");
    }
    reportedByKey.set(key, anomaly);
  }

  if (!Array.isArray(source.records)) {
    fail("source snapshot is missing its fund-class records.");
  }
  const sourceRecords = new Map();
  for (const record of source.records) {
    if (typeof record?.fundClassId !== "string") {
      fail("source snapshot contains a record without a fundClassId.");
    }
    if (sourceRecords.has(record.fundClassId)) {
      fail(
        `source snapshot contains duplicate records for ${record.fundClassId}.`,
      );
    }
    sourceRecords.set(record.fundClassId, record);
  }
  const seen = new Set();
  for (const item of disposition.anomalies) {
    if (
      !item ||
      typeof item.kind !== "string" ||
      typeof item.fundClassId !== "string" ||
      typeof item.field !== "string"
    ) {
      fail("review disposition contains an invalid anomaly record.");
    }
    const key = anomalyKey(item);
    const reported = reportedByKey.get(key);
    if (!reported || seen.has(key)) {
      fail("review disposition anomalies do not match the report exactly.");
    }
    seen.add(key);

    const record = sourceRecords.get(item.fundClassId);
    if (!record || record.dataAsOf !== source.sourceDataAsOf) {
      fail(
        `review disposition has no same-date source record for ${item.fundClassId}.`,
      );
    }
    if (
      !record.fundOverview ||
      !Object.hasOwn(record.fundOverview, item.field) ||
      typeof record.fundOverview[item.field] !== "number" ||
      !Number.isFinite(record.fundOverview[item.field]) ||
      item.candidateValue !== record.fundOverview[item.field]
    ) {
      fail(
        `review disposition candidateValue does not match ${item.fundClassId}.${item.field}.`,
      );
    }
    if (item.reportDetail !== reported.detail) {
      fail(
        `review disposition reportDetail does not match ${item.fundClassId}.${item.field}.`,
      );
    }
    if (item.reviewedAsOf !== source.sourceDataAsOf) {
      fail(
        `review disposition reviewedAsOf does not match the source date for ${item.fundClassId}.${item.field}.`,
      );
    }
    if (
      typeof item.evidenceNote !== "string" ||
      item.evidenceNote.trim().length < 10
    ) {
      fail(
        `review disposition is missing evidence notes for ${item.fundClassId}.${item.field}.`,
      );
    }
    if (
      item.evidenceUrl !== record.sourceUrl ||
      !validateOfficialEvidenceUrl(item.evidenceUrl, item.fundClassId)
    ) {
      fail(
        `review disposition evidence URL is not the official MPFA detail page for ${item.fundClassId}.`,
      );
    }
  }

  if (seen.size !== reportedByKey.size) {
    fail(
      "review disposition does not cover every reported anomaly exactly once.",
    );
  }
  return disposition;
}

if (!sourceSnapshot || !["true", "false"].includes(allowOlder)) {
  fail(
    "usage: check-production-source-review.mjs <YYYY-MM-DD/mpf-fund-platform.json> <true|false> [sources-root]",
  );
}

const match = /^(\d{4}-\d{2}-\d{2})\/mpf-fund-platform\.json$/.exec(
  sourceSnapshot,
);
if (!match || !validDate(match[1])) {
  fail("source snapshot must use YYYY-MM-DD/mpf-fund-platform.json.");
}

const batch = match[1];
const sourcesRoot = path.resolve(sourcesRootArgument);
const sourceFile = path.resolve(sourcesRoot, batch, "mpf-fund-platform.json");
const sourcePrefix = `${sourcesRoot}${path.sep}`;
if (!sourceFile.startsWith(sourcePrefix) || !fs.existsSync(sourceFile)) {
  fail(`requested source snapshot does not exist: ${sourceSnapshot}.`);
}

const batches = fs
  .readdirSync(sourcesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && validDate(entry.name))
  .map((entry) => entry.name)
  .filter((date) =>
    fs.existsSync(path.join(sourcesRoot, date, "mpf-fund-platform.json")),
  )
  .sort();
const newestBatch = batches.at(-1);
if (!newestBatch) {
  fail("no dated source snapshot exists in the source directory.");
}

const isNewest = batch === newestBatch;
if (!isNewest && allowOlder !== "true") {
  const message =
    `requested batch ${batch} is older than ${newestBatch}; ` +
    "the explicit older-snapshot option is required.";
  fail(message);
}

const batchDirectory = path.join(sourcesRoot, batch);
const reportFile = path.join(batchDirectory, "refresh-report.json");
const dispositionFile = path.join(batchDirectory, "review-disposition.json");
if (!fs.existsSync(reportFile)) {
  fail(`the source batch has no refresh report: ${batch}/refresh-report.json.`);
}

const source = readJson(sourceFile, "source snapshot");
const report = readJson(reportFile, "refresh report");
const decision = report?.decision;
const readiness = report?.readiness;
const audit = report?.audit;
if (!decision || !readiness || !audit) {
  fail("refresh report is missing decision, readiness, or audit details.");
}
if (!Array.isArray(decision.reasons)) {
  fail("refresh report is missing decision reasons.");
}
if (
  typeof source.sourceDataAsOf !== "string" ||
  !validDate(source.sourceDataAsOf)
) {
  fail("source snapshot has no valid sourceDataAsOf date.");
}
if (decision.candidateDataAsOf !== source.sourceDataAsOf) {
  fail(
    `refresh report date ${decision.candidateDataAsOf ?? "(missing)"} ` +
      `does not match source date ${source.sourceDataAsOf}.`,
  );
}
if (readiness.ready !== true || readiness.blockedRecords !== 0) {
  fail("refresh report readiness is not approved.");
}
if (!Array.isArray(audit.sourceFailures) || audit.sourceFailures.length !== 0) {
  fail(
    "refresh report records source failures or omits the source-failure check.",
  );
}

if (!Array.isArray(audit.anomalies)) {
  fail("refresh report omits its anomaly list.");
}
if (audit.requiresReview === false && audit.anomalies.length > 0) {
  fail("refresh report lists anomalies but does not require human review.");
}

const publishableReady =
  decision.outcome === "ready" && decision.publishable === true;
const unchangedCleanBatch =
  decision.outcome === "no_new_data" && decision.publishable === false;
let acceptedDisposition = false;

if (audit.requiresReview === true) {
  if (decision.outcome !== "needs_review" || decision.publishable !== false) {
    fail("human review is required but the report decision is inconsistent.");
  }
  if (!fs.existsSync(dispositionFile)) {
    fail(
      "refresh report contains anomalies requiring human review and has no review disposition.",
    );
  }
  validateReviewDisposition({
    dispositionFile,
    sourceFile,
    reportFile,
    source,
    report,
  });
  acceptedDisposition = true;
} else if (audit.requiresReview === false) {
  if (fs.existsSync(dispositionFile)) {
    fail(
      "review disposition is unexpected because the report requires no review.",
    );
  }
  if (!publishableReady && !unchangedCleanBatch) {
    fail(
      `refresh report decision is ${decision.outcome ?? "missing"} ` +
        `(publishable: ${String(decision.publishable)}); ` +
        "only ready or clean no_new_data batches may be deployed.",
    );
  }
} else {
  fail(
    "refresh report must explicitly state whether human review is required.",
  );
}

const summaryLines = [
  "### Production source preflight",
  `- Requested source: \`${batch}/mpf-fund-platform.json\``,
  `- Data as of: \`${source.sourceDataAsOf}\``,
  `- Newest source batch: \`${newestBatch}\``,
  `- Older batch explicitly selected: \`${!isNewest}\``,
  `- Refresh decision: \`${decision.outcome}\``,
  `- Publishable in refresh report: \`${decision.publishable}\``,
  `- Readiness: \`${readiness.ready}\``,
  `- Human review required in report: \`${audit.requiresReview}\``,
  `- Review disposition: \`${acceptedDisposition ? "accepted for this exact source and report" : "not required"}\``,
  ...decision.reasons.map((reason) => `- Report: ${JSON.stringify(reason)}`),
];
console.log(summaryLines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `${summaryLines.join("\n")}\n`,
  );
}
