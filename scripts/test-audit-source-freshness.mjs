import { test } from "node:test";
import assert from "node:assert/strict";
import { dateAge, auditSourceFreshness } from "./audit-source-freshness.mjs";

const source = {
  sourceDataAsOf: "2026-08-31",
  records: [
    {
      fundClassId: "a",
      dataAsOf: "2026-08-31",
      returns: { 1: { annualized: 0 } },
    },
    { fundClassId: "b", dataAsOf: "2026-08-31", returns: {} },
  ],
};
test("real zero is eligible and missing is separate", () => {
  const report = auditSourceFreshness(source, [], "2026-09-30");
  assert.deepEqual(
    [report.returns[0].eligible, report.returns[0].missing],
    [1, 1],
  );
});
test("period-specific overlay dates cross the 90-day boundary", () => {
  const observations = [
    {
      fundClassId: "a",
      periodYears: 3,
      annualized: 2.63,
      dataAsOf: "2026-06-30",
    },
  ];
  assert.equal(
    auditSourceFreshness(source, observations, "2026-09-28").returns[1]
      .eligible,
    1,
  );
  assert.equal(
    auditSourceFreshness(source, observations, "2026-09-29").returns[1].stale,
    1,
  );
});
test("monthly platform returns stay eligible through day 60 (ADR 0010)", () => {
  assert.equal(
    auditSourceFreshness(source, [], "2026-10-30").returns[0].eligible,
    1,
  );
  assert.equal(
    auditSourceFreshness(source, [], "2026-10-31").returns[0].stale,
    1,
  );
});
test("future and impossible dates are invalid", () => {
  for (const date of ["2026-02-31", "2026-10-01", "2026-2-3"]) {
    assert.equal(dateAge(date, "2026-09-30"), null);
  }
  assert.throws(
    () => auditSourceFreshness(source, [], "bad"),
    /Invalid evaluation date/,
  );
});
test("unmatched, duplicate and unsupported observations fail", () => {
  const row = {
    fundClassId: "a",
    periodYears: 3,
    annualized: 1,
    dataAsOf: "2026-07-31",
  };
  assert.throws(
    () =>
      auditSourceFreshness(
        source,
        [{ ...row, fundClassId: "unknown" }],
        "2026-09-30",
      ),
    /Unmatched/,
  );
  assert.throws(
    () => auditSourceFreshness(source, [row, row], "2026-09-30"),
    /Duplicate/,
  );
  assert.throws(
    () =>
      auditSourceFreshness(source, [{ ...row, periodYears: 2 }], "2026-09-30"),
    /Unsupported/,
  );
  assert.throws(
    () =>
      auditSourceFreshness(
        { ...source, records: [source.records[0], source.records[0]] },
        [],
        "2026-09-30",
      ),
    /Duplicate source/,
  );
});
