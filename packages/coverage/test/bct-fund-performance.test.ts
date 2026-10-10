import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchBctRows, parseBctFundInformation } from "../src/bct-fund-performance";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/bct-fund-information-series-800-2026-09.json", import.meta.url), "utf8"),
);

const series800 = [
  { fundClassId: "cf-asian-d", constituentFundName: "Principal Asian Equity Fund", fundClassName: "Class D" },
  { fundClassId: "cf-asian-i", constituentFundName: "Principal Asian Equity Fund", fundClassName: "Class I" },
  { fundClassId: "cf-bond-n", constituentFundName: "Principal Asian Bond Fund", fundClassName: "Class N" },
  { fundClassId: "cf-caf-n", constituentFundName: "Principal Core Accumulation Fund", fundClassName: "Class N" },
];

describe("BCT fund performance responses (ADR 0014)", () => {
  it("reads the official one and three year cumulative returns as published", () => {
    const performance = parseBctFundInformation(fixture);
    expect(performance.performanceDate).toBe("2026-09-30");
    expect(performance.rows).toHaveLength(4);
    const asianD = performance.rows.find((row) => row.name === "Principal Asian Equity Fund" && row.unitClass === "D");
    expect(asianD).toMatchObject({
      oneYear: 26.06,
      threeYears: 72.13,
      printedOneYear: "26.06",
      printedThreeYears: "72.13",
    });
  });

  it("keeps an official N/A apart from zero", () => {
    const body = structuredClone(fixture);
    body.data.fundInformationList[0].fundPerformanceDetail.fundPerformance.last3YearPerformance = "N/A";
    const [row] = parseBctFundInformation(body).rows;
    expect(row!.threeYears).toBeNull();
    // 照原文保留 N/A，唔改寫成「-」或者 0。
    expect(row!.printedThreeYears).toBe("N/A");
  });

  it("rejects a response mixing performance dates or carrying an unexpected value", () => {
    const mixed = structuredClone(fixture);
    mixed.data.fundInformationList[1].fundPerformanceDetail.fundPerformance.performanceDate = "2026-08-31";
    expect(() => parseBctFundInformation(mixed)).toThrow(/mixed performance dates/u);

    const odd = structuredClone(fixture);
    odd.data.fundInformationList[0].fundPerformanceDetail.fundPerformance.last3YearPerformance = "13.18";
    expect(() => parseBctFundInformation(odd)).toThrow(/unexpected value/u);

    expect(() => parseBctFundInformation({ code: "500", data: {} })).toThrow(/no fund list/u);
  });

  it("matches each unit class to its own MPFA fund class and never guesses", () => {
    const { rows } = parseBctFundInformation(fixture);
    const matches = matchBctRows(rows, series800);
    expect(
      matches.map((match) => (match.status === "matched" ? match.fundClassId : match.status)),
    ).toEqual(["cf-bond-n", "cf-asian-d", "cf-asian-i", "cf-caf-n"]);

    // 同名兩個類別但積金局冇寫類別：同名衝突，唔可以揀一個。
    const unlabelled = series800.map((record) => ({ ...record, fundClassName: "n.a." }));
    expect(matchBctRows(rows, unlabelled)[1]).toMatchObject({
      status: "ambiguous",
      candidates: ["cf-asian-d", "cf-asian-i"],
    });

    // 積金局寫明類別但同 BCT 單位類別唔同：對唔上。
    const wrongClass = [{ ...series800[2]!, fundClassName: "Class D" }];
    expect(matchBctRows([rows[0]!], wrongClass)[0]).toMatchObject({ status: "unmatched" });

    // 計劃得一個同名類別、積金局冇寫類別（例如 Pro Choice）：照名稱配對。
    const single = [{ fundClassId: "cf-pro", constituentFundName: "Principal Asian Bond Fund", fundClassName: "n.a." }];
    expect(matchBctRows([rows[0]!], single)[0]).toMatchObject({ status: "matched", fundClassId: "cf-pro" });
  });
});
