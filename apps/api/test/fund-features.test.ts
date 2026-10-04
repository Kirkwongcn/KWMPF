import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { daysSinceLaunch, featurePosition } from "../src/fund-features";

describe("same-type position", () => {
  const peers = [
    { fundClassId: "a", value: 900 },
    { fundClassId: "b", value: 500 },
    { fundClassId: "c", value: 500 },
    { fundClassId: "d", value: 120 },
    { fundClassId: "e", value: 40 },
  ];

  it("ranks from the declared end with shared ranks for equal values", () => {
    expect(featurePosition("fundSize", "c", peers, {})).toMatchObject({
      value: 500,
      rank: 2,
      peerCount: 5,
      quartile: 2,
      median: 500,
      min: 40,
      max: 900,
      order: "descending",
    });
    // 管理費由低到高：最平嗰隻係第一。
    expect(featurePosition("managementFee", "e", peers, {})).toMatchObject({
      rank: 1,
      quartile: 1,
    });
    expect(featurePosition("managementFee", "a", peers, {})).toMatchObject({
      rank: 5,
      quartile: 4,
    });
  });

  it("places a tied group by its middle, not its best rank", () => {
    // 12 隻有 9 隻收費一樣：顯示同名次第 1，但位置唔可以當首四分之一。
    const tiedPeers = [
      ...Array.from({ length: 9 }, (_, index) => ({
        fundClassId: `t${index}`,
        value: 0.5,
      })),
      { fundClassId: "x", value: 0.8 },
      { fundClassId: "y", value: 0.9 },
      { fundClassId: "z", value: 1.0 },
    ];
    expect(featurePosition("managementFee", "t0", tiedPeers, {})).toMatchObject(
      {
        rank: 1,
        quartile: 2,
      },
    );
  });

  it("gives no quartile when the type has too few eligible funds", () => {
    const position = featurePosition("fundSize", "a", peers.slice(0, 3), {});
    expect(position.rank).toBe(1);
    expect(position.quartile).toBeUndefined();
  });

  it("keeps the group statistics but no rank when the fund itself is stale or missing", () => {
    const stale = featurePosition("fundSize", "z", peers, {
      asOf: "2026-01-31",
      excludedReason: "stale",
    });
    expect(stale).toMatchObject({
      excludedReason: "stale",
      peerCount: 5,
      median: 500,
    });
    expect(stale.rank).toBeUndefined();
    expect(stale.value).toBeUndefined();
    expect(featurePosition("fundSize", "z", [], {})).toEqual({
      key: "fundSize",
      order: "descending",
      peerCount: 0,
      excludedReason: "missing",
    });
  });

  it("counts fund age in days so funds launched in the same year are not tied", () => {
    const on = new Date("2026-10-04T00:00:00Z");
    expect(daysSinceLaunch("2026-10-03", on)).toBe(1);
    expect(daysSinceLaunch("2000-12-01", on)).toBeGreaterThan(
      daysSinceLaunch("2000-12-31", on)!,
    );
    expect(daysSinceLaunch("2026-10-05", on)).toBeUndefined();
    expect(daysSinceLaunch("2000-12", on)).toBeUndefined();
  });
});

describe("GET /fund-classes/:id/features", () => {
  const bindings = env as unknown as { DB: D1Database };

  beforeEach(async () => {
    await bindings.DB.exec(`
      DROP TABLE IF EXISTS current_publication;
      DROP TABLE IF EXISTS fund_class_versions;
      CREATE TABLE fund_class_versions (snapshot_id TEXT NOT NULL, fund_class_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY (snapshot_id, fund_class_id));
      CREATE TABLE current_publication (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), snapshot_id TEXT NOT NULL);
    `);
  });

  const today = new Date().toISOString().slice(0, 10);
  async function publish(
    funds: {
      id: string;
      fundType?: string;
      size?: number;
      sizeAsOf?: string;
      fee?: number;
      risk?: number;
      launchDate?: string;
    }[],
  ) {
    const snapshotId = "snapshot-features";
    for (const fund of funds) {
      await bindings.DB.prepare(
        "INSERT INTO fund_class_versions (snapshot_id, fund_class_id, payload) VALUES (?, ?, ?)",
      )
        .bind(
          snapshotId,
          fund.id,
          JSON.stringify({
            fundClass: {
              id: fund.id,
              fundClassName: fund.id,
              constituentFundName: fund.id,
              schemeName: "測試計劃",
              trusteeName: "測試受託人",
              fundCategory: "股票基金",
              fundType: fund.fundType ?? "Equity Fund - Hong Kong Equity Fund",
              ...(fund.size !== undefined
                ? {
                    fundSizeHkdMillion: fund.size,
                    fundSizeAsOf: fund.sizeAsOf ?? today,
                  }
                : {}),
              ...(fund.fee !== undefined ? { managementFee: fund.fee } : {}),
              ...(fund.risk !== undefined
                ? { fundRiskIndicator: fund.risk }
                : {}),
              ...(fund.launchDate ? { launchDate: fund.launchDate } : {}),
              dataAsOf: today,
              verificationStatus: "verified",
            },
            provenance: {
              sourceUrl: `https://example.test/${fund.id}`,
              dataAsOf: today,
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

  it("positions the fund within its MPFA fund type only, leaving out stale peers", async () => {
    await publish([
      { id: "own", size: 300, fee: 0.8, risk: 20, launchDate: "2000-12-01" },
      { id: "big", size: 900, fee: 0.99, risk: 25, launchDate: "2010-01-01" },
      { id: "small", size: 50, fee: 0.5, risk: 18, launchDate: "2015-06-01" },
      { id: "mid", size: 120, fee: 0.7, risk: 22, launchDate: "2005-01-01" },
      // 過期：唔參與規模比較。
      { id: "stale", size: 5000, sizeAsOf: "2020-01-31", fee: 1.2, risk: 30 },
      // 另一個積金局基金類型：唔同組。
      {
        id: "bond",
        fundType: "Bond Fund - Global Bond Fund",
        size: 9999,
        fee: 0.1,
        risk: 2,
      },
    ]);

    const response = await SELF.fetch(
      "https://kwmpf.test/fund-classes/own/features",
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      comparisonGroup: string;
      groupMemberCount: number;
      positions: {
        key: string;
        rank?: number;
        peerCount: number;
        quartile?: number;
        value?: number;
      }[];
    };
    expect(body.comparisonGroup).toBe("股票基金 - 香港股票基金");
    expect(body.groupMemberCount).toBe(5);
    const byKey = Object.fromEntries(
      body.positions.map((position) => [position.key, position]),
    );
    expect(byKey.fundSize).toMatchObject({
      value: 300,
      rank: 2,
      peerCount: 4,
      quartile: 2,
    });
    expect(byKey.fundAge).toMatchObject({ rank: 1, peerCount: 4, quartile: 1 });
    expect(byKey.volatility).toMatchObject({
      value: 20,
      rank: 2,
      peerCount: 5,
    });
    expect(byKey.managementFee).toMatchObject({
      value: 0.8,
      rank: 3,
      peerCount: 5,
    });
    expect(body.positions.map((position) => position.key)).toEqual([
      "fundSize",
      "fundAge",
      "volatility",
      "managementFee",
    ]);
  });

  it("returns the stale value with its date instead of ranking it", async () => {
    await publish([
      { id: "own", size: 300, sizeAsOf: "2020-01-31" },
      { id: "peer", size: 100 },
    ]);
    const body = (await (
      await SELF.fetch("https://kwmpf.test/fund-classes/own/features")
    ).json()) as { positions: Record<string, unknown>[] };
    expect(
      body.positions.find((position) => position.key === "fundSize"),
    ).toMatchObject({
      excludedReason: "stale",
      staleValue: 300,
      asOf: "2020-01-31",
      peerCount: 1,
    });
  });

  it("keeps unverified funds out of the comparison, as rankings do", async () => {
    await publish([
      { id: "own", size: 300 },
      { id: "peer", size: 100 },
    ]);
    await bindings.DB.prepare(
      "UPDATE fund_class_versions SET payload = json_remove(payload, '$.provenance.verificationStatus') WHERE fund_class_id = 'peer'",
    ).run();
    const body = (await (
      await SELF.fetch("https://kwmpf.test/fund-classes/own/features")
    ).json()) as { positions: Record<string, unknown>[] };
    expect(
      body.positions.find((position) => position.key === "fundSize"),
    ).toMatchObject({
      rank: 1,
      peerCount: 1,
    });
    const peer = (await (
      await SELF.fetch("https://kwmpf.test/fund-classes/peer/features")
    ).json()) as { positions: Record<string, unknown>[] };
    expect(
      peer.positions.find((position) => position.key === "fundSize"),
    ).toMatchObject({
      excludedReason: "unverified",
    });
  });

  it("answers 404 for an unknown fund", async () => {
    await publish([{ id: "own" }]);
    expect(
      (await SELF.fetch("https://kwmpf.test/fund-classes/nope/features"))
        .status,
    ).toBe(404);
  });
});
