import { describe, expect, it } from "vitest";
import {
  disclosureForFund,
  platformFundsBySchemeName,
  sharedFactSheetAsOf,
} from "../src/build-fact-sheet-allocation-report";
import type { FactSheetDisclosure } from "../src/fact-sheet-allocation";

function disclosure(
  constituentFundName: string,
  factSheetAsOf = "2026-06-30",
): FactSheetDisclosure {
  return {
    schemeName: "MASS Mandatory Provident Fund Scheme",
    constituentFundName,
    factSheetAsOf,
    allocations: [],
    topHoldings: [],
    unavailableFields: [],
    unavailableReasons: {},
    unavailableKinds: {},
  };
}

/**
 * 逐隻基金一份便覽（MASS）冇咗「一份 PDF 逐版一隻基金」嗰個天然次序，唔可以靠檔名或者
 * 次序猜邊份屬邊隻基金，所以每一份都要同名單上聲明嗰隻對名。
 */
describe("disclosureForFund", () => {
  it("returns the only section when it is the fund the list declared", () => {
    const only = disclosure("Global Stable Fund");

    expect(disclosureForFund("MASS_GLSF.pdf", "Global Stable Fund", [only])).toBe(only);
  });

  it("matches the platform's spelling of the fund name", () => {
    // 名單抄官網、區段名抄便覽，兩邊嘅空格同引號寫法唔一定一樣。
    const only = disclosure("Hong  Kong Equities Fund");

    expect(disclosureForFund("MASS_HKEF.pdf", "Hong Kong Equities Fund", [only])).toBe(only);
  });

  it("refuses a fact sheet that holds more than one fund section", () => {
    // 切出兩個區段代表版面認錯咗，唔知邊個屬邊隻基金。
    expect(() =>
      disclosureForFund("MASS_GLSF.pdf", "Global Stable Fund", [
        disclosure("Global Stable Fund"),
        disclosure("Global Growth Fund"),
      ]),
    ).toThrow("holds 2 constituent fund sections");
  });

  it("refuses a fact sheet that holds no fund section", () => {
    expect(() => disclosureForFund("MASS_GLSF.pdf", "Global Stable Fund", [])).toThrow(
      "holds 0 constituent fund sections",
    );
  });

  it("refuses a fact sheet whose section is another fund", () => {
    // 官網換咗檔或者名單抄錯，靜靜哋照用等於把另一隻基金嘅持倉貼落去。
    expect(() =>
      disclosureForFund("MASS_GLSF.pdf", "Global Stable Fund", [
        disclosure("Global Growth Fund"),
      ]),
    ).toThrow("is listed for Global Stable Fund but its section is named Global Growth Fund");
  });
});

describe("sharedFactSheetAsOf", () => {
  const file = (factSheetAsOf: string, name: string) => ({
    file: `${name}.pdf`,
    factSheetUrl: `https://app2.yflife.com/MPFWeb/pdf/fact_sheet/${name}_E.pdf`,
    factSheetAsOf,
  });

  it("reports the shared date when every fact sheet is the same period", () => {
    expect(
      sharedFactSheetAsOf([file("2026-06-30", "GLSF"), file("2026-06-30", "GLGF")]),
    ).toBe("2026-06-30");
  });

  it("reports no scheme-level date when the periods differ", () => {
    // 取最舊嗰個冚全份等於改寫其餘基金嘅官方截至日期；逐份日期照樣留喺 `factSheetFiles`。
    expect(
      sharedFactSheetAsOf([file("2026-06-30", "GLSF"), file("2026-03-31", "GLGF")]),
    ).toBeUndefined();
  });
});

describe("platformFundsBySchemeName", () => {
  it("groups the fund classes of one constituent fund together", () => {
    const funds = platformFundsBySchemeName([
      {
        fundClassId: "a",
        identity: { schemeName: "MASS", constituentFundName: "Global Stable Fund" },
      },
      {
        fundClassId: "b",
        identity: { schemeName: "MASS", constituentFundName: "Global Stable Fund" },
      },
      {
        fundClassId: "c",
        identity: { schemeName: "Other", constituentFundName: "Global Stable Fund" },
      },
    ]);

    expect(funds).toEqual([
      {
        schemeName: "MASS",
        constituentFundName: "Global Stable Fund",
        fundClassIds: ["a", "b"],
      },
      {
        schemeName: "Other",
        constituentFundName: "Global Stable Fund",
        fundClassIds: ["c"],
      },
    ]);
  });
});
