import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertMpfaFundTypes, MPFA_FUND_TYPES, mpfaFundTypeByName, mpfaFundTypeOf } from "../src/mpfa-fund-type";

const snapshot = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../../data/sources/2026-09-26/mpf-fund-platform.json"), "utf8"),
) as { records: { fundClassId: string; fundType?: string }[] };

describe("MPFA fund types", () => {
  it("lists 24 official types with unique English and Chinese names in six families", () => {
    expect(MPFA_FUND_TYPES).toHaveLength(24);
    expect(new Set(MPFA_FUND_TYPES.map((type) => type.en)).size).toBe(24);
    expect(new Set(MPFA_FUND_TYPES.map((type) => type.zh)).size).toBe(24);
    expect(new Set(MPFA_FUND_TYPES.map((type) => type.family.zh)).size).toBe(6);
  });

  it("covers every fund class in the latest platform snapshot exactly", () => {
    expect(() => assertMpfaFundTypes(snapshot.records)).not.toThrow();
    expect(mpfaFundTypeOf("Equity Fund - Greater China Equity Fund")).toEqual({
      en: "Equity Fund - Greater China Equity Fund",
      zh: "股票基金 - 大中華股票基金",
      family: { en: "Equity Fund", zh: "股票基金" },
    });
    expect(mpfaFundTypeByName("保證基金")?.en).toBe("Guaranteed Fund");
  });

  it("refuses missing or unofficial types instead of guessing", () => {
    expect(mpfaFundTypeOf("Equity Fund - Greater China")).toBeUndefined();
    expect(mpfaFundTypeOf(undefined)).toBeUndefined();
    expect(() =>
      assertMpfaFundTypes([
        { fundClassId: "a", fundType: "Equity Fund - Greater China" },
        { fundClassId: "b" },
      ]),
    ).toThrow(/2 fund class\(es\): a="Equity Fund - Greater China", b=null/);
  });
});
