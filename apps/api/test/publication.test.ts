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
      DROP TABLE IF EXISTS comparison_group_stats;
      DROP TABLE IF EXISTS fund_class_versions;
      DROP TABLE IF EXISTS publication_snapshots;
      DROP TABLE IF EXISTS candidate_batches;
      CREATE TABLE candidate_batches (batch_id TEXT PRIMARY KEY, status TEXT NOT NULL, raw_key TEXT NOT NULL, raw_sha256 TEXT NOT NULL);
      CREATE TABLE publication_snapshots (snapshot_id TEXT PRIMARY KEY, published_at TEXT NOT NULL);
      CREATE TABLE fund_class_versions (snapshot_id TEXT NOT NULL, fund_class_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY (snapshot_id, fund_class_id));
      CREATE TABLE comparison_group_stats (snapshot_id TEXT NOT NULL, comparison_group TEXT NOT NULL, avg_allocation TEXT, avg_top10_concentration REAL, avg_volatility_3y REAL, fund_count INTEGER NOT NULL, allocation_count INTEGER NOT NULL, top10_count INTEGER NOT NULL, volatility_count INTEGER NOT NULL, insufficient_sample INTEGER NOT NULL, PRIMARY KEY (snapshot_id, comparison_group));
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
      comparisonGroup: "Hong Kong Equity",
      comparisonGroupSource: "lipper",
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

  it("ages the fund size against its own as-at date, not the return date", async () => {
    const withFundSizeDate = {
      ...fundFixture,
      fundClass: {
        ...fundFixture.fundClass,
        fundSizeAsOf: "2024-01-31",
        returnsAsOf: fundFixture.fundClass.dataAsOf,
        launchDate: "2006-09-01",
      },
    };
    const archived = await archiveCandidate(bindings, withFundSizeDate);
    await publishCandidate(bindings, withFundSizeDate, archived);

    const body = (await (
      await SELF.fetch("https://kwmpf.test/fund-classes/mpfa-cf-429-class-i")
    ).json()) as {
      fundSizeFreshness: {
        status: string;
        dataAsOf: string;
        graceDays: number;
      };
      fundClass: { launchDate: string };
    };

    expect(body.fundSizeFreshness).toMatchObject({
      status: "stale",
      dataAsOf: "2024-01-31",
      graceDays: 45,
    });
    expect(body.fundClass.launchDate).toBe("2006-09-01");
  });

  it("omits fund size freshness when the snapshot carries no fund size date", async () => {
    const archived = await archiveCandidate(bindings, fundFixture);
    await publishCandidate(bindings, fundFixture, archived);

    const body = (await (
      await SELF.fetch("https://kwmpf.test/fund-classes/mpfa-cf-429-class-i")
    ).json()) as Record<string, unknown>;

    expect(body).not.toHaveProperty("fundSizeFreshness");
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
        comparisonGroup: "Hong Kong Equity",
        comparisonGroupSource: "lipper",
        riskClass: fundFixture.fundClass.riskClass,
        fundRiskIndicator: fundFixture.fundClass.fundRiskIndicator,
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
        lipperCategory: "Hong Kong Equity",
        trusteeName: "受託人甲",
        riskClass: 6,
      },
      {
        id: "equity-high",
        constituentFundName: "環球股票基金",
        fundType: "Equity Fund",
        fundCategory: "Global Equity Fund",
        lipperCategory: "Global Equity",
        trusteeName: "受託人乙",
        riskClass: 5,
      },
      {
        // 計劃不在 Lipper 來源內，改以平台分類自成一組。
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
            classification: {
              provider: "Lipper",
              dataset: "Hong Kong Pension Fund Classification",
              capturedAt: "2026-08-27",
              official: false,
            },
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

  it("reports the true match count when the result list is capped", async () => {
    const snapshotId = "snapshot-capped-search";
    await bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    )
      .bind(snapshotId, "2026-08-13T00:00:00Z")
      .run();
    for (let index = 0; index < 62; index += 1) {
      const id = `capped-${String(index).padStart(3, "0")}`;
      await bindings.DB.prepare(
        "INSERT INTO fund_class_versions (snapshot_id, fund_class_id, payload) VALUES (?, ?, ?)",
      )
        .bind(
          snapshotId,
          id,
          JSON.stringify({
            snapshotId,
            fundClass: {
              id,
              fundClassName: "Class A",
              constituentFundName: `寬度測試基金 ${index}`,
              schemeName: "測試計劃",
              trusteeName: "測試受託人",
              fundType: "Equity Fund",
              fundCategory: "環球股票基金",
              lipperCategory: "Global Equity",
              riskClass: 5,
              dataAsOf: "2026-07-31",
              verificationStatus: "verified",
            },
            provenance: {
              sourceUrl: `https://example.test/${id}`,
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

    const response = await SELF.fetch(
      "https://kwmpf.test/search?q=" + encodeURIComponent("寬度測試基金"),
    );

    expect(response.headers.get("X-Total-Matches")).toBe("62");
    expect(((await response.json()) as unknown[]).length).toBe(50);
  });

  it("lets a browser on the site origin read the match count header", async () => {
    await publishBrowseFixture();

    const response = await SELF.fetch(
      "https://kwmpf.test/search?fundType=Equity+Fund",
    );

    expect(
      response.headers.get("Access-Control-Expose-Headers")?.toLowerCase(),
    ).toContain("x-total-matches");
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
      categories: ["Global Equity", "Hong Kong Equity", "平台分類：Bond Fund"],
      classification: {
        provider: "Lipper",
        dataset: "Hong Kong Pension Fund Classification",
        capturedAt: "2026-08-27",
        official: false,
      },
      fundTypes: ["Bond Fund", "Equity Fund"],
      trustees: ["受託人乙", "受託人甲"],
      riskClasses: [3, 5, 6],
    });
  });

  it("filters by Lipper category and keeps schemes outside the source in their own group", async () => {
    await publishBrowseFixture();

    const grouped = (await (
      await SELF.fetch("https://kwmpf.test/search?category=Hong+Kong+Equity")
    ).json()) as { id: string; comparisonGroupSource: string }[];
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({
      id: "equity-low",
      comparisonGroup: "Hong Kong Equity",
      comparisonGroupSource: "lipper",
    });

    const unmapped = (await (
      await SELF.fetch(
        "https://kwmpf.test/search?category=" +
          encodeURIComponent("平台分類：Bond Fund"),
      )
    ).json()) as { id: string; comparisonGroupSource: string }[];
    expect(unmapped).toHaveLength(1);
    expect(unmapped[0]).toMatchObject({
      id: "bond-fund",
      comparisonGroupSource: "platform",
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
        categories: ["Hong Kong Equity"],
        fundTypes: [fundFixture.fundClass.fundType],
        riskClassDistribution: { "6": 1 },
        managementFee: {
          min: fundFixture.fundClass.managementFee,
          median: fundFixture.fundClass.managementFee,
          max: fundFixture.fundClass.managementFee,
          fundCount: 1,
        },
        dataAsOf: {
          earliest: fundFixture.fundClass.dataAsOf,
          latest: fundFixture.fundClass.dataAsOf,
        },
        factSheet: null,
        funds: [
          {
            id: fundFixture.fundClass.id,
            constituentFundName: fundFixture.fundClass.constituentFundName,
            fundClassName: fundFixture.fundClass.fundClassName,
            fundType: fundFixture.fundClass.fundType,
            comparisonGroup: "Hong Kong Equity",
            riskClass: fundFixture.fundClass.riskClass,
            dataAsOf: fundFixture.fundClass.dataAsOf,
            sourceUrl: fundFixture.source.url,
            annualizedReturn1y: fundFixture.fundClass.annualizedReturn1y,
          },
        ],
      },
    ]);
  });

  it("exposes every published return horizon on each scheme fund", async () => {
    const snapshotId = "snapshot-scheme-returns";
    await bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    )
      .bind(snapshotId, "2026-08-24T00:00:00Z")
      .run();
    const funds = [
      { id: "fund-full", returns: { 1: 6.09, 3: 5.3, 5: 4.2, 10: 9.41 } },
      { id: "fund-short", returns: { 1: 2.5 } },
      { id: "fund-none", returns: {} },
    ] as { id: string; returns: Partial<Record<1 | 3 | 5 | 10, number>> }[];
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
              schemeName: "回報測試計劃",
              trusteeName: "測試受託人",
              constituentFundName: fund.id,
              fundClassName: "Class A",
              fundType: "Equity Fund",
              verificationStatus: "verified",
              ...(fund.returns[1] === undefined
                ? {}
                : { annualizedReturn1y: fund.returns[1] }),
              ...(fund.returns[3] === undefined
                ? {}
                : { annualizedReturn3y: fund.returns[3] }),
              ...(fund.returns[5] === undefined
                ? {}
                : { annualizedReturn5y: fund.returns[5] }),
              ...(fund.returns[10] === undefined
                ? {}
                : { annualizedReturn10y: fund.returns[10] }),
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
      funds: {
        id: string;
        annualizedReturn1y?: number;
        annualizedReturn3y?: number;
        annualizedReturn5y?: number;
        annualizedReturn10y?: number;
      }[];
    }[];

    const byId = new Map(schemes[0]!.funds.map((fund) => [fund.id, fund]));
    expect(byId.get("fund-full")).toMatchObject({
      annualizedReturn1y: 6.09,
      annualizedReturn3y: 5.3,
      annualizedReturn5y: 4.2,
      annualizedReturn10y: 9.41,
    });
    expect(byId.get("fund-short")).toMatchObject({ annualizedReturn1y: 2.5 });
    expect(byId.get("fund-short")).not.toHaveProperty("annualizedReturn5y");
    expect(byId.get("fund-short")).not.toHaveProperty("annualizedReturn10y");
    expect(byId.get("fund-none")).not.toHaveProperty("annualizedReturn1y");
  });

  it("carries the official fact sheet the seed recorded for each scheme", async () => {
    const snapshotId = "snapshot-scheme-fact-sheets";
    await bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    )
      .bind(snapshotId, "2026-08-28T00:00:00Z")
      .run();
    const schemesWithSheets = [
      {
        id: "listed-fund",
        schemeName: "已登記計劃",
        schemeFactSheet: {
          url: "https://www.mpfa.org.hk/assets/FF/MT00016.pdf",
          capturedAt: "2026-08-28",
          registerUrl:
            "https://www.mpfa.org.hk/en/info-centre/public-registers/registered-mpf-schemes",
        },
      },
      { id: "unlisted-fund", schemeName: "未有便覽的計劃" },
    ];
    for (const fund of schemesWithSheets) {
      await bindings.DB.prepare(
        "INSERT INTO fund_class_versions (snapshot_id, fund_class_id, payload) VALUES (?, ?, ?)",
      )
        .bind(
          snapshotId,
          fund.id,
          JSON.stringify({
            snapshotId,
            ...(fund.schemeFactSheet
              ? { schemeFactSheet: fund.schemeFactSheet }
              : {}),
            fundClass: {
              id: fund.id,
              schemeName: fund.schemeName,
              trusteeName: "測試受託人",
              constituentFundName: fund.id,
              fundClassName: "Class A",
              fundType: "Equity Fund",
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
    ).json()) as { schemeName: string; factSheet: unknown }[];
    const byScheme = new Map(
      schemes.map((scheme) => [scheme.schemeName, scheme.factSheet]),
    );

    expect(byScheme.get("已登記計劃")).toEqual(
      schemesWithSheets[0]!.schemeFactSheet,
    );
    expect(byScheme.get("未有便覽的計劃")).toBeNull();
  });

  it("serves the fact sheet allocation and holdings verbatim, with their own as-of date", async () => {
    const snapshotId = "snapshot-fact-sheet-disclosures";
    const factSheetDisclosure = {
      schemeName: "BCT (MPF) Pro Choice",
      constituentFundName: "Asian Equity Fund",
      factSheetFile: "MT00016.pdf",
      // 便覽落後平台快照幾個月，兩個日期各自保留，詳情頁先可以標示非完全可比。
      factSheetAsOf: "2025-12-31",
      allocations: [
        {
          heading: "ASSET ALLOCATION 資產分佈",
          entries: [{ label: "中國China", percent: 62.61 }],
        },
      ],
      topHoldings: [
        { rank: 1, security: "騰訊控股TENCENT HOLDINGS LTD", percent: 9.36 },
      ],
      unavailableFields: [],
      unavailableReasons: {},
    };
    await bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    )
      .bind(snapshotId, "2026-08-29T00:00:00Z")
      .run();
    const funds = [
      { id: "fund-disclosed", factSheetDisclosure },
      { id: "fund-undisclosed" },
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
            ...(fund.factSheetDisclosure
              ? { factSheetDisclosure: fund.factSheetDisclosure }
              : {}),
            fundClass: {
              id: fund.id,
              schemeName: "BCT (MPF) Pro Choice",
              trusteeName: "測試受託人",
              constituentFundName: fund.id,
              fundClassName: "Class A",
              fundType: "Equity Fund",
              dataAsOf: "2026-07-31",
              verificationStatus: "verified",
            },
            provenance: { dataAsOf: "2026-07-31" },
          }),
        )
        .run();
    }
    await bindings.DB.prepare(
      "INSERT INTO current_publication (singleton, snapshot_id) VALUES (1, ?)",
    )
      .bind(snapshotId)
      .run();

    const disclosed = (await (
      await SELF.fetch("https://kwmpf.test/fund-classes/fund-disclosed")
    ).json()) as {
      factSheetDisclosure: unknown;
      fundClass: { dataAsOf: string };
    };
    const undisclosed = await (
      await SELF.fetch("https://kwmpf.test/fund-classes/fund-undisclosed")
    ).json();

    expect(disclosed.factSheetDisclosure).toEqual(factSheetDisclosure);
    expect(disclosed.fundClass.dataAsOf).toBe("2026-07-31");
    expect(undisclosed).not.toHaveProperty("factSheetDisclosure");
  });

  it("serves the editorial asset-class buckets beside the verbatim fact sheet table", async () => {
    const snapshotId = "snapshot-mapped-allocation";
    const mappedAllocation = {
      official: false,
      mapVersion: "2026-09-08",
      asOf: "2026-05-31",
      sourceHeading: "ASSET ALLOCATION 資產分佈",
      buckets: { equity: 33, bond: 64.48, cashAndOther: 2.52 },
    };
    await bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    )
      .bind(snapshotId, "2026-08-29T00:00:00Z")
      .run();
    await bindings.DB.prepare(
      "INSERT INTO fund_class_versions (snapshot_id, fund_class_id, payload) VALUES (?, ?, ?)",
    )
      .bind(
        snapshotId,
        "fund-mapped",
        JSON.stringify({
          snapshotId,
          mappedAllocation,
          fundClass: {
            id: "fund-mapped",
            schemeName: "AIA MPF - Prime Value Choice",
            trusteeName: "測試受託人",
            constituentFundName: "Capital Stable Portfolio",
            fundClassName: "n.a.",
            fundType: "Mixed Assets Fund",
            dataAsOf: "2026-07-31",
            verificationStatus: "verified",
          },
          provenance: { dataAsOf: "2026-07-31" },
        }),
      )
      .run();
    await bindings.DB.prepare(
      "INSERT INTO current_publication (singleton, snapshot_id) VALUES (1, ?)",
    )
      .bind(snapshotId)
      .run();

    const body = (await (
      await SELF.fetch("https://kwmpf.test/fund-classes/fund-mapped")
    ).json()) as { mappedAllocation: unknown };

    expect(body.mappedAllocation).toEqual(mappedAllocation);
  });

  it("serves the DIS constituent-fund tag from the published payload", async () => {
    const snapshotId = "snapshot-dis-tag";
    await bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    )
      .bind(snapshotId, "2026-08-29T00:00:00Z")
      .run();
    await bindings.DB.prepare(
      "INSERT INTO fund_class_versions (snapshot_id, fund_class_id, payload) VALUES (?, ?, ?)",
    )
      .bind(
        snapshotId,
        "fund-dis",
        JSON.stringify({
          snapshotId,
          fundClass: {
            id: "fund-dis",
            schemeName: "AIA MPF - Prime Value Choice",
            trusteeName: "測試受託人",
            constituentFundName: "Core Accumulation Fund",
            fundClassName: "n.a.",
            fundType:
              "Mixed Assets Fund - Default Investment Strategy - Core Accumulation Fund",
            isDisComponent: "core_accumulation",
            dataAsOf: "2026-07-31",
            verificationStatus: "verified",
          },
          provenance: { dataAsOf: "2026-07-31" },
        }),
      )
      .run();
    await bindings.DB.prepare(
      "INSERT INTO current_publication (singleton, snapshot_id) VALUES (1, ?)",
    )
      .bind(snapshotId)
      .run();

    const body = (await (
      await SELF.fetch("https://kwmpf.test/fund-classes/fund-dis")
    ).json()) as { fundClass: { isDisComponent?: string } };

    expect(body.fundClass.isDisComponent).toBe("core_accumulation");
  });

  it("serves frozen comparison-group averages from the snapshot, not a live recalculation", async () => {
    const snapshotId = "snapshot-group-stats";
    await bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    )
      .bind(snapshotId, "2026-08-29T00:00:00Z")
      .run();
    await bindings.DB.prepare(
      "INSERT INTO current_publication (singleton, snapshot_id) VALUES (1, ?)",
    )
      .bind(snapshotId)
      .run();
    await bindings.DB.prepare(
      `INSERT INTO comparison_group_stats (
         snapshot_id, comparison_group, avg_allocation, avg_top10_concentration,
         avg_volatility_3y, fund_count, allocation_count, top10_count, volatility_count,
         insufficient_sample
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        snapshotId,
        "Hong Kong Equity",
        JSON.stringify({ equity: 92.5, bond: 2.5, cashAndOther: 5 }),
        31.2,
        18.4,
        12,
        8,
        10,
        12,
        0,
      )
      .run();
    await bindings.DB.prepare(
      `INSERT INTO comparison_group_stats (
         snapshot_id, comparison_group, avg_allocation, avg_top10_concentration,
         avg_volatility_3y, fund_count, allocation_count, top10_count, volatility_count,
         insufficient_sample
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        snapshotId,
        "平台分類：Guaranteed Fund",
        null,
        null,
        null,
        2,
        1,
        2,
        2,
        1,
      )
      .run();

    const all = (await (
      await SELF.fetch("https://kwmpf.test/comparison-group-stats")
    ).json()) as { snapshotId: string; groups: unknown[] };
    expect(all.snapshotId).toBe(snapshotId);
    expect(all.groups).toEqual([
      {
        comparisonGroup: "Hong Kong Equity",
        comparisonGroupSource: "lipper",
        avgAllocation: {
          official: false,
          equity: 92.5,
          bond: 2.5,
          cashAndOther: 5,
        },
        avgTop10Concentration: 31.2,
        avgVolatility3y: 18.4,
        fundCount: 12,
        allocationCount: 8,
        top10Count: 10,
        volatilityCount: 12,
        insufficientSample: false,
      },
      {
        comparisonGroup: "平台分類：Guaranteed Fund",
        comparisonGroupSource: "platform",
        avgAllocation: null,
        avgTop10Concentration: null,
        avgVolatility3y: null,
        fundCount: 2,
        allocationCount: 1,
        top10Count: 2,
        volatilityCount: 2,
        insufficientSample: true,
      },
    ]);

    const one = (await (
      await SELF.fetch(
        "https://kwmpf.test/comparison-group-stats?comparisonGroup=Hong%20Kong%20Equity",
      )
    ).json()) as { groups: Array<{ comparisonGroup: string }> };
    expect(one.groups).toHaveLength(1);
    expect(one.groups[0]?.comparisonGroup).toBe("Hong Kong Equity");

    const missing = await SELF.fetch(
      "https://kwmpf.test/comparison-group-stats?comparisonGroup=Missing",
    );
    expect(missing.status).toBe(404);
  });

  it("reports the data-as-of range of each scheme and the date behind each fund", async () => {
    const snapshotId = "snapshot-scheme-dates";
    await bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    )
      .bind(snapshotId, "2026-08-24T00:00:00Z")
      .run();
    const funds = [
      { id: "fund-june", scheme: "混合日期計劃", dataAsOf: "2026-06-30" },
      { id: "fund-july", scheme: "混合日期計劃", dataAsOf: "2026-07-31" },
      { id: "fund-may", scheme: "混合日期計劃", dataAsOf: "2026-05-31" },
      { id: "fund-single", scheme: "單一日期計劃", dataAsOf: "2026-07-31" },
      { id: "fund-undated", scheme: "無日期計劃", dataAsOf: undefined },
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
              schemeName: fund.scheme,
              trusteeName: "測試受託人",
              constituentFundName: fund.id,
              fundClassName: "Class A",
              fundType: "Equity Fund",
              verificationStatus: "verified",
              ...(fund.dataAsOf === undefined
                ? {}
                : { dataAsOf: fund.dataAsOf }),
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
      schemeName: string;
      dataAsOf: { earliest: string; latest: string } | null;
      funds: { id: string; dataAsOf?: string }[];
    }[];
    const byScheme = new Map(
      schemes.map((scheme) => [scheme.schemeName, scheme]),
    );

    expect(byScheme.get("混合日期計劃")!.dataAsOf).toEqual({
      earliest: "2026-05-31",
      latest: "2026-07-31",
    });
    expect(byScheme.get("單一日期計劃")!.dataAsOf).toEqual({
      earliest: "2026-07-31",
      latest: "2026-07-31",
    });
    expect(byScheme.get("無日期計劃")!.dataAsOf).toBeNull();

    const mixedFunds = new Map(
      byScheme.get("混合日期計劃")!.funds.map((fund) => [fund.id, fund]),
    );
    expect(mixedFunds.get("fund-june")!.dataAsOf).toBe("2026-06-30");
    expect(mixedFunds.get("fund-july")!.dataAsOf).toBe("2026-07-31");
    expect(byScheme.get("無日期計劃")!.funds[0]).not.toHaveProperty("dataAsOf");
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

  it("compares up to four schemes without double-counting fund classes as choices", async () => {
    const snapshotId = "snapshot-scheme-comparison";
    await bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    )
      .bind(snapshotId, "2026-09-10T00:00:00Z")
      .run();
    const funds = [
      {
        id: "core-a",
        constituentFundName: "Core Accumulation Fund",
        fundClassName: "Class A",
        component: "core_accumulation",
        fer: 0.72,
        returns: { annualizedReturn1y: 8.11, annualizedReturn3y: 5.2 },
      },
      {
        id: "core-t",
        constituentFundName: "Core Accumulation Fund",
        fundClassName: "Class T",
        component: "core_accumulation",
        fer: 0.68,
        returns: { annualizedReturn1y: 8.1, annualizedReturn3y: 5.2 },
      },
      {
        id: "age65",
        constituentFundName: "Age 65 Plus Fund",
        fundClassName: "Class A",
        component: "age65_plus",
        fer: 0.61,
        returns: { annualizedReturn1y: 3.2 },
      },
      {
        id: "other",
        constituentFundName: "Global Equity Fund",
        fundClassName: "Class A",
        fer: undefined,
        returns: {},
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
              id: fund.id,
              schemeName: "比較計劃",
              trusteeName: "比較受託人",
              constituentFundName: fund.constituentFundName,
              fundClassName: fund.fundClassName,
              fundType: "Mixed Assets Fund",
              verificationStatus: "verified",
              ...(fund.component ? { isDisComponent: fund.component } : {}),
              ...(fund.fer === undefined ? {} : { latestFer: fund.fer }),
              ...fund.returns,
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

    const response = await SELF.fetch(
      `https://kwmpf.test/schemes/compare?ids=${encodeURIComponent("比較計劃")}`,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      snapshotId,
      schemes: [
        expect.objectContaining({
          id: "比較計劃",
          trusteeName: "比較受託人",
          fundChoiceCount: 3,
          fundClassCount: 4,
          fer: { min: 0.61, median: 0.68, max: 0.72, fundCount: 3 },
          administrationScore: null,
          disPerformance: expect.objectContaining({
            status: "complete",
            missing: [],
            coreAccumulation: expect.objectContaining({
              returns: expect.objectContaining({
                "1y": { min: 8.1, max: 8.11, fundClassCount: 2 },
                "3y": { min: 5.2, max: 5.2, fundClassCount: 2 },
                "5y": null,
                "10y": null,
              }),
            }),
          }),
        }),
      ],
    });
  });

  it("rejects empty, excessive, and unknown scheme comparison ids", async () => {
    expect(
      await SELF.fetch("https://kwmpf.test/schemes/compare"),
    ).toHaveProperty("status", 400);
    expect(
      await SELF.fetch("https://kwmpf.test/schemes/compare?ids=a,b,c,d,e"),
    ).toHaveProperty("status", 400);

    const archived = await archiveCandidate(bindings, fundFixture);
    await publishCandidate(bindings, fundFixture, archived);
    const response = await SELF.fetch(
      "https://kwmpf.test/schemes/compare?ids=missing",
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Scheme not found",
      missingIds: ["missing"],
    });
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
              lipperCategory: "Global Equity",
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
      comparisonGroups: ["Global Equity"],
      metric: "return",
      periodYears: 1,
      excludedStaleCount: 0,
      methodology: {
        metric: "annualized_return",
        grouping: "comparison_group",
        classification: null,
        sortDirection: "descending",
        displayPrecision: 2,
        freshness: expect.objectContaining({ graceDays: 45 }),
      },
      rankings: [
        expect.objectContaining({
          fundClassId: "fund-a",
          comparisonGroup: "Global Equity",
          comparisonGroupSource: "lipper",
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

  it("ranks three, five and ten year returns and excludes funds the source never published", async () => {
    const snapshotId = "snapshot-long-horizon";
    await bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    )
      .bind(snapshotId, "2026-08-13T00:00:00Z")
      .run();
    const funds = [
      {
        id: "fund-a",
        return3y: 4.8,
        return5y: 6.1,
        return10y: 5.4,
      },
      {
        id: "fund-b",
        return3y: 5.9,
        return5y: 7.2,
        return10y: undefined,
      },
      {
        id: "fund-c",
        return3y: undefined,
        return5y: undefined,
        return10y: undefined,
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
              id: fund.id,
              fundClassName: fund.id,
              constituentFundName: fund.id,
              schemeName: "測試計劃",
              trusteeName: "測試受託人",
              fundCategory: "環球股票基金",
              lipperCategory: "Global Equity",
              annualizedReturn1y: 1,
              annualizedReturn3y: fund.return3y,
              annualizedReturn5y: fund.return5y,
              annualizedReturn10y: fund.return10y,
              returnSources: {
                "3": {
                  dataAsOf: "2026-07-31",
                  sourceUrl: `https://factsheet.example.test/${fund.id}`,
                },
              },
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

    const threeYear = (await (
      await SELF.fetch("https://kwmpf.test/rankings?period=3")
    ).json()) as {
      periodYears: number;
      rankings: { fundClassId: string; dataAsOf: string; sourceUrl: string }[];
    };
    expect(threeYear.periodYears).toBe(3);
    expect(threeYear.rankings.map((row) => row.fundClassId)).toEqual([
      "fund-b",
      "fund-a",
    ]);
    expect(threeYear.rankings[0]).toMatchObject({
      dataAsOf: "2026-07-31",
      sourceUrl: "https://factsheet.example.test/fund-b",
    });

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

  it("defaults to the one year period when the caller omits it", async () => {
    const snapshotId = "snapshot-default-period";
    await bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    )
      .bind(snapshotId, "2026-08-13T00:00:00Z")
      .run();
    await bindings.DB.prepare(
      "INSERT INTO fund_class_versions (snapshot_id, fund_class_id, payload) VALUES (?, ?, ?)",
    )
      .bind(
        snapshotId,
        "fund-a",
        JSON.stringify({
          snapshotId,
          fundClass: {
            id: "fund-a",
            fundClassName: "fund-a",
            constituentFundName: "fund-a",
            schemeName: "測試計劃",
            trusteeName: "測試受託人",
            fundCategory: "環球股票基金",
            lipperCategory: "Global Equity",
            annualizedReturn1y: 4.2,
            annualizedReturn5y: 6.1,
            annualizedReturn10y: 5.4,
            dataAsOf: "2026-07-31",
            verificationStatus: "verified",
          },
          provenance: {
            sourceUrl: "https://example.test/fund-a",
            dataAsOf: "2026-07-31",
            verificationStatus: "verified",
          },
        }),
      )
      .run();
    await bindings.DB.prepare(
      "INSERT INTO current_publication (singleton, snapshot_id) VALUES (1, ?)",
    )
      .bind(snapshotId)
      .run();

    const response = await SELF.fetch("https://kwmpf.test/rankings");

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      periodYears: number;
      rankings: { fundClassId: string; displayValue: string }[];
    };
    expect(body.periodYears).toBe(1);
    expect(body.rankings).toEqual([
      expect.objectContaining({ fundClassId: "fund-a", displayValue: "4.20%" }),
    ]);
  });

  it("rejects a period the caller supplied but the source cannot answer", async () => {
    const response = await SELF.fetch("https://kwmpf.test/rankings?period=1y");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Unsupported ranking period",
      supportedPeriods: [1, 3, 5, 10],
      reason: "回報排名只接受官方已披露的年率化期間：一年、三年、五年、十年。",
    });
  });

  const isoDaysAgo = (days: number) =>
    new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const insertPublication = async (
    snapshotId: string,
    funds: Record<string, unknown>[],
  ) => {
    await bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    )
      .bind(snapshotId, "2026-08-13T00:00:00Z")
      .run();
    for (const fund of funds) {
      await bindings.DB.prepare(
        "INSERT INTO fund_class_versions (snapshot_id, fund_class_id, payload) VALUES (?, ?, ?)",
      )
        .bind(snapshotId, fund.id as string, JSON.stringify(fund.payload))
        .run();
    }
    await bindings.DB.prepare(
      "INSERT INTO current_publication (singleton, snapshot_id) VALUES (1, ?)",
    )
      .bind(snapshotId)
      .run();
  };

  const publishFreshnessFixture = async (
    funds: {
      id: string;
      dataAsOf: string;
      freshnessPolicy?: { returnsGraceDays?: number };
    }[],
  ) => {
    const snapshotId = `snapshot-freshness-${crypto.randomUUID()}`;
    await insertPublication(
      snapshotId,
      funds.map((fund) => ({
        id: fund.id,
        payload: {
          snapshotId,
          fundClass: {
            id: fund.id,
            fundClassName: fund.id,
            constituentFundName: fund.id,
            schemeName: "測試計劃",
            trusteeName: "測試受託人",
            fundCategory: "環球股票基金",
            lipperCategory: "Global Equity",
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
        },
      })),
    );
  };

  const seedCostAndRiskSnapshot = async (
    snapshotId: string,
    dataAsOf = "2026-07-31",
    freshnessPolicy?: {
      returnsGraceDays?: number;
      fundOverviewGraceDays?: number;
    },
  ) => {
    // fund-b 與 fund-c 的風險級別同為 3，但風險指標不同：波幅排序要分得開它們，
    // 這正是改用風險指標而非風險級別的理由。fund-d 沒有指標（例如成立不足三年）。
    const funds = [
      {
        id: "fund-a",
        managementFee: 1.205,
        riskClass: 6,
        fundRiskIndicator: 18.49,
      },
      {
        id: "fund-b",
        managementFee: 0.65,
        riskClass: 3,
        fundRiskIndicator: 4.7,
      },
      {
        id: "fund-c",
        managementFee: 0.6504,
        riskClass: 3,
        fundRiskIndicator: 2.31,
      },
      {
        id: "fund-d",
        managementFee: undefined,
        riskClass: undefined,
        fundRiskIndicator: undefined,
      },
    ];
    await insertPublication(
      snapshotId,
      funds.map((fund) => ({
        id: fund.id,
        payload: {
          snapshotId,
          fundClass: {
            id: fund.id,
            fundClassName: fund.id,
            constituentFundName: fund.id,
            schemeName: "測試計劃",
            trusteeName: "測試受託人",
            fundCategory: "環球股票基金",
            lipperCategory: "Global Equity",
            annualizedReturn1y: 1,
            managementFee: fund.managementFee,
            riskClass: fund.riskClass,
            fundRiskIndicator: fund.fundRiskIndicator,
            dataAsOf,
            verificationStatus: "verified",
          },
          provenance: {
            sourceUrl: `https://example.test/${fund.id}`,
            dataAsOf,
            verificationStatus: "verified",
            ...(freshnessPolicy ? { freshnessPolicy } : {}),
          },
        },
      })),
    );
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

  it("ranks management fees from low to high without mixing in returns", async () => {
    await seedCostAndRiskSnapshot("snapshot-fee", isoDaysAgo(10));

    const response = await SELF.fetch("https://kwmpf.test/rankings?metric=fee");

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      metric: string;
      periodYears: number | null;
      methodology: Record<string, unknown>;
      rankings: { fundClassId: string; displayValue: string; rank: number }[];
    };
    expect(body.metric).toBe("fee");
    expect(body.periodYears).toBeNull();
    expect(body.methodology).toMatchObject({
      metric: "management_fee",
      grouping: "comparison_group",
      sortDirection: "ascending",
      displayPrecision: 2,
    });
    expect(
      body.rankings.map((row) => [row.fundClassId, row.displayValue, row.rank]),
    ).toEqual([
      ["fund-b", "0.65%", 1],
      ["fund-c", "0.65%", 1],
      ["fund-a", "1.21%", 3],
    ]);
  });

  it("ranks the official fund risk indicator from low to high as a separate volatility view", async () => {
    await seedCostAndRiskSnapshot("snapshot-risk", isoDaysAgo(10));

    const response = await SELF.fetch(
      "https://kwmpf.test/rankings?metric=risk",
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      metric: string;
      methodology: Record<string, unknown>;
      rankings: { fundClassId: string; displayValue: string; rank: number }[];
    };
    expect(body.metric).toBe("risk");
    expect(body.methodology).toMatchObject({
      metric: "fund_risk_indicator",
      grouping: "comparison_group",
      sortDirection: "ascending",
      displayPrecision: 2,
    });
    // 風險級別會把 fund-b 與 fund-c 並列第一；風險指標把它們分開，這是本票的重點。
    expect(
      body.rankings.map((row) => [row.fundClassId, row.displayValue, row.rank]),
    ).toEqual([
      ["fund-c", "2.31%", 1],
      ["fund-b", "4.70%", 2],
      ["fund-a", "18.49%", 3],
    ]);
  });

  it("leaves a fund without an official risk indicator out of the volatility ranking", async () => {
    await seedCostAndRiskSnapshot("snapshot-risk-missing", isoDaysAgo(10));

    const body = (await (
      await SELF.fetch("https://kwmpf.test/rankings?metric=risk")
    ).json()) as { rankings: { fundClassId: string }[] };

    // fund-d 沒有指標，不可當成 0 排第一，也不可用風險級別補位。
    expect(body.rankings.map((row) => row.fundClassId)).not.toContain("fund-d");
  });

  it("keeps the risk class filter working after the ranking switched metric", async () => {
    await seedCostAndRiskSnapshot("snapshot-risk-filter", isoDaysAgo(10));

    const body = (await (
      await SELF.fetch("https://kwmpf.test/search?riskClass=3")
    ).json()) as { id: string }[];

    expect(body.map((row) => row.id).sort()).toEqual(["fund-b", "fund-c"]);
  });

  it("applies the fund overview grace period, not the returns one, to fee and risk rankings", async () => {
    await seedCostAndRiskSnapshot("snapshot-overview-grace", isoDaysAgo(30), {
      returnsGraceDays: 45,
      fundOverviewGraceDays: 20,
    });

    const fee = (await (
      await SELF.fetch("https://kwmpf.test/rankings?metric=fee")
    ).json()) as {
      methodology: { freshness: { graceDays: number } };
      excludedStaleCount: number;
      rankings: unknown[];
    };

    expect(fee.methodology.freshness.graceDays).toBe(20);
    expect(fee.rankings).toEqual([]);
    expect(fee.excludedStaleCount).toBe(3);

    const returns = (await (
      await SELF.fetch("https://kwmpf.test/rankings?metric=return&period=1")
    ).json()) as {
      methodology: { freshness: { graceDays: number } };
      excludedStaleCount: number;
      rankings: unknown[];
    };

    expect(returns.methodology.freshness.graceDays).toBe(45);
    expect(returns.excludedStaleCount).toBe(0);
    expect(returns.rankings.length).toBeGreaterThan(0);
  });

  it("evaluates each fund's own fund-overview grace period instead of only the first fund's (#192)", async () => {
    const snapshotId = `snapshot-per-fund-grace-${crypto.randomUUID()}`;
    const dataAsOf = isoDaysAgo(30);
    const fundClass = (id: string, managementFee: number) => ({
      id,
      fundClassName: id,
      constituentFundName: id,
      schemeName: "測試計劃",
      trusteeName: "測試受託人",
      fundCategory: "環球股票基金",
      lipperCategory: "Global Equity",
      managementFee,
      dataAsOf,
      verificationStatus: "verified",
    });
    await insertPublication(snapshotId, [
      {
        id: "short-grace-fund",
        payload: {
          snapshotId,
          fundClass: fundClass("short-grace-fund", 1),
          provenance: {
            sourceUrl: "https://example.test/short-grace-fund",
            dataAsOf,
            verificationStatus: "verified",
            freshnessPolicy: { fundOverviewGraceDays: 20 },
          },
        },
      },
      {
        id: "long-grace-fund",
        payload: {
          snapshotId,
          fundClass: fundClass("long-grace-fund", 2),
          provenance: {
            sourceUrl: "https://example.test/long-grace-fund",
            dataAsOf,
            verificationStatus: "verified",
            freshnessPolicy: { fundOverviewGraceDays: 400 },
          },
        },
      },
    ]);

    const fee = (await (
      await SELF.fetch("https://kwmpf.test/rankings?metric=fee")
    ).json()) as {
      rankings: { fundClassId: string }[];
      excludedStaleCount: number;
    };

    // 30 日舊嘅資料超出 short-grace-fund 自己 20 日嘅寬限，但喺 long-grace-fund
    // 400 日嘅寬限之內——如果淨係用第一隻基金嘅政策代表全部（舊 bug），兩者會攞埋
    // 同一個結果（要不全部剔走、要不全部保留），唔會係「淨係 long-grace-fund 上榜」。
    expect(fee.rankings.map((row) => row.fundClassId)).toEqual([
      "long-grace-fund",
    ]);
    expect(fee.excludedStaleCount).toBe(1);
  });

  it("keeps fund overview figures ranking through a full official release cycle", async () => {
    await seedCostAndRiskSnapshot("snapshot-overview-cycle", isoDaysAgo(44));

    const fee = (await (
      await SELF.fetch("https://kwmpf.test/rankings?metric=fee")
    ).json()) as { excludedStaleCount: number; rankings: unknown[] };

    expect(fee.excludedStaleCount).toBe(0);
    expect(fee.rankings.length).toBeGreaterThan(0);
  });

  it("keeps the return metric as the default so existing links stay stable", async () => {
    await seedCostAndRiskSnapshot("snapshot-default-metric", isoDaysAgo(10));

    const body = (await (
      await SELF.fetch("https://kwmpf.test/rankings?period=1")
    ).json()) as { metric: string; periodYears: number };

    expect(body.metric).toBe("return");
    expect(body.periodYears).toBe(1);
  });

  it("rejects an unsupported ranking metric instead of guessing one", async () => {
    const response = await SELF.fetch(
      "https://kwmpf.test/rankings?metric=total_score",
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Unsupported ranking metric",
      supportedMetrics: ["return", "fee", "risk"],
      reason: "回報、費用及風險級別分開排序，網站不會合成單一推薦總分。",
    });
  });

  async function seedInterpretationSnapshot(options?: {
    insufficientSample?: boolean;
    missingFundValues?: boolean;
  }) {
    const snapshotId = `snapshot-interpretation-${options?.insufficientSample ? "small" : "full"}-${options?.missingFundValues ? "missing" : "values"}`;
    await bindings.DB.prepare(
      "INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (?, ?)",
    )
      .bind(snapshotId, "2026-09-10T00:00:00Z")
      .run();
    await bindings.DB.prepare(
      "INSERT INTO fund_class_versions (snapshot_id, fund_class_id, payload) VALUES (?, ?, ?)",
    )
      .bind(
        snapshotId,
        "interpretation-fund",
        JSON.stringify({
          snapshotId,
          fundClass: {
            id: "interpretation-fund",
            fundClassName: "Class A",
            constituentFundName: "測試基金",
            schemeName: "測試計劃",
            trusteeName: "測試受託人",
            fundType: "Equity Fund",
            fundCategory: "Hong Kong Equity Fund",
            lipperCategory: "Hong Kong Equity",
            verificationStatus: "verified",
            ...(options?.missingFundValues ? {} : { fundRiskIndicator: 17 }),
          },
          ...(options?.missingFundValues
            ? {}
            : {
                mappedAllocation: {
                  official: false,
                  mapVersion: "test",
                  asOf: "2026-06-30",
                  sourceHeading: "Asset Allocation",
                  buckets: { equity: 94, bond: 3, cashAndOther: 3 },
                },
                factSheetDisclosure: {
                  unavailableFields: [],
                  topHoldings: [
                    { rank: 1, security: "A", percent: 20 },
                    { rank: 2, security: "B", percent: 13 },
                  ],
                },
              }),
        }),
      )
      .run();
    await bindings.DB.prepare(
      `INSERT INTO comparison_group_stats (
         snapshot_id, comparison_group, avg_allocation, avg_top10_concentration,
         avg_volatility_3y, fund_count, allocation_count, top10_count, volatility_count,
         insufficient_sample
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        snapshotId,
        "Hong Kong Equity",
        JSON.stringify({ equity: 92, bond: 3, cashAndOther: 5 }),
        30,
        20,
        options?.insufficientSample ? 2 : 8,
        options?.insufficientSample ? 2 : 8,
        options?.insufficientSample ? 2 : 8,
        options?.insufficientSample ? 2 : 8,
        options?.insufficientSample ? 1 : 0,
      )
      .run();
    await bindings.DB.prepare(
      "INSERT INTO current_publication (singleton, snapshot_id) VALUES (1, ?)",
    )
      .bind(snapshotId)
      .run();
    return snapshotId;
  }

  it("returns snapshot-scoped fund values, group averages, and rule-based interpretations", async () => {
    const snapshotId = await seedInterpretationSnapshot();
    const response = await SELF.fetch(
      "https://kwmpf.test/fund-classes/interpretation-fund/interpretation",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      snapshotId,
      fundClassId: "interpretation-fund",
      comparisonGroup: "Hong Kong Equity",
      comparisonGroupSource: "lipper",
      values: {
        equity: { fund: 94, groupAverage: 92, official: false },
        top10Concentration: { fund: 33, groupAverage: 30 },
        volatility3y: { fund: 17, groupAverage: 20 },
      },
      interpretation: {
        thresholdVersion: "2026-09-10-trial-1",
        thresholdStatus: "trial",
        equity: {
          status: "similar",
          text: "股票配置（編輯歸類，非官方分類） 94%，與同組別平均相若。",
        },
        top10Concentration: {
          status: "higher",
          text: "十大持倉佔比 33%，比同組別平均高 3 個百分點。",
        },
        volatility3y: {
          status: "lower",
          text: "3年波幅 17%，比同組別平均低 3 個百分點。",
        },
      },
    });
  });

  it("returns explicit unavailable and insufficient-sample states", async () => {
    await seedInterpretationSnapshot({
      insufficientSample: true,
      missingFundValues: true,
    });
    const body = (await (
      await SELF.fetch(
        "https://kwmpf.test/fund-classes/interpretation-fund/interpretation",
      )
    ).json()) as {
      values: Record<string, { fund: number | null }>;
      interpretation: Record<string, { status?: string }>;
    };

    expect(
      Object.values(body.values).every((value) => value.fund === null),
    ).toBe(true);
    expect(body.interpretation.equity?.status).toBe("insufficient-sample");
    expect(body.interpretation.top10Concentration?.status).toBe(
      "insufficient-sample",
    );
    expect(body.interpretation.volatility3y?.status).toBe(
      "insufficient-sample",
    );
  });

  it("does not expose interpretation for an unpublished fund", async () => {
    const response = await SELF.fetch(
      "https://kwmpf.test/fund-classes/missing/interpretation",
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Fund class not found" });
  });

  it("rejects period parameters instead of pretending they change snapshot factors", async () => {
    const response = await SELF.fetch(
      "https://kwmpf.test/fund-classes/interpretation-fund/interpretation?period=3",
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Interpretation periods are not supported",
      reason:
        "資產配置、十大持倉集中度及三年波幅均為發布快照當期資料，不會隨回報期間改變。",
    });
  });
});
