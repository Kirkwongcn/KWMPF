import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import fixture from "../../../fixtures/mpfa/cf-429.json";
import {
  archiveCandidate,
  publishCandidate,
  type FundClassFixture,
} from "../src/publication";

describe("publication snapshot", () => {
  const bindings = env as unknown as Parameters<typeof archiveCandidate>[0];
  const fundFixture = fixture as FundClassFixture;

  beforeEach(async () => {
    await bindings.DB.exec(`
      DROP TABLE IF EXISTS current_publication;
      DROP TABLE IF EXISTS fund_class_versions;
      DROP TABLE IF EXISTS publication_snapshots;
      DROP TABLE IF EXISTS candidate_batches;
      CREATE TABLE candidate_batches (batch_id TEXT PRIMARY KEY, status TEXT NOT NULL, raw_key TEXT NOT NULL, raw_sha256 TEXT NOT NULL);
      CREATE TABLE publication_snapshots (snapshot_id TEXT PRIMARY KEY, published_at TEXT NOT NULL);
      CREATE TABLE fund_class_versions (snapshot_id TEXT NOT NULL, fund_class_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY (snapshot_id, fund_class_id));
      CREATE TABLE current_publication (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), snapshot_id TEXT NOT NULL);
    `);
  });

  it("does not expose an archived candidate before publication", async () => {
    const archived = await archiveCandidate(bindings, fundFixture);

    expect(
      await (await bindings.RAW_ARCHIVE.get(archived.rawKey))?.json(),
    ).toEqual(fixture);

    const response = await SELF.fetch(
      "https://kwmpf.test/fund-classes/mpfa-cf-429-class-i",
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Fund class not found" });
  });

  it("publishes one verified snapshot with traceable provenance", async () => {
    const archived = await archiveCandidate(bindings, fundFixture);
    const snapshotId = await publishCandidate(bindings, fundFixture, archived);

    const response = await SELF.fetch(
      "https://kwmpf.test/fund-classes/mpfa-cf-429-class-i",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      snapshotId,
      fundClass: fixture.fundClass,
      provenance: {
        sourceUrl: fixture.source.url,
        dataAsOf: fixture.fundClass.dataAsOf,
        retrievedAt: fixture.source.retrievedAt,
        rawSha256: archived.sha256,
        verificationStatus: "verified",
      },
    });
  });

  it("does not publish an anomalous candidate without matching reviewer approval", async () => {
    const anomalous = {
      ...fundFixture,
      anomalyReport: { requiresReview: true, policyVersion: "2026-08-13.v1" },
    };
    const archived = await archiveCandidate(bindings, anomalous);
    await expect(
      publishCandidate(bindings, anomalous, archived),
    ).rejects.toThrow("requires reviewer approval");
    expect(
      await SELF.fetch("https://kwmpf.test/fund-classes/mpfa-cf-429-class-i"),
    ).toHaveProperty("status", 404);
  });

  it("publishes an anomalous candidate only with matching reviewer approval", async () => {
    const anomalous = {
      ...fundFixture,
      anomalyReport: { requiresReview: true, policyVersion: "2026-08-13.v1" },
    };
    const archived = await archiveCandidate(bindings, anomalous);
    await expect(
      publishCandidate(bindings, anomalous, archived, {
        reviewer: "required-reviewer",
        policyVersion: "2026-08-13.v1",
      }),
    ).resolves.toBe("snapshot-mpfa-cf-429-2026-06-30");
  });

  it("searches the current publication by fund, scheme, or trustee name", async () => {
    const archived = await archiveCandidate(bindings, fundFixture);
    await publishCandidate(bindings, fundFixture, archived);

    const response = await SELF.fetch("https://kwmpf.test/search?q=Principal");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: fundFixture.fundClass.id,
        fundClassName: fundFixture.fundClass.fundClassName,
        constituentFundName: fundFixture.fundClass.constituentFundName,
        schemeName: fundFixture.fundClass.schemeName,
        trusteeName: fundFixture.fundClass.trusteeName,
      },
    ]);
  });

  it("summarizes only verified fund classes by scheme", async () => {
    const archived = await archiveCandidate(bindings, fundFixture);
    await publishCandidate(bindings, fundFixture, archived);
    const response = await SELF.fetch("https://kwmpf.test/schemes");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        schemeName: fundFixture.fundClass.schemeName,
        trusteeName: fundFixture.fundClass.trusteeName,
        fundClassCount: 1,
        fundTypes: [fundFixture.fundClass.fundType],
        riskClassDistribution: { "6": 1 },
        funds: [
          {
            id: fundFixture.fundClass.id,
            constituentFundName: fundFixture.fundClass.constituentFundName,
            fundClassName: fundFixture.fundClass.fundClassName,
            fundType: fundFixture.fundClass.fundType,
            riskClass: fundFixture.fundClass.riskClass,
          },
        ],
      },
    ]);
  });

  it("keeps verified fund classes with unavailable risk data in scheme summaries", async () => {
    const { riskClass: _riskClass, ...fundClassWithoutRisk } =
      fundFixture.fundClass;
    const incomplete = { ...fundFixture, fundClass: fundClassWithoutRisk };
    const archived = await archiveCandidate(bindings, incomplete);
    await publishCandidate(bindings, incomplete, archived);
    const response = await SELF.fetch("https://kwmpf.test/schemes");

    expect(await response.json()).toEqual([
      expect.objectContaining({ riskClassDistribution: {} }),
    ]);
  });

  it("ranks one-year returns within the same comparison group using displayed precision", async () => {
    const snapshotId = "snapshot-ranking-test";
    await bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    )
      .bind(snapshotId, "2026-08-13T00:00:00Z")
      .run();
    const funds = [
      { id: "fund-a", name: "基金 A", value: 8.124 },
      { id: "fund-b", name: "基金 B", value: 8.123 },
      { id: "fund-c", name: "基金 C", value: 7.5 },
    ];
    for (const fund of funds) {
      await bindings.DB.prepare(
        "INSERT INTO fund_class_versions (snapshot_id, fund_class_id, payload) VALUES (?, ?, ?)",
      )
        .bind(
          snapshotId,
          fund.id,
          JSON.stringify({
            snapshotId,
            fundClass: {
              id: fund.id,
              fundClassName: fund.name,
              constituentFundName: fund.name,
              schemeName: "測試計劃",
              trusteeName: "測試受託人",
              fundCategory: "環球股票基金",
              annualizedReturn1y: fund.value,
              dataAsOf: "2026-07-31",
              verificationStatus: "verified",
            },
            provenance: {
              sourceUrl: `https://example.test/${fund.id}`,
              dataAsOf: "2026-07-31",
              verificationStatus: "verified",
            },
          }),
        )
        .run();
    }
    await bindings.DB.prepare(
      "INSERT INTO current_publication (singleton, snapshot_id) VALUES (1, ?)",
    )
      .bind(snapshotId)
      .run();

    const response = await SELF.fetch("https://kwmpf.test/rankings?period=1");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      snapshotId,
      periodYears: 1,
      methodology: {
        metric: "annualized_return",
        grouping: "comparison_group",
        sortDirection: "descending",
        displayPrecision: 2,
      },
      rankings: [
        expect.objectContaining({
          fundClassId: "fund-a",
          displayValue: "8.12%",
          rank: 1,
        }),
        expect.objectContaining({
          fundClassId: "fund-b",
          displayValue: "8.12%",
          rank: 1,
        }),
        expect.objectContaining({
          fundClassId: "fund-c",
          displayValue: "7.50%",
          rank: 3,
        }),
      ],
    });
  });
});
