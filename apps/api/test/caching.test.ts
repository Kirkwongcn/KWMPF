import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import fixture from "../../../fixtures/mpfa/cf-429.json";
import {
  archiveCandidate,
  publishCandidate,
  type FundClassFixture,
} from "../src/publication";
import { cacheKeyFor, currentPublicationVersion } from "../src/caching";

describe("edge caching", () => {
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

  it("lets the edge cache a published fund class and ties it to the snapshot", async () => {
    const archived = await archiveCandidate(bindings, fundFixture);
    const snapshotId = await publishCandidate(bindings, fundFixture, archived);

    const response = await SELF.fetch(
      "https://kwmpf.test/fund-classes/mpfa-cf-429-class-i",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=300, stale-while-revalidate=600",
    );
    expect(response.headers.get("ETag")).toBe(`"${snapshotId}"`);
  });

  it("never caches a response produced while nothing is published", async () => {
    const response = await SELF.fetch(
      "https://kwmpf.test/fund-classes/mpfa-cf-429-class-i",
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("ETag")).toBeNull();
  });

  it("caches every published list endpoint under the same snapshot tag", async () => {
    const archived = await archiveCandidate(bindings, fundFixture);
    const snapshotId = await publishCandidate(bindings, fundFixture, archived);

    for (const path of [
      "/search?q=a",
      "/filters",
      "/summary",
      "/schemes",
      "/rankings?period=1",
    ]) {
      const response = await SELF.fetch(`https://kwmpf.test${path}`);

      expect(response.status, path).toBe(200);
      expect(response.headers.get("Cache-Control"), path).toBe(
        "public, max-age=300, stale-while-revalidate=600",
      );
      expect(response.headers.get("ETag"), path).toBe(`"${snapshotId}"`);
    }
  });

  it("keeps the health probe and unknown routes uncacheable", async () => {
    for (const path of ["/health", "/does-not-exist"]) {
      const response = await SELF.fetch(`https://kwmpf.test${path}`);

      expect(response.headers.get("Cache-Control"), path).toBe("no-store");
    }
  });

  it("ties the cache version to the archived content, not just the snapshot name", async () => {
    const archived = await archiveCandidate(bindings, fundFixture);
    await publishCandidate(bindings, fundFixture, archived);

    const version = await currentPublicationVersion(bindings.DB);

    expect(version?.contentVersion).toBe(
      `${version?.snapshotId}:${archived.sha256}`,
    );
  });

  it("reports no publication version while nothing is published", async () => {
    expect(await currentPublicationVersion(bindings.DB)).toBeNull();
  });

  it("scopes the edge cache key to the published snapshot", () => {
    const first = cacheKeyFor("https://kwmpf.test/rankings?period=1", "snap-a");
    const second = cacheKeyFor(
      "https://kwmpf.test/rankings?period=1",
      "snap-b",
    );

    expect(first.url).not.toBe(second.url);
    expect(new URL(first.url).searchParams.get("period")).toBe("1");
    expect(new URL(first.url).searchParams.get("__snapshot")).toBe("snap-a");
  });

  it("answers a matching conditional request without a body", async () => {
    const archived = await archiveCandidate(bindings, fundFixture);
    const snapshotId = await publishCandidate(bindings, fundFixture, archived);

    const response = await SELF.fetch("https://kwmpf.test/summary", {
      headers: { "If-None-Match": `"${snapshotId}"` },
    });

    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=300, stale-while-revalidate=600",
    );
  });
});
