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
