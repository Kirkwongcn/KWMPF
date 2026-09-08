import { describe, expect, it } from "vitest";
import {
  FACT_SHEET_CONTRACTS,
  FACT_SHEET_SCHEMES,
  factSheetContract,
} from "../src/fact-sheet-allocation-contracts";

/**
 * 大部分計劃嘅受託人官網版面同積金局副本一致，一份契約兩個來源共用；
 * 海通嘅受託人官網係完全唔同嘅版面，MASS 兩邊版面一樣但截至日期寫法唔同
 * （副本有中文日期，官網逐隻基金嗰份淨係英文而且斷咗行），富達兩邊排版一樣但
 * 官網嗰份係中英對照，披露標題後面接住中文譯名，
 * 呢三個計劃先要按來源分開兩份契約。呢度測試嘅係
 * 「按來源揀契約」呢層揀選邏輯本身，唔係逐份契約嘅解析細節（嗰啲喺
 * `fact-sheet-allocation.test.ts` 度用真實座標鎖定）。
 */
describe("factSheetContract", () => {
  it("picks the source-specific contract when a scheme has more than one", () => {
    const trustee = factSheetContract("Haitong MPF Retirement Fund", "trustee");
    const registry = factSheetContract("Haitong MPF Retirement Fund", "mpfa-registry");

    expect(trustee.source).toBe("trustee");
    expect(registry.source).toBe("mpfa-registry");
    // 兩份係唔同嘅契約物件，唔可以夾硬共用（版面完全唔同）。
    expect(trustee).not.toBe(registry);
  });

  it("falls back to the source-less contract shared by both sources", () => {
    // AIA 之類 23/24 個計劃只有一份契約，冇聲明 `source`，兩個來源都要揀返同一份。
    const trustee = factSheetContract("AIA MPF - Prime Value Choice", "trustee");
    const registry = factSheetContract("AIA MPF - Prime Value Choice", "mpfa-registry");

    expect(trustee.source).toBeUndefined();
    expect(trustee).toBe(registry);
  });

  it("refuses to guess when no contract exists for the scheme", () => {
    expect(() => factSheetContract("No Such Scheme", "mpfa-registry")).toThrow(
      /No fact sheet allocation contract for No Such Scheme/,
    );
  });
});

describe("FACT_SHEET_SCHEMES", () => {
  it("lists every scheme exactly once even when a scheme has multiple contracts", () => {
    const duplicates = FACT_SHEET_SCHEMES.filter(
      (scheme, index) => FACT_SHEET_SCHEMES.indexOf(scheme) !== index,
    );
    expect(duplicates).toEqual([]);
    // 海通、MASS 同富達各有兩份契約（按來源分開），其餘二十一個計劃各一份。
    const twoContracts = [
      "Haitong MPF Retirement Fund",
      "MASS Mandatory Provident Fund Scheme",
      "Fidelity Retirement Master Trust",
    ];
    for (const scheme of twoContracts) expect(FACT_SHEET_SCHEMES).toContain(scheme);
    expect(FACT_SHEET_CONTRACTS.length).toBe(FACT_SHEET_SCHEMES.length + twoContracts.length);
  });
});
