import { describe, expect, it } from "vitest";
import { buildCandidateRankingReport } from "../src/candidate-ranking-report";

const record = {
  fundClassId: "fund-a",
  identity: { trusteeName: "Trustee", schemeName: "Scheme", constituentFundName: "Fund A", fundClassName: "Class I" },
  current: true,
  status: "verified" as const,
  dataAsOf: "2026-06-30",
};

const evidence = { fundClassId: "fund-a", fundType: "equity" as const, allocationProfile: "global-equity", sourceUrl: "https://official.test/fund-a", dataAsOf: "2026-06-30" };
const observation = { fundClassId: "fund-a", periodYears: 3 as const, annualized: 6.25, dataAsOf: "2025-12-31", sourceUrl: "https://official.test/returns.pdf", retrievedAt: "2026-08-13T00:00:00Z" };

describe("candidate ranking report", () => {
  it("joins only valid classified observations and produces a ranking", () => {
    const result = buildCandidateRankingReport([record], [evidence], [observation], "2026-08-13");
    expect(result.report).toMatchObject({ inputRecords: 1, classified: 1, validObservations: 1, appliedObservations: 1, invalidObservations: 0 });
    expect(result.ranking.rankings).toEqual([expect.objectContaining({ fundClassId: "fund-a", periodYears: 3, displayValue: "6.25%", rank: 1 })]);
  });

  it("keeps unclassified funds out of rankings while reporting the reason", () => {
    const result = buildCandidateRankingReport([record], [], [observation], "2026-08-13");
    expect(result.report).toMatchObject({ classified: 0, insufficientGroups: 1, appliedObservations: 1 });
    expect(result.ranking.rankings).toHaveLength(0);
    expect(result.ranking.exclusions).toEqual(expect.arrayContaining([expect.objectContaining({ fundClassId: "fund-a", periodYears: 3, reason: "pending_verification" })]));
  });

  it("fails closed on invalid observations without generating a ranked value", () => {
    const result = buildCandidateRankingReport([record], [evidence], [{ ...observation, sourceUrl: "http://unsafe.test/returns.pdf" }], "2026-08-13");
    expect(result.report).toMatchObject({ invalidObservations: 1, validObservations: 0, appliedObservations: 0 });
    expect(result.ranking.rankings).toHaveLength(0);
    expect(result.ranking.exclusions).toEqual(expect.arrayContaining([expect.objectContaining({ periodYears: 3, reason: "insufficient" })]));
  });
});
