#!/usr/bin/env node

import assert from "node:assert/strict";
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

function writeBatch(date, report, sourceDate = date) {
  const directory = path.join(sourcesRoot, date);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "mpf-fund-platform.json"),
    JSON.stringify({ sourceDataAsOf: sourceDate }),
  );
  if (report !== undefined) {
    fs.writeFileSync(
      path.join(directory, "refresh-report.json"),
      JSON.stringify(report),
    );
  }
}

function makeReport({
  outcome = "ready",
  publishable = true,
  requiresReview = false,
  candidateDataAsOf,
  sourceFailures = [],
} = {}) {
  return {
    decision: {
      outcome,
      publishable,
      candidateDataAsOf,
      reasons: ["fixture decision"],
    },
    readiness: { ready: true, blockedRecords: 0 },
    audit: { requiresReview, sourceFailures },
  };
}

function check(sourceSnapshot, allowOlder = "false") {
  return spawnSync(
    process.execPath,
    [checker, sourceSnapshot, allowOlder, sourcesRoot],
    { encoding: "utf8" },
  );
}

try {
  fs.mkdirSync(sourcesRoot, { recursive: true });
  writeBatch("2026-09-26", makeReport({ candidateDataAsOf: "2026-09-26" }));
  assert.equal(check("2026-09-26/mpf-fund-platform.json").status, 0);

  writeBatch(
    "2026-09-27",
    makeReport({
      outcome: "needs_review",
      publishable: false,
      requiresReview: true,
      candidateDataAsOf: "2026-09-27",
    }),
  );
  assert.match(
    check("2026-09-27/mpf-fund-platform.json").stderr,
    /anomalies requiring human review/,
  );
  assert.match(
    check("2026-09-27/mpf-fund-platform.json", "true").stderr,
    /anomalies requiring human review/,
  );

  writeBatch(
    "2026-09-28",
    makeReport({
      outcome: "no_new_data",
      publishable: false,
      candidateDataAsOf: "2026-09-28",
    }),
  );
  assert.equal(check("2026-09-28/mpf-fund-platform.json").status, 0);

  const blockedReadiness = makeReport({ candidateDataAsOf: "2026-09-28" });
  blockedReadiness.readiness = { ready: true, blockedRecords: 1 };
  writeBatch("2026-09-28", blockedReadiness);
  assert.match(
    check("2026-09-28/mpf-fund-platform.json").stderr,
    /readiness is not approved/,
  );

  writeBatch("2026-09-25", makeReport({ candidateDataAsOf: "2026-09-25" }));
  assert.match(
    check("2026-09-25/mpf-fund-platform.json").stderr,
    /older than 2026-09-28/,
  );
  assert.equal(check("2026-09-25/mpf-fund-platform.json", "true").status, 0);

  writeBatch("2026-09-24", undefined);
  assert.match(
    check("2026-09-24/mpf-fund-platform.json", "true").stderr,
    /has no refresh report/,
  );

  writeBatch("2026-09-23", makeReport({ candidateDataAsOf: "2026-09-22" }));
  assert.match(
    check("2026-09-23/mpf-fund-platform.json", "true").stderr,
    /does not match source date/,
  );

  assert.match(
    check("../2026-09-28/mpf-fund-platform.json").stderr,
    /must use/,
  );

  console.log("Production source review preflight checks passed.");
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
