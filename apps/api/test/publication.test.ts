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
      freshness: expect.objectContaining({
        dataAsOf: fixture.fundClass.dataAsOf,
        graceDays: 45,
      }),
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
        fundType: fundFixture.fundClass.fundType,
        fundCategory: fundFixture.fundClass.fundCategory,
        riskClass: fundFixture.fundClass.riskClass,
        annualizedReturn1y: fundFixture.fundClass.annualizedReturn1y,
        managementFee: fundFixture.fundClass.managementFee,
        latestFer: fundFixture.fundClass.latestFer,
        dataAsOf: fundFixture.fundClass.dataAsOf,
      },
    ]);
  });

  async function publishBrowseFixture() {
    const snapshotId = "snapshot-browse-test";
    await bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    )
      .bind(snapshotId, "2026-08-13T00:00:00Z")
      .run();
    const funds = [
      {
        id: "equity-low",
        constituentFundName: "港股基金",
        fundType: "Equity Fund",
        fundCategory: "Hong Kong Equity Fund",
        trusteeName: "受託人甲",
        riskClass: 6,
      },
      {
        id: "equity-high",
        constituentFundName: "環球股票基金",
        fundType: "Equity Fund",
        fundCategory: "Global Equity Fund",
        trusteeName: "受託人乙",
        riskClass: 5,
      },
      {
        id: "bond-fund",
        constituentFundName: "債券基金",
        fundType: "Bond Fund",
        fundCategory: "Global Bond Fund",
        trusteeName: "受託人甲",
        riskClass: 3,
      },
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
              ...fund,
              schemeName: "瀏覽測試計劃",
              fundClassName: "Class A",
              dataAsOf: "2026-06-30",
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
  }

  it("browses the published funds by filter without a search term", async () => {
    await publishBrowseFixture();

    const results = (await (
      await SELF.fetch("https://kwmpf.test/search?fundType=Equity+Fund")
    ).json()) as { id: string }[];

    expect(results.map((result) => result.id).sort()).toEqual([
      "equity-high",
      "equity-low",
    ]);
  });

  it("combines filters with a search term", async () => {
    await publishBrowseFixture();

    const results = (await (
      await SELF.fetch(
        "https://kwmpf.test/search?q=基金&fundType=Equity+Fund&trustee=" +
          encodeURIComponent("受託人甲"),
      )
    ).json()) as { id: string }[];

    expect(results.map((result) => result.id)).toEqual(["equity-low"]);
  });

  it("filters by official risk class", async () => {
    await publishBrowseFixture();

    const results = (await (
      await SELF.fetch("https://kwmpf.test/search?riskClass=3")
    ).json()) as { id: string }[];

    expect(results.map((result) => result.id)).toEqual(["bond-fund"]);
  });

  it("returns nothing when neither a search term nor a filter is given", async () => {
    await publishBrowseFixture();

    const response = await SELF.fetch("https://kwmpf.test/search");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("lists the filter values available in the current publication", async () => {
    await publishBrowseFixture();

    const response = await SELF.fetch("https://kwmpf.test/filters");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      snapshotId: "snapshot-browse-test",
      fundTypes: ["Bond Fund", "Equity Fund"],
      trustees: ["受託人乙", "受託人甲"],
      riskClasses: [3, 5, 6],
    });
  });

  it("summarizes the published coverage for the landing page", async () => {
    const archived = await archiveCandidate(bindings, fundFixture);
    await publishCandidate(bindings, fundFixture, archived);

    const response = await SELF.fetch("https://kwmpf.test/summary");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      snapshotId: expect.any(String),
      fundClassCount: 1,
      schemeCount: 1,
      trusteeCount: 1,
      dataAsOf: { earliest: "2026-06-30", latest: "2026-06-30" },
    });
  });

  it("reports an empty summary when nothing is published", async () => {
    const response = await SELF.fetch("https://kwmpf.test/summary");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      snapshotId: null,
      fundClassCount: 0,
      schemeCount: 0,
      trusteeCount: 0,
      dataAsOf: null,
    });
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
        managementFee: {
          min: fundFixture.fundClass.managementFee,
          median: fundFixture.fundClass.managementFee,
          max: fundFixture.fundClass.managementFee,
          fundCount: 1,
        },
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

  it("summarizes official management fees per scheme over funds that publish one", async () => {
    const snapshotId = "snapshot-fee-test";
    await bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    )
      .bind(snapshotId, "2026-08-13T00:00:00Z")
      .run();
    const funds = [
      { id: "fund-a", fee: 0.75 },
      { id: "fund-b", fee: 1.55 },
      { id: "fund-c", fee: 1.05 },
      { id: "fund-d", fee: undefined },
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
              schemeName: "費用測試計劃",
              trusteeName: "測試受託人",
              constituentFundName: fund.id,
              fundClassName: "Class A",
              fundType: "Equity Fund",
              managementFee: fund.fee,
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

    const schemes = (await (
      await SELF.fetch("https://kwmpf.test/schemes")
    ).json()) as {
      managementFee: {
        min: number;
        median: number;
        max: number;
        fundCount: number;
      } | null;
    }[];

    expect(schemes[0]!.managementFee).toEqual({
      min: 0.75,
      median: 1.05,
      max: 1.55,
      fundCount: 3,
    });
  });

  it("reports no management fee summary when no fund publishes one", async () => {
    const archived = await archiveCandidate(bindings, {
      ...fundFixture,
      fundClass: (() => {
        const { managementFee: _fee, ...rest } = fundFixture.fundClass;
        return rest as typeof fundFixture.fundClass;
      })(),
    });
    await publishCandidate(
      bindings,
      {
        ...fundFixture,
        fundClass: (() => {
          const { managementFee: _fee, ...rest } = fundFixture.fundClass;
          return rest as typeof fundFixture.fundClass;
        })(),
      },
      archived,
    );

    const schemes = (await (
      await SELF.fetch("https://kwmpf.test/schemes")
    ).json()) as { managementFee: unknown }[];

    expect(schemes[0]!.managementFee).toBeNull();
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
      excludedStaleCount: 0,
      methodology: {
        metric: "annualized_return",
        grouping: "comparison_group",
        sortDirection: "descending",
        displayPrecision: 2,
        freshness: expect.objectContaining({ graceDays: 45 }),
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

  it("ranks five and ten year returns and excludes funds the source never published", async () => {
    const snapshotId = "snapshot-long-horizon";
    await bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    )
      .bind(snapshotId, "2026-08-13T00:00:00Z")
      .run();
    const funds = [
      { id: "fund-a", return5y: 6.1, return10y: 5.4 },
      { id: "fund-b", return5y: 7.2, return10y: undefined },
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
              fundClassName: fund.id,
              constituentFundName: fund.id,
              schemeName: "測試計劃",
              trusteeName: "測試受託人",
              fundCategory: "環球股票基金",
              annualizedReturn1y: 1,
              annualizedReturn5y: fund.return5y,
              annualizedReturn10y: fund.return10y,
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

    const fiveYear = (await (
      await SELF.fetch("https://kwmpf.test/rankings?period=5")
    ).json()) as { periodYears: number; rankings: { fundClassId: string }[] };
    expect(fiveYear.periodYears).toBe(5);
    expect(fiveYear.rankings.map((row) => row.fundClassId)).toEqual([
      "fund-b",
      "fund-a",
    ]);

    const tenYear = (await (
      await SELF.fetch("https://kwmpf.test/rankings?period=10")
    ).json()) as { periodYears: number; rankings: { fundClassId: string }[] };
    expect(tenYear.periodYears).toBe(10);
    expect(tenYear.rankings.map((row) => row.fundClassId)).toEqual(["fund-a"]);
  });

  it("explains that the official platform publishes no three year return", async () => {
    const response = await SELF.fetch("https://kwmpf.test/rankings?period=3");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Unsupported ranking period",
      supportedPeriods: [1, 5, 10],
      reason:
        "官方強積金基金平台沒有提供三年年率化回報，網站不會自行由其他期間推算。",
    });
  });

  const isoDaysAgo = (days: number) =>
    new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const publishFreshnessFixture = async (
    funds: {
      id: string;
      dataAsOf: string;
      freshnessPolicy?: { returnsGraceDays?: number };
    }[],
  ) => {
    const snapshotId = "snapshot-freshness";
    await bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    )
      .bind(snapshotId, "2026-08-13T00:00:00Z")
      .run();
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
              fundClassName: fund.id,
              constituentFundName: fund.id,
              schemeName: "測試計劃",
              trusteeName: "測試受託人",
              fundCategory: "環球股票基金",
              annualizedReturn1y: 9.99,
              dataAsOf: fund.dataAsOf,
              verificationStatus: "verified",
            },
            provenance: {
              sourceUrl: `https://example.test/${fund.id}`,
              dataAsOf: fund.dataAsOf,
              verificationStatus: "verified",
              ...(fund.freshnessPolicy
                ? { freshnessPolicy: fund.freshnessPolicy }
                : {}),
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
  };

  it("keeps a stale figure readable on the fund page but out of the ranking", async () => {
    await publishFreshnessFixture([
      { id: "fresh-fund", dataAsOf: isoDaysAgo(20) },
      { id: "stale-fund", dataAsOf: isoDaysAgo(200) },
    ]);

    const rankings = (await (
      await SELF.fetch("https://kwmpf.test/rankings?period=1")
    ).json()) as {
      methodology: { freshness: { graceDays: number; evaluatedOn: string } };
      rankings: { fundClassId: string }[];
    };
    expect(rankings.rankings.map((row) => row.fundClassId)).toEqual([
      "fresh-fund",
    ]);
    expect(rankings.methodology.freshness.graceDays).toBe(45);
    expect(rankings.methodology.freshness.evaluatedOn).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
    expect(rankings).toMatchObject({ excludedStaleCount: 1 });

    const detail = (await (
      await SELF.fetch("https://kwmpf.test/fund-classes/stale-fund")
    ).json()) as {
      fundClass: { annualizedReturn1y: number };
      freshness: { status: string; dataAsOf: string; graceDays: number };
    };
    expect(detail.fundClass.annualizedReturn1y).toBe(9.99);
    expect(detail.freshness).toMatchObject({
      status: "stale",
      dataAsOf: isoDaysAgo(200),
      graceDays: 45,
    });
  });

  it("marks a fresh fund verified on its detail page", async () => {
    await publishFreshnessFixture([
      { id: "fresh-fund", dataAsOf: isoDaysAgo(20) },
    ]);

    const detail = (await (
      await SELF.fetch("https://kwmpf.test/fund-classes/fresh-fund")
    ).json()) as { freshness: { status: string } };

    expect(detail.freshness.status).toBe("verified");
  });

  it("honours the freshness policy carried in the published snapshot", async () => {
    await publishFreshnessFixture([
      {
        id: "long-grace-fund",
        dataAsOf: isoDaysAgo(200),
        freshnessPolicy: { returnsGraceDays: 400 },
      },
    ]);

    const rankings = (await (
      await SELF.fetch("https://kwmpf.test/rankings?period=1")
    ).json()) as {
      methodology: { freshness: { graceDays: number } };
      rankings: { fundClassId: string }[];
    };

    expect(rankings.rankings.map((row) => row.fundClassId)).toEqual([
      "long-grace-fund",
    ]);
    expect(rankings.methodology.freshness.graceDays).toBe(400);
  });
});
