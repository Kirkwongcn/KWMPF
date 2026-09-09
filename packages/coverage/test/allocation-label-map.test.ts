import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAllocationLabelMap,
  diffAllocationLabelMaps,
  isIgnorableLabel,
  lookupBucket,
  mapDisclosureAllocation,
  normalizeLabel,
  proposeBucket,
  toLabelLookup,
  type AllocationLabelMapFile,
  type LabelBucket,
} from "../src/allocation-label-map";

function mapFrom(pairs: [string, LabelBucket][]): Map<string, LabelBucket> {
  return toLabelLookup({
    generatedAt: "2026-09-08",
    version: 1,
    source: "test",
    buckets: ["equity", "bond", "cash_and_other"],
    entries: pairs.map(([example, bucket]) => ({
      key: normalizeLabel(example),
      bucket,
      examples: [example],
    })),
  });
}

describe("normalizeLabel", () => {
  it("inserts a space between CJK and Latin so glued fact-sheet labels share a key", () => {
    expect(normalizeLabel("HONG KONG EQUITIES香港股票")).toBe(
      normalizeLabel("Hong Kong Equities 香港股票"),
    );
    expect(normalizeLabel("中國債券China Bonds")).toBe("中國債券 china bonds");
  });

  it("treats the 巿/市 variant and trailing footnote marks as the same cash residual", () => {
    expect(normalizeLabel("貨幣巿場工具 Money Market Instruments")).toBe(
      "貨幣市場工具 money market instruments",
    );
    expect(normalizeLabel("現金及其他 Cash & Others<")).toBe("現金及其他 cash & others");
    expect(normalizeLabel("CASH & OTHERS # 現金及其他 #")).toBe("cash & others 現金及其他");
    expect(normalizeLabel("Cash & Others 現金及其他 3")).toBe("cash & others 現金及其他");
  });

  it("strips BCT letter prefixes without changing the bucket name", () => {
    expect(normalizeLabel("I : Others 其他")).toBe("others 其他");
    expect(normalizeLabel("A: Hong Kong Equities 香港股票")).toBe("hong kong equities 香港股票");
  });
});

describe("proposeBucket", () => {
  it("maps asset-by-region labels onto the three buckets", () => {
    expect(proposeBucket("香港股票 Hong Kong Equities")).toBe("equity");
    expect(proposeBucket("Thailand Equitied 泰國股票")).toBe("equity");
    expect(proposeBucket("Global Debt Securities 環球債務證券")).toBe("bond");
    expect(proposeBucket("Dollar Bloc 美元債券")).toBe("bond");
    expect(proposeBucket("Fixed Income 固定收益")).toBe("bond");
    expect(proposeBucket("Bank Balance 銀行存款")).toBe("cash_and_other");
    expect(proposeBucket("Cash & Short-term Investments")).toBe("cash_and_other");
    expect(proposeBucket("Others 其他")).toBe("cash_and_other");
    expect(proposeBucket("I : Others 其他")).toBe("cash_and_other");
  });

  it("does not treat a country, sector, rating or underlying fund name as an asset class", () => {
    expect(proposeBucket("中國 China")).toBe("not_asset_class");
    expect(proposeBucket("金融 Financials")).toBe("not_asset_class");
    expect(proposeBucket("AAA")).toBe("not_asset_class");
    expect(proposeBucket("US DOLLAR美元")).toBe("not_asset_class");
    expect(proposeBucket("Asia Fund 亞洲基金")).toBe("not_asset_class");
    expect(proposeBucket("Japan Fund 日本基金")).toBe("not_asset_class");
    expect(proposeBucket("Other Countries 其他國家")).toBe("not_asset_class");
    expect(proposeBucket("Other Sectors 其他行業")).toBe("not_asset_class");
  });

  it("maps an underlying bond fund name to bonds, but not a regional fund", () => {
    expect(proposeBucket("HK $ Bond Fund 港元債券基金")).toBe("bond");
    expect(proposeBucket("Hong Kong and China Fund 中港基金")).toBe("not_asset_class");
  });

  it("skips a concatenated equity-and-bond row instead of picking one side", () => {
    expect(proposeBucket("Equities 股票 74.86% Bonds 債券")).toBe("ignore");
  });

  it("skips a commentary sentence even when it mentions bonds", () => {
    expect(proposeBucket("英倫銀行維持利率於 不變，金邊債券受國內政治發")).toBe("ignore");
  });

  it("skips commentary, standard deviation and leaked return rows", () => {
    expect(isIgnorableLabel("抵制日圓持續貶值。")).toBe(true);
    expect(isIgnorableLabel("MSCI 世界指數在第二季報升")).toBe(true);
    expect(
      isIgnorableLabel("Annualized Standard Deviation for the past 3 years 三年年度化標準差"),
    ).toBe(true);
    expect(
      isIgnorableLabel("Reference Portfolio 參考投資組合 13.08% 39.24% 30.89% N/A 不適用"),
    ).toBe(true);
    expect(isIgnorableLabel("n/a 不適用")).toBe(true);
    expect(isIgnorableLabel("：")).toBe(true);
    expect(proposeBucket("抵制日圓持續貶值。")).toBe("ignore");
  });
});

describe("mapDisclosureAllocation", () => {
  const version = "2026-09-08";

  it("sums asset-by-region rows into the three editorial buckets", () => {
    const lookup = mapFrom([
      ["歐洲股票 Europe Equities", "equity"],
      ["香港股票 Hong Kong Equities", "equity"],
      ["美國債券 United States Bonds", "bond"],
      ["其他債券 Other Bonds", "bond"],
      ["現金及其他 Cash and Others", "cash_and_other"],
    ]);

    const mapped = mapDisclosureAllocation(
      {
        factSheetAsOf: "2026-05-31",
        allocations: [
          {
            heading: "ASSET ALLOCATION 資產分佈",
            entries: [
              { label: "歐洲股票 Europe Equities", percent: 7.02 },
              { label: "香港股票 Hong Kong Equities", percent: 7.23 },
              { label: "美國債券 United States Bonds", percent: 6.9 },
              { label: "其他債券 Other Bonds", percent: 57.58 },
              { label: "現金及其他 Cash and Others", percent: 2.52 },
            ],
          },
        ],
      },
      lookup,
      version,
    );

    expect(mapped).toEqual({
      official: false,
      mapVersion: version,
      asOf: "2026-05-31",
      sourceHeading: "ASSET ALLOCATION 資產分佈",
      buckets: { equity: 14.25, bond: 64.48, cashAndOther: 2.52 },
    });
  });

  it("does not rewrite a geographical table as equity just because the fund is an equity fund", () => {
    const lookup = mapFrom([
      ["中國 China", "not_asset_class"],
      ["香港 Hong Kong", "not_asset_class"],
      ["現金及其他 Cash and Others", "cash_and_other"],
    ]);

    expect(
      mapDisclosureAllocation(
        {
          factSheetAsOf: "2026-05-31",
          allocations: [
            {
              heading: "ASSET ALLOCATION 資產分佈",
              entries: [
                { label: "中國 China", percent: 50.02 },
                { label: "香港 Hong Kong", percent: 13.2 },
                { label: "現金及其他 Cash and Others", percent: 0.71 },
              ],
            },
          ],
        },
        lookup,
        version,
      ),
    ).toEqual({
      official: false,
      mapVersion: version,
      asOf: "2026-05-31",
      unavailable: true,
      reason: "not-asset-class",
    });
  });

  it("ignores a leaked standard-deviation row and still maps the remaining asset-class rows", () => {
    const lookup = mapFrom([
      ["Equities 股票", "equity"],
      ["Cash & Others 現金及其他", "cash_and_other"],
    ]);

    expect(
      mapDisclosureAllocation(
        {
          factSheetAsOf: "2026-06-30",
          allocations: [
            {
              heading: "Portfolio Allocation 投資組合分佈",
              entries: [
                { label: "Equities 股票", percent: 96.9 },
                { label: "Cash & Others 現金及其他", percent: 3.1 },
                {
                  label: "Annualized Standard Deviation for the past 3 years 三年年度化標準差",
                  percent: 21.58,
                },
              ],
            },
          ],
        },
        lookup,
        version,
      ),
    ).toMatchObject({
      buckets: { equity: 96.9, bond: 0, cashAndOther: 3.1 },
    });
  });

  it("inherits chart-only unavailability instead of inventing buckets", () => {
    expect(
      mapDisclosureAllocation(
        {
          allocations: [],
          unavailableFields: ["allocation"],
          unavailableKinds: { allocation: "chart-only" },
          factSheetAsOf: "2026-06-30",
        },
        new Map(),
        version,
      ),
    ).toEqual({
      official: false,
      mapVersion: version,
      asOf: "2026-06-30",
      unavailable: true,
      reason: "chart-only",
    });
  });

  it("keeps a negative residual in cash rather than clipping it to zero", () => {
    const lookup = mapFrom([
      ["金融 Financials", "not_asset_class"],
      ["現金及其他 Cash & Others<", "cash_and_other"],
    ]);
    expect(
      mapDisclosureAllocation(
        {
          allocations: [
            {
              heading: "Asset Allocation (%) 資產分佈",
              entries: [
                { label: "金融 Financials", percent: 34.3 },
                { label: "現金及其他 Cash & Others<", percent: -0.4 },
              ],
            },
          ],
        },
        lookup,
        version,
      ),
    ).toMatchObject({ unavailable: true, reason: "not-asset-class" });

    const cashWithEquity = mapFrom([
      ["Equities 股票", "equity"],
      ["現金及其他 Cash & Others<", "cash_and_other"],
    ]);
    expect(
      mapDisclosureAllocation(
        {
          allocations: [
            {
              heading: "Asset Allocation (%) 資產分佈",
              entries: [
                { label: "Equities 股票", percent: 100.4 },
                { label: "現金及其他 Cash & Others<", percent: -0.4 },
              ],
            },
          ],
        },
        cashWithEquity,
        version,
      ),
    ).toMatchObject({ buckets: { equity: 100.4, bond: 0, cashAndOther: -0.4 } });
  });

  it("does not renormalise buckets to 100", () => {
    const lookup = mapFrom([
      ["Equities 股票", "equity"],
      ["Cash & Others 現金及其他", "cash_and_other"],
    ]);
    expect(
      mapDisclosureAllocation(
        {
          allocations: [
            {
              heading: "Asset Allocation",
              entries: [
                { label: "Equities 股票", percent: 90 },
                { label: "Cash & Others 現金及其他", percent: 5 },
              ],
            },
          ],
        },
        lookup,
        version,
      ),
    ).toMatchObject({ buckets: { equity: 90, bond: 0, cashAndOther: 5 } });
  });

  it("does not map a table that lists both a currency split and an asset-class summary", () => {
    const lookup = mapFrom([
      ["人民幣債券 Renminbi Bond", "bond"],
      ["港元債券 HK Dollar Bond", "bond"],
      ["港元現金及其他 Cash & Others (HKD)", "cash_and_other"],
      ["人民幣現金及其他 Cash & Others (CNH)", "cash_and_other"],
      ["債券 Bond", "bond"],
      ["現金及其他 Cash & Others", "cash_and_other"],
    ]);
    expect(
      mapDisclosureAllocation(
        {
          allocations: [
            {
              heading: "Asset Allocation 基金資產分佈",
              entries: [
                { label: "人民幣債券 Renminbi Bond", percent: 9.7 },
                { label: "港元債券 HK Dollar Bond", percent: 12 },
                { label: "港元現金及其他 Cash & Others (HKD)", percent: 30.3 },
                { label: "人民幣現金及其他 Cash & Others (CNH)", percent: 48 },
                { label: "債券 Bond", percent: 36.4 },
                { label: "現金及其他 Cash & Others", percent: 63.6 },
              ],
            },
          ],
        },
        lookup,
        version,
      ),
    ).toMatchObject({ unavailable: true, reason: "not-asset-class" });
  });

  it("does not keep a partial cash total after dropping a glued bond row", () => {
    const lookup = mapFrom([["Bank Deposit 銀行存款", "cash_and_other"]]);
    expect(
      mapDisclosureAllocation(
        {
          allocations: [
            {
              heading: "Portfolio Allocation 投資組合分佈",
              entries: [
                { label: "Bank Deposit 銀行存款", percent: 90.55 },
                {
                  label: "Fixed Income Securities 定息收入證券 8.15% Cash & Others 現金及其他",
                  percent: 1.3,
                },
              ],
            },
          ],
        },
        lookup,
        version,
      ),
    ).toMatchObject({ unavailable: true, reason: "not-asset-class" });
  });

  it("does not treat leftover BEA fragments as a complete asset-class table", () => {
    const lookup = mapFrom([
      ["JPY Bonds 日圓債券", "bond"],
      ["環球股票﹙美國﹑日本及歐洲﹚", "equity"],
    ]);
    expect(
      mapDisclosureAllocation(
        {
          allocations: [
            {
              heading: "Portfolio Allocation 投資組合分佈",
              entries: [
                { label: "This Fund 本基金 15.02% 43.07%", percent: 2.6 },
                { label: "JPY Bonds 日圓債券", percent: 2.6 },
                { label: "環球股票﹙美國﹑日本及歐洲﹚", percent: 18.9 },
              ],
            },
          ],
        },
        lookup,
        version,
      ),
    ).toMatchObject({ unavailable: true, reason: "not-asset-class" });
  });

  it("skips a row whose label already contains a percentage", () => {
    expect(isIgnorableLabel("Property 房產 4.1% Cash & Others4現金及其他 4")).toBe(true);
    expect(isIgnorableLabel("Equity 股票 95.4%")).toBe(true);
  });

  it("prefers an asset-class table when a fund also discloses geography", () => {
    const lookup = mapFrom([
      ["Equities 股票", "equity"],
      ["Bonds 債券", "bond"],
      ["Cash 現金", "cash_and_other"],
      ["Hong Kong 香港", "not_asset_class"],
    ]);
    expect(
      mapDisclosureAllocation(
        {
          allocations: [
            {
              heading: "Geographical Breakdown 地區投資分布",
              entries: [{ label: "Hong Kong 香港", percent: 100 }],
            },
            {
              heading: "Fund Allocation by Asset Class 資產類別投資分布",
              entries: [
                { label: "Equities 股票", percent: 70 },
                { label: "Bonds 債券", percent: 25 },
                { label: "Cash 現金", percent: 5 },
              ],
            },
          ],
        },
        lookup,
        version,
      ),
    ).toMatchObject({
      sourceHeading: "Fund Allocation by Asset Class 資產類別投資分布",
      buckets: { equity: 70, bond: 25, cashAndOther: 5 },
    });
  });

  it("throws on an unseen label rather than dumping it into other", () => {
    expect(() =>
      lookupBucket("Martian Equities", mapFrom([["Equities 股票", "equity"]])),
    ).toThrow("Martian Equities");
  });
});

describe("buildAllocationLabelMap", () => {
  it("keeps a previous bucket when the same normalised label reappears", () => {
    const previous: AllocationLabelMapFile = {
      generatedAt: "2026-08-01",
      version: 1,
      source: "old",
      buckets: ["equity", "bond", "cash_and_other"],
      entries: [
        { key: normalizeLabel("Hong Kong Equities 香港股票"), bucket: "equity", examples: ["Hong Kong Equities"] },
      ],
    };
    const result = buildAllocationLabelMap(
      [
        {
          heading: "Asset Allocation",
          entries: [{ label: "HONG KONG EQUITIES香港股票", percent: 10 }],
        },
      ],
      previous,
    );
    expect(result.file.entries).toEqual([
      {
        key: normalizeLabel("Hong Kong Equities 香港股票"),
        bucket: "equity",
        examples: ["Hong Kong Equities", "HONG KONG EQUITIES香港股票"],
      },
    ]);
    expect(result.diff.added).toEqual([]);
    expect(result.diff.recategorized).toEqual([]);
  });

  it("maps every current disclosure without hitting an unknown label", () => {
    const repo = resolve(import.meta.dirname, "../../..");
    const mapFile = JSON.parse(
      readFileSync(resolve(repo, "data/reference/allocation-label-map.json"), "utf8"),
    ) as AllocationLabelMapFile;
    const disclosures = JSON.parse(
      readFileSync(
        resolve(repo, "data/sources/2026-08-31/fund-fact-sheet-disclosures.json"),
        "utf8",
      ),
    ) as { funds: { allocations: { heading: string; entries: { label: string; percent: number }[] }[]; unavailableFields?: string[]; unavailableKinds?: Record<string, "chart-only">; factSheetAsOf: string }[] };
    const lookup = toLabelLookup(mapFile);
    let mapped = 0;
    for (const fund of disclosures.funds) {
      const result = mapDisclosureAllocation(
        {
          allocations: fund.allocations ?? [],
          unavailableFields: fund.unavailableFields,
          unavailableKinds: fund.unavailableKinds,
          factSheetAsOf: fund.factSheetAsOf,
        },
        lookup,
        mapFile.generatedAt,
      );
      if (!("unavailable" in result && result.unavailable)) mapped += 1;
    }
    expect(mapped).toBeGreaterThan(100);
  });

  it("reports newly seen labels so they cannot publish without review", () => {
    const diff = diffAllocationLabelMaps(
      [{ key: "equities 股票", bucket: "equity", examples: ["Equities 股票"] }],
      [
        { key: "equities 股票", bucket: "equity", examples: ["Equities 股票"] },
        { key: "bonds 債券", bucket: "bond", examples: ["Bonds 債券"] },
      ],
    );
    expect(diff.added).toEqual([{ key: "bonds 債券", bucket: "bond" }]);
  });
});
