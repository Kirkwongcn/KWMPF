import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertDisNameTypeAgreement,
  disComponentOf,
  reportSchemeDisCoverage,
  tagDisComponents,
} from "../src/dis-component";
import { parseSourceSnapshot } from "../src/input";

const fund = (
  id: string,
  schemeName: string,
  constituentFundName: string,
  fundType?: string,
) => ({ fundClassId: id, schemeName, constituentFundName, fundType });

describe("DIS constituent-fund name matching", () => {
  it("tags the generic English and Chinese names", () => {
    expect(disComponentOf("Core Accumulation Fund")).toBe("core_accumulation");
    expect(disComponentOf("核心累積基金")).toBe("core_accumulation");
    expect(disComponentOf("Age 65 Plus Fund")).toBe("age65_plus");
    expect(disComponentOf("65歲後基金")).toBe("age65_plus");
    expect(disComponentOf("65 歲後基金")).toBe("age65_plus");
  });

  it("tags trustee-prefixed official names listed exactly", () => {
    expect(disComponentOf("Manulife MPF Core Accumulation Fund")).toBe(
      "core_accumulation",
    );
    expect(disComponentOf("BCT (Pro) Age 65 Plus Fund")).toBe("age65_plus");
    expect(disComponentOf("Principal Core Accumulation Fund")).toBe(
      "core_accumulation",
    );
  });

  it("normalises case, quotes and dashes but does not fuzzy-match", () => {
    expect(disComponentOf("core accumulation fund")).toBe("core_accumulation");
    expect(disComponentOf("Age 65 Plus Fund")).toBe("age65_plus");
    expect(disComponentOf("  Core   Accumulation   Fund  ")).toBe(
      "core_accumulation",
    );
    expect(disComponentOf("My Core Accumulation Fund Extra")).toBeUndefined();
    expect(disComponentOf("Core Accumulation")).toBeUndefined();
    expect(disComponentOf("Hong Kong Equity Fund")).toBeUndefined();
    expect(disComponentOf("Class A")).toBeUndefined();
  });

  it("tags every fund class of a matched constituent fund", () => {
    const tagged = tagDisComponents([
      fund("a", "S", "Allianz MPF Core Accumulation Fund"),
      fund("b", "S", "Allianz MPF Core Accumulation Fund"),
      fund("c", "S", "Allianz MPF Age 65 Plus Fund"),
      fund("d", "S", "Hong Kong Equity Fund"),
    ]);
    expect(tagged.get("a")).toBe("core_accumulation");
    expect(tagged.get("b")).toBe("core_accumulation");
    expect(tagged.get("c")).toBe("age65_plus");
    expect(tagged.has("d")).toBe(false);
  });

  it("marks a scheme unavailable when either DIS name is missing", () => {
    const report = reportSchemeDisCoverage([
      fund("core", "Scheme A", "Core Accumulation Fund"),
      fund("age", "Scheme A", "Age 65 Plus Fund"),
      fund("only-core", "Scheme B", "Core Accumulation Fund"),
      fund("equity", "Scheme C", "Hong Kong Equity Fund"),
    ]);
    expect(report).toEqual([
      expect.objectContaining({
        schemeName: "Scheme A",
        status: "complete",
        missing: [],
      }),
      expect.objectContaining({
        schemeName: "Scheme B",
        status: "unavailable",
        missing: ["age65_plus"],
        reason: "no exact constituent-fund name match",
      }),
      expect.objectContaining({
        schemeName: "Scheme C",
        status: "unavailable",
        missing: ["core_accumulation", "age65_plus"],
      }),
    ]);
  });

  it("fails closed when the name list disagrees with official fundType", () => {
    expect(() =>
      assertDisNameTypeAgreement([
        fund(
          "x",
          "S",
          "Brand New Core Accumulation Fund",
          "Mixed Assets Fund - Default Investment Strategy - Core Accumulation Fund",
        ),
      ]),
    ).toThrow(/not in the exact-name list/);

    expect(() =>
      assertDisNameTypeAgreement([
        fund("x", "S", "Core Accumulation Fund", "Equity Fund - Hong Kong Equity Fund"),
      ]),
    ).toThrow(/name tags core_accumulation/);
  });
});

describe("current platform snapshot", () => {
  it("matches both DIS funds in every scheme by exact constituent name", async () => {
    const snapshot = parseSourceSnapshot(
      JSON.parse(
        await readFile(
          join(
            import.meta.dirname,
            "../../../data/sources/2026-08-29/mpf-fund-platform.json",
          ),
          "utf8",
        ),
      ),
    );
    const funds = snapshot.records.map((record) => ({
      fundClassId: record.fundClassId,
      schemeName: record.identity.schemeName,
      constituentFundName: record.identity.constituentFundName,
      fundType: record.fundType,
    }));

    expect(() => assertDisNameTypeAgreement(funds)).not.toThrow();
    const tagged = tagDisComponents(funds);
    expect(tagged.size).toBe(56);
    expect(
      [...tagged.values()].filter((tag) => tag === "core_accumulation"),
    ).toHaveLength(28);
    expect(
      [...tagged.values()].filter((tag) => tag === "age65_plus"),
    ).toHaveLength(28);

    const report = reportSchemeDisCoverage(funds);
    expect(report).toHaveLength(24);
    expect(report.every((row) => row.status === "complete")).toBe(true);
  });
});
