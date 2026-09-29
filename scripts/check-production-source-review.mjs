#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [sourceSnapshot, allowOlder, sourcesRootArgument = "data/sources"] =
  process.argv.slice(2);

function fail(message) {
  console.error(`Production source preflight failed: ${message}`);
  process.exit(1);
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${label} is missing or invalid JSON (${error.message}).`);
  }
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

const reportFile = path.join(sourcesRoot, batch, "refresh-report.json");
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

const summaryLines = [
  "### Production source preflight",
  `- Requested source: \`${batch}/mpf-fund-platform.json\``,
  `- Data as of: \`${source.sourceDataAsOf}\``,
  `- Newest source batch: \`${newestBatch}\``,
  `- Older batch explicitly selected: \`${!isNewest}\``,
  `- Refresh decision: \`${decision.outcome}\``,
  `- Publishable: \`${decision.publishable}\``,
  `- Readiness: \`${readiness.ready}\``,
  `- Human review required: \`${audit.requiresReview}\``,
  ...decision.reasons.map((reason) => `- Report: ${JSON.stringify(reason)}`),
];
console.log(summaryLines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `${summaryLines.join("\n")}\n`,
  );
}

if (readiness.ready !== true || readiness.blockedRecords !== 0) {
  fail("refresh report readiness is not approved.");
}
if (audit.requiresReview !== false) {
  fail("refresh report contains anomalies requiring human review.");
}
if (!Array.isArray(audit.sourceFailures) || audit.sourceFailures.length !== 0) {
  fail(
    "refresh report records source failures or omits the source-failure check.",
  );
}

const publishableReady =
  decision.outcome === "ready" && decision.publishable === true;
const unchangedCleanBatch =
  decision.outcome === "no_new_data" && decision.publishable === false;
if (!publishableReady && !unchangedCleanBatch) {
  fail(
    `refresh report decision is ${decision.outcome ?? "missing"} ` +
      `(publishable: ${String(decision.publishable)}); ` +
      "only ready or clean no_new_data batches may be deployed.",
  );
}
