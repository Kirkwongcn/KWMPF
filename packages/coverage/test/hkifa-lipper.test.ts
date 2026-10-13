import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseHkifaLipperMpfTable, readGrowth } from "../src/hkifa-lipper-mpf-table-parser";
import { proposeHkifaLipperMap, uncoveredWords } from "../src/hkifa-lipper-fund-map";
import { mergeCumulativeObservations, type OfficialCumulativeReturnObservation } from "../src/official-return-overlay";

// 2026-08-31 一期實際 `pdftotext -bbox` 第 1 頁（打橫印，每隻基金一條 x 帶）。
const page1 = readFileSync(new URL("./fixtures/hkifa-lipper-mpf-2026-08-page1.bbox.html", import.meta.url), "utf8");

describe("HKIFA Lipper MPF Performance Table (ADR 0015)", () => {
  it("reads each fund band's one- and three-year % growth as printed", () => {
    const table = parseHkifaLipperMpfTable(page1);
    expect(table.dataAsOf).toBe("2026-08-31");
    expect(table.rows.find((row) => row.name === "MASS MPF-Core Accumulation")).toMatchObject({
      oneYear: ["15.37"],
      threeYears: ["48.20"],
      page: 1,
    });
    expect(table.rows.find((row) => row.name === "Manulife RC (MPF)-Allianz MPF Core Acc A")).toMatchObject({
      oneYear: ["12.48"],
      threeYears: ["43.02"],
    });
    // 呢行開頭喺 PDF 入面有 BOM（pdftotext 出「∩╗┐」），要剔走先對到對照表。
    expect(table.rows.some((row) => row.name === "AIA MPF-Prime Value Choice-Age 65 Plus")).toBe(true);
    expect(table.rows.some((row) => /^\W/u.test(row.name))).toBe(false);
    // 組別標題冇數值，照讀出嚟但唔會喺對照表出現。
    expect(table.rows.find((row) => row.name === "Default Investment Strategy - Core Accumulation Fund")).toMatchObject({
      oneYear: [],
      threeYears: [],
    });
  });

  it("validates a used cell strictly and never turns a blank into zero", () => {
    expect(readGrowth(["48.20"], "x")).toEqual({ value: 48.2, printed: "48.20" });
    expect(readGrowth([], "x")).toEqual({ value: null, printed: "" });
    expect(() => readGrowth(["18.4"], "x")).toThrow(/unexpected cell/u);
    expect(() => readGrowth(["1.00", "2.00"], "x")).toThrow(/unexpected cell/u);
  });

  it("checks each column's printed period, not just its position", () => {
    // 三年欄（y≈100）左邊嗰條嘅「3」改做「5」：欄位次序冇變，但期間唔啱就要報錯。
    const relabelled = page1.replace(/(yMin="99\.[^"]*"[^>]*>)3</u, "$15<");
    expect(relabelled).not.toBe(page1);
    expect(() => parseHkifaLipperMpfTable(relabelled)).toThrow(/period labels/u);
  });

  it("rejects a table whose return columns carry different dates", () => {
    // 表頭帶（x≈132）三年欄（y≈76）嘅截至日期改咗。
    const mixed = page1.replace(/(xMin="132\.[^"]*" yMin="76\.[^"]*"[^>]*>)08\/31\/2026</u, "$107/31/2026<");
    expect(mixed).not.toBe(page1);
    expect(() => parseHkifaLipperMpfTable(mixed)).toThrow(/mixes dates|exactly one date/u);
  });
});

describe("Lipper name map (ADR 0015)", () => {
  const scheme = "Manulife RetireChoice (MPF) Scheme";
  const record = (fundClassId: string, fund: string, fundClass: string, oneYear: number) => ({
    fundClassId,
    identity: { schemeName: scheme, constituentFundName: fund, fundClassName: fundClass },
    returns: { 1: { cumulative: oneYear, dataAsOf: "2026-08-31" } },
  });
  const row = (name: string, oneYear: string) => ({ name, oneYear: [oneYear], threeYears: ["1.00"], page: 1 });

  it("expands only the fixed abbreviations", () => {
    expect(uncoveredWords("Allianz MPF Core Acc A", "Allianz MPF Core Accumulation Fund Class A")).toEqual([]);
    expect(uncoveredWords("Allianz MPF Core Acc A", "Allianz MPF Core Accumulation Fund Class B")).toEqual(["a"]);
    expect(uncoveredWords("Gr China Eq", "Greater China Equity Fund")).toEqual([]);
  });

  it("uses the class letter when classes share a one-year value, and never borrows another class", () => {
    const records = [
      record("cf-a", "Allianz MPF Conservative Fund", "Class A", 1.53),
      record("cf-b", "Allianz MPF Conservative Fund", "Class B", 1.53),
    ];
    const { entries, rejected } = proposeHkifaLipperMap(
      [row("Manulife RC (MPF)-Allianz MPF Conservative A", "1.53")],
      records,
      "2026-08-31",
    );
    expect(entries.map((entry) => entry.fundClassId)).toEqual(["cf-a"]);
    expect(rejected).toEqual([]);
  });

  it("lists fund rows whose scheme prefix is unknown instead of dropping them", () => {
    const { rejected } = proposeHkifaLipperMap([row("SHKP MPF ES-SHKP MPF Fund", "5.00")], [], "2026-08-31");
    expect(rejected).toEqual([{ lipperName: "SHKP MPF ES-SHKP MPF Fund", reason: "0 scheme prefixes match" }]);
  });

  it("rejects a row whose one-year value matches no class or whose name does not fit", () => {
    const records = [record("cf-t", "Haitong Core Accumulation Fund", "Class T", 27.8)];
    const { entries, rejected } = proposeHkifaLipperMap(
      [row("Manulife RC (MPF)-Haitong Core Accumulation A", "27.80"), row("Manulife RC (MPF)-Allianz Asian A", "9.99")],
      records,
      "2026-08-31",
    );
    expect(entries).toEqual([]);
    expect(rejected.map((item) => item.reason)).toEqual([
      "1 class(es) share one-year 27.80, 0 match the name",
      `no ${scheme} class has platform one-year 9.99 at 2026-08-31`,
    ]);
  });
});

describe("merging trustee and third-party cumulative rows", () => {
  const row = (
    fundClassId: string,
    dataAsOf: string,
    printed: string,
    publisher?: "hkifa-lipper",
  ): OfficialCumulativeReturnObservation => ({
    fundClassId,
    periodYears: 3,
    basis: "cumulative",
    cumulative: Number(printed),
    printed,
    dataAsOf,
    sourceUrl: "https://official.test/x",
    retrievedAt: "2026-10-13T00:00:00Z",
    sourceSha256: "0".repeat(64),
    ...(publisher ? { publisher } : {}),
  });

  it("never lets a third-party row replace a trustee row", () => {
    const result = mergeCumulativeObservations([row("cf-1", "2026-06-30", "10.00")], [], [row("cf-1", "2026-08-31", "12.00", "hkifa-lipper")]);
    expect(result.cumulative).toEqual([row("cf-1", "2026-06-30", "10.00")]);
    expect(result.keptTrustee).toEqual(["cf-1"]);
  });

  it("prefers a trustee row in the same batch and replaces a third-party row of the same or an older date", () => {
    const sameBatch = mergeCumulativeObservations([], [row("cf-1", "2026-08-31", "12.01")], [row("cf-1", "2026-08-31", "12.00", "hkifa-lipper")]);
    expect(sameBatch.cumulative).toEqual([row("cf-1", "2026-08-31", "12.01")]);

    const later = mergeCumulativeObservations([row("cf-1", "2026-08-31", "12.00", "hkifa-lipper")], [row("cf-1", "2026-08-31", "12.01")], []);
    expect(later.cumulative).toEqual([row("cf-1", "2026-08-31", "12.01")]);
    expect(later.replaced).toEqual(["cf-1"]);
  });

  it("lets a newer third-party row through when this batch's trustee row lost to an even newer base row", () => {
    const result = mergeCumulativeObservations(
      [row("cf-1", "2026-08-31", "12.00", "hkifa-lipper")],
      [row("cf-1", "2026-07-31", "11.00")],
      [row("cf-1", "2026-09-30", "13.00", "hkifa-lipper")],
    );
    expect(result.cumulative).toEqual([row("cf-1", "2026-09-30", "13.00", "hkifa-lipper")]);
  });

  it("fills only funds without a trustee row, and rejects two same-date third-party values that differ", () => {
    const filled = mergeCumulativeObservations([], [], [row("cf-2", "2026-08-31", "5.00", "hkifa-lipper")]);
    expect(filled.cumulative).toEqual([row("cf-2", "2026-08-31", "5.00", "hkifa-lipper")]);
    expect(() =>
      mergeCumulativeObservations([row("cf-2", "2026-08-31", "5.00", "hkifa-lipper")], [], [row("cf-2", "2026-08-31", "5.01", "hkifa-lipper")]),
    ).toThrow(/disagree/u);
  });
});
