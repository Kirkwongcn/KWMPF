/**
 * 銀聯信託（BCT）官網「基金表現」數據接口（ADR 0014）。
 *
 * `https://www.bcthk.com/bin/servlet/fundInformation?lang=en&schemaInfoId=<計劃>&date=<日期>`
 * 回傳該計劃全部成分基金的官方累積回報（年初至今、1 個月、3 個月、1 年、3 年、5 年、10 年、
 * 成立至今），連 `performanceDate`。接口只提供最新一期，冇歷史月份。
 *
 * 只認以下情況，否則成份回應報錯，唔出局部資料：
 * - `code` 係 `"200"`，有 `fundInformationList`；
 * - 每隻基金都有同一個 `performanceDate`（YYYY-MM-DD）；
 * - 每個回報值係 `12.34%` 格式，或者官方寫 `N/A`（記為官方未提供，唔當 0）。
 */

import { recordsWithSameName } from "./monthly-performance-summary-parser";

export type BctPerformanceRow = {
  name: string;
  /** BCT 單位類別：`A`、`H`、`D`、`I`、`N`，或者冇類別時寫 `-`。 */
  unitClass: string;
  launchDate: string;
  /** 官方原文去掉 `%`；`null` 代表官方寫 `N/A`。 */
  oneYear: number | null;
  threeYears: number | null;
  fiveYears: number | null;
  tenYears: number | null;
  printedOneYear: string;
  /** 官方原文：`72.13`，或者照抄 `N/A`。 */
  printedThreeYears: string;
};

export type BctPerformance = {
  performanceDate: string;
  rows: BctPerformanceRow[];
};

const PERCENT = /^(-?\d+(?:\.\d+)?)%$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

function readPercent(value: unknown, where: string) {
  // `N/A` 照原文保留，唔改寫成其他符號（紅線 1）。
  if (value === "N/A") return { value: null, printed: "N/A" };
  const match = typeof value === "string" ? PERCENT.exec(value) : null;
  if (!match) throw new Error(`BCT fund performance: unexpected value ${JSON.stringify(value)} for ${where}`);
  // 原文小數位照留（`33.97%` → `33.97`），只係去掉百分號。
  return { value: Number(match[1]), printed: match[1]! };
}

type RawFund = {
  name?: unknown;
  unitClass?: unknown;
  launchDate?: unknown;
  fundPerformanceDetail?: {
    fundPerformance?: {
      performanceDate?: unknown;
      lastYearPerformance?: unknown;
      last3YearPerformance?: unknown;
      last5YearPerformance?: unknown;
      last10YearPerformance?: unknown;
    };
  };
};

/** 讀一個計劃的接口回應。任何一隻基金唔合規格就成份報錯。 */
export function parseBctFundInformation(body: unknown): BctPerformance {
  const response = body as {
    code?: unknown;
    data?: { fundInformationList?: unknown };
  };
  const list = response?.data?.fundInformationList;
  if (response?.code !== "200" || !Array.isArray(list) || list.length === 0)
    throw new Error("BCT fund performance: response has no fund list");
  const dates = new Set<string>();
  const rows = (list as RawFund[]).map((fund) => {
    if (typeof fund.name !== "string" || !fund.name.trim())
      throw new Error("BCT fund performance: fund without a name");
    const performance = fund.fundPerformanceDetail?.fundPerformance;
    const date = performance?.performanceDate;
    if (typeof date !== "string" || !ISO_DATE.test(date))
      throw new Error(`BCT fund performance: ${fund.name} has no performance date`);
    dates.add(date);
    const oneYear = readPercent(performance?.lastYearPerformance, `${fund.name} 1-year`);
    const threeYears = readPercent(performance?.last3YearPerformance, `${fund.name} 3-year`);
    const fiveYears = readPercent(performance?.last5YearPerformance, `${fund.name} 5-year`);
    const tenYears = readPercent(performance?.last10YearPerformance, `${fund.name} 10-year`);
    return {
      name: fund.name.trim(),
      unitClass: typeof fund.unitClass === "string" ? fund.unitClass.trim() : "",
      launchDate: typeof fund.launchDate === "string" ? fund.launchDate : "",
      oneYear: oneYear.value,
      threeYears: threeYears.value,
      fiveYears: fiveYears.value,
      tenYears: tenYears.value,
      printedOneYear: oneYear.printed,
      printedThreeYears: threeYears.printed,
    } satisfies BctPerformanceRow;
  });
  // 一份回應只可以有一個截至日期；唔同日期即係接口混咗期數，唔可以揀一個用。
  if (dates.size !== 1)
    throw new Error(`BCT fund performance: mixed performance dates ${[...dates].join(", ")}`);
  return { performanceDate: [...dates][0]!, rows };
}

export type BctMatch =
  | { status: "matched"; fundClassId: string; row: BctPerformanceRow }
  | { status: "unmatched" | "ambiguous"; row: BctPerformanceRow; candidates: string[] };

// 積金局類別名稱同 BCT 單位類別的對應（契約）：`Class D`／`Unit Class A` ↔ `D`／`A`。
function classLabelMatches(fundClassName: string, unitClass: string) {
  if (!unitClass || unitClass === "-") return false;
  return (
    fundClassName === `Class ${unitClass}` || fundClassName === `Unit Class ${unitClass}`
  );
}

/**
 * 喺同一計劃入面按英文名稱精確配對（大小寫、引號、破折號正規化）。
 * 同名多過一個類別時，只用上面的類別契約揀；揀唔到一個就報 ambiguous（紅線 4）。
 * 計劃內只得一個同名類別但積金局寫咗類別（唔係 `n.a.`）而同 BCT 單位類別對唔上，報 unmatched，唔估。
 */
export function matchBctRows(
  rows: BctPerformanceRow[],
  schemeRecords: { fundClassId: string; constituentFundName: string; fundClassName: string }[],
): BctMatch[] {
  return rows.map((row) => {
    const sameName = recordsWithSameName(schemeRecords, row.name);
    const candidates =
      sameName.length === 1 && sameName[0]!.fundClassName === "n.a."
        ? sameName
        : sameName.filter((record) => classLabelMatches(record.fundClassName, row.unitClass));
    if (candidates.length === 1)
      return { status: "matched", fundClassId: candidates[0]!.fundClassId, row };
    // 同名多過一個類別而契約揀唔到一個：係同名衝突，唔係搵唔到名。
    return {
      status: candidates.length === 0 && sameName.length <= 1 ? "unmatched" : "ambiguous",
      row,
      candidates: (candidates.length > 0 ? candidates : sameName).map(
        (record) => record.fundClassId,
      ),
    };
  });
}
