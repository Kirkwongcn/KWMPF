import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSourceSnapshot } from "../src/input";
import { buildFirstOfficialBatchCoverage, loadOfficialBatch } from "../src/official-source-batch";

const root = join(import.meta.dirname, "../../..");
const readSnapshot = async (name: string) =>
  parseSourceSnapshot(
    JSON.parse(await readFile(join(root, "data/sources/2026-08-11", name), "utf8")),
  );

describe("first official source batch", () => {
  it.each([
    ["AIA Company (Trustee) Limited", "trustee-01.json", 21],
    ["BOCI-Prudential Trustee Limited", "trustee-02.json", 34],
    ["Bank Consortium Trust Company Limited", "trustee-03.json", 171],
    ["Bank of Communications Trustee Limited", "trustee-04.json", 14],
  ])("loads the fixed contract for %s", async (trustee, trusteeFile, count) => {
    const batch = loadOfficialBatch(
      trustee,
      await readSnapshot(trusteeFile),
      await readSnapshot("official-scheme-batch-01.json"),
    );
    expect(batch.records).toHaveLength(count);
    expect(batch.records.every((record) => record.identity.trusteeName === trustee)).toBe(true);
    expect(batch.records.every((record) => record.sourceUrl?.startsWith("https://"))).toBe(true);
  });

  it("fails closed when a trustee source loses a required field", async () => {
    const source = await readSnapshot("trustee-01.json");
    const scheme = await readSnapshot("official-scheme-batch-01.json");
    source.records[0]!.identity.fundClassName = "";
    expect(() =>
      loadOfficialBatch(
        "AIA Company (Trustee) Limited",
        source,
        scheme,
      ),
    ).toThrow("fundClassName is required");
  });

  it("fails closed when the official scheme source is incomplete", async () => {
    const scheme = await readSnapshot("official-scheme-batch-01.json");
    const trustee = await readSnapshot("trustee-01.json");
    scheme.records = scheme.records.filter((record) => record.identity.trusteeName !== "AIA Company (Trustee) Limited");
    expect(() =>
      loadOfficialBatch(
        "AIA Company (Trustee) Limited",
        trustee,
        scheme,
      ),
    ).toThrow("No records found");
  });

  it("publishes the first trustee batch without treating the rest as verified", async () => {
    const platform = await readSnapshot("mpf-fund-platform.json");
    const scheme = await readSnapshot("official-scheme-batch-01.json");
    const trustees = await Promise.all([
      readSnapshot("trustee-01.json"),
      readSnapshot("trustee-02.json"),
      readSnapshot("trustee-03.json"),
      readSnapshot("trustee-04.json"),
    ]);
    const result = buildFirstOfficialBatchCoverage(platform, scheme, trustees);
    expect(result.records).toHaveLength(451);
    expect(result.records.filter((record) => record.status === "verified")).toHaveLength(240);
    expect(result.records.filter((record) => record.status === "pending_verification")).toHaveLength(211);
  });
});
