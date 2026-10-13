import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBociPrudentialListing } from "../src/boci-prudential-mpf-listing";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/boci-prudential-mpf-listing-2026-08.json", import.meta.url), "utf8"),
);

describe("BOCI-Prudential MPF listing (ADR 0014)", () => {
  it("reads the official cumulative returns as published, dropping footnote markup from names", () => {
    const listing = parseBociPrudentialListing(fixture);
    expect(listing.asOfDate).toBe("2026-08-31");
    expect(listing.rows.map((row) => row.name)).toEqual([
      "BOC-Prudential Global Equity Fund",
      "BOC-Prudential Hong Kong Stable Retirement Fund",
      "BOC-Prudential MPF RMB & HKD Money Market Fund",
      "BOC-Prudential MPF Conservative Fund",
    ]);
    expect(listing.rows[0]).toMatchObject({ oneYear: 20.94, threeYears: 64.88, fiveYears: 58.13, printedThreeYears: "64.88" });
    // 原文小數位照留：「9.03」唔會變成「9.030」。
    expect(listing.rows[3]!.printedThreeYears).toBe("9.03");
  });

  it("keeps a blank five-year cell as not provided, never zero", () => {
    const retirement = parseBociPrudentialListing(fixture).rows[1]!;
    expect(retirement).toMatchObject({ threeYears: 17.19, fiveYears: null });
  });

  it("rejects the whole response on a blank three-year cell, mixed dates, odd values or markup", () => {
    const blank = structuredClone(fixture);
    blank.data[0].cumulative.threeY = "";
    expect(() => parseBociPrudentialListing(blank)).toThrow(/unexpected value "" for ECGE 3-year/u);

    const mixed = structuredClone(fixture);
    mixed.data[2].asOfDate = "2026-07-31";
    expect(() => parseBociPrudentialListing(mixed)).toThrow(/mixed as-of dates/u);

    const percent = structuredClone(fixture);
    percent.data[0].cumulative.oneY = "20.94%";
    expect(() => parseBociPrudentialListing(percent)).toThrow(/unexpected value/u);

    const markup = structuredClone(fixture);
    markup.data[0].fundName.nameEn = "BOC-Prudential <b>Global</b> Equity Fund";
    expect(() => parseBociPrudentialListing(markup)).toThrow(/unexpected markup/u);
  });

  it("rejects a response whose columns change, so a ten-year field is never mistaken for published", () => {
    const tenYear = structuredClone(fixture);
    tenYear.header.cumulative.push("10Y");
    expect(() => parseBociPrudentialListing(tenYear)).toThrow(/cumulative columns/u);

    const noThreeYear = structuredClone(fixture);
    noThreeYear.header.cumulative = noThreeYear.header.cumulative.filter((column: string) => column !== "3Y");
    expect(() => parseBociPrudentialListing(noThreeYear)).toThrow(/cumulative columns/u);

    expect(() => parseBociPrudentialListing({ header: fixture.header, data: [] })).toThrow(/no fund list/u);
  });
});
