import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SourceRecord } from "../src/build-coverage";
import {
  mergeReviewedFactsheets,
  verifyPlatformIdentity,
} from "../src/merge-reviewed-factsheets";
import { stageReturnCandidate } from "../src/stage-return-candidate";
import { expect, it } from "vitest";
import {
  compareAnnualized,
  latestAiaPdf,
} from "../src/annualized-factsheet-review";

const prefix =
  "https://www.aia.com.hk/content/dam/aia-mpf-prime-value-choice-fund-performance-review-";
it("discovers the latest report across a year change regardless of link order", () => {
  const months = ["jan-2027", "oct-2026", "dec-2026"];
  const html = months.map((m) => `<a href="${prefix}${m}.pdf"></a>`).join("");
  expect(
    latestAiaPdf(
      html +
        '<a href="https://example.com/aia-mpf-prime-value-choice-fund-performance-review-dec-2029.pdf"></a>',
    ),
  ).toBe(prefix + "jan-2027.pdf");
  expect(() => latestAiaPdf("")).toThrow();
});

const target = {
  id: "test",
  scheme: "MASS",
  name: "Example Fund",
  url: "https://example.test/a.pdf",
};
const prior = {
  fundClassId: "test",
  periodYears: 3 as const,
  annualized: 2.47,
  dataAsOf: "2026-08-31",
  sourceUrl: target.url,
  retrievedAt: "2026-10-01",
};
const observation = {
  schemeName: target.scheme,
  constituentFundName: target.name,
  sourceUrl: target.url,
  dataAsOf: prior.dataAsOf,
  annualizedReturn3Year: prior.annualized,
};
it("detects replacement, stale source and same-date corrections without modifying the published baseline", () => {
  for (const [date, rate, status] of [
    ["2026-08-31", 2.47, "unchanged"],
    ["2026-09-30", 2.47, "newer"],
    ["2026-10-31", 1.1, "newer"],
    ["2026-08-31", 2.46, "same-date-revision"],
    ["2026-07-31", 3, "older"],
  ] as const) {
    expect(
      compareAnnualized(
        [target],
        [{ ...observation, dataAsOf: date, annualizedReturn3Year: rate }],
        [prior],
        "2026-11-12",
      )[0]?.status,
    ).toBe(status);
  }
  expect(prior.annualized).toBe(2.47);
});
it("rejects mismatched funds, partial sets and invalid or future dates", () => {
  for (const rows of [
    [],
    [{ ...observation, constituentFundName: "Other Fund" }],
    [{ ...observation, dataAsOf: "2026-09-31" }],
    [{ ...observation, dataAsOf: "2026-12-31" }],
  ]) {
    expect(() =>
      compareAnnualized([target], rows, [prior], "2026-11-12"),
    ).toThrow();
  }
});

it("still checks watched funds when a combined PDF adds another fund, rejecting duplicate matches", () => {
  const second = { ...target, id: "second", name: "Second Fund" };
  const targets = [target, second];
  const baseline = [prior, { ...prior, fundClassId: second.id }];
  const rows = [
    observation,
    { ...observation, constituentFundName: second.name },
    { ...observation, constituentFundName: "Additional Fund" },
  ];
  expect(() =>
    compareAnnualized(
      targets,
      [
        observation,
        {
          ...observation,
          constituentFundName: second.name,
          dataAsOf: "2026-09-30",
        },
      ],
      baseline,
      "2026-11-12",
    ),
  ).toThrow(/mixed performance dates/);
  expect(compareAnnualized(targets, rows, baseline, "2026-11-12")).toHaveLength(
    2,
  );
  expect(() =>
    compareAnnualized(targets, [...rows, observation], baseline, "2026-11-12"),
  ).toThrow(/ambiguous/);
});

const platform = (id: string): SourceRecord => ({
  fundClassId: id,
  current: true,
  dataAsOf: "2026-10-31",
  identity: {
    trusteeName: "trustee",
    schemeName: target.scheme,
    constituentFundName: target.name,
    fundClassName: "class",
  },
});
it("requires a unique current platform identity even when a PDF name still matches", () => {
  expect(() =>
    verifyPlatformIdentity(target, [platform(target.id)]),
  ).not.toThrow();
  expect(() => verifyPlatformIdentity(target, [platform("changed")])).toThrow(
    /identity/,
  );
  expect(() =>
    verifyPlatformIdentity(target, [platform(target.id), platform("also")]),
  ).toThrow(/ambiguous/);
});
it("advances only verified later dates and preserves independent values, conflicts and source evidence", () => {
  const ids = ["ok", "revision", "unchanged", "platform", "monthly"];
  const base = ids.map((fundClassId) => ({ ...prior, fundClassId }));
  const records = ids.map(platform);
  records[3]!.returns = { 3: { dataAsOf: "2026-09-30", annualized: 9 } };
  const rows = base.map(
    (old, i) =>
      compareAnnualized(
        [{ ...target, id: old.fundClassId }],
        [
          {
            ...observation,
            dataAsOf: i === 1 || i === 2 ? old.dataAsOf : "2026-09-30",
            annualizedReturn3Year: i === 2 ? old.annualized : 3.71,
          },
        ],
        [old],
        "2026-11-13",
      )[0]!,
  );
  const source = {
    url: target.url,
    sha256: "a".repeat(64),
    retrievedAt: "2026-11-13T00:00:00Z",
    additionalFundNames: [],
    rows,
  };
  const review = {
    summary: { checked: 5, newer: 3, revisions: 1, older: 0, failures: 0 },
    reports: [source],
    errors: [],
  };
  const result = mergeReviewedFactsheets(
    base,
    review,
    records,
    new Set(["monthly"]),
  );
  expect(result.report.applied).toEqual(["ok"]);
  expect(result.report.quarantined.map((x) => x.fundClassId)).toEqual([
    "platform",
    "monthly",
  ]);
  expect(result.annualized[0]).toMatchObject({
    annualized: 3.71,
    dataAsOf: "2026-09-30",
    sourceUrl: target.url,
    sourceSha256: source.sha256,
    retrievedAt: source.retrievedAt,
  });
  expect(result.annualized.slice(1)).toEqual(base.slice(1));
  expect(() =>
    mergeReviewedFactsheets(result.annualized, review, records, new Set()),
  ).toThrow(/different base/);
});
it("reuses the same day's candidate path without destroying an unchanged candidate or report", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kwmpf-candidate-"));
  const files = ["canonical", "built", "built-report", "canonical-report"].map(
    (name) => join(dir, name),
  );
  const [canonical, built, report, destination] = files as [
    string,
    string,
    string,
    string,
  ];
  try {
    await Promise.all([
      writeFile(canonical, '[{ "a": 1, "b": 2 }]'),
      writeFile(built, '[{"b":2,"a":1}]'),
      writeFile(report, "new report"),
      writeFile(destination, "original report"),
    ]);
    const stage = () =>
      stageReturnCandidate(canonical, built, report, canonical, destination);
    expect(await stage()).toBe(false);
    expect(await readFile(destination, "utf8")).toBe("original report");
    expect(await readFile(canonical, "utf8")).toBe('[{ "a": 1, "b": 2 }]');
    await writeFile(built, '[{"a":3}]');
    expect(await stage()).toBe(true);
    expect(await readFile(canonical, "utf8")).toBe('[{"a":3}]');
    expect(await readFile(destination, "utf8")).toBe("new report");
    expect(await stage()).toBe(false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
