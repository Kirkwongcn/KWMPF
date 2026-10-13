/**
 * 永明金融官網「強積金基金價格及表現」累積回報分頁的數據接口（ADR 0014）。
 *
 * `POST https://www.sunlife.com.hk/webservice/getmpforsofunddata`，body
 * `{"domainAndUserName":"hkportal","sqlKey":"MPF_CR_PERFORMANCE","sqlParams":["<日期>","MPF"]}`，
 * 回傳永明彩虹強積金計劃全部基金類別嘅累積回報（年初至今、3 個月、1、3、5、10 年、成立至今）
 * 同 `VALUATION_DT`。`sqlParams` 嘅日期唔影響回報期數，接口永遠回最新一期（按季更新）。
 *
 * 只認以下情況，否則成份回應報錯，唔出局部資料：
 * - 回應係非空陣列，每行都有同一個 `VALUATION_DT`（dd/mm/yyyy）；
 * - 每個回報值係 `12.34%`，或者 `null`；網頁將 `null` 印成「N/A」，記官方未提供，唔當 0；
 * - 類別係 `A`、`B`，或者單一類別基金寫 `--`。
 */

import { classLabelMatches } from "./bct-fund-performance";
import { recordsWithSameName } from "./monthly-performance-summary-parser";

export type SunLifePerformanceRow = {
  fundCode: string;
  name: string;
  /** `A`、`B`；單一類別基金係 `null`（官方寫 `--`）。 */
  unitClass: string | null;
  oneYear: number | null;
  threeYears: number | null;
  fiveYears: number | null;
  tenYears: number | null;
  /** 官方原文：`8.76`（去掉百分號），或者網頁顯示嘅 `N/A`。 */
  printedThreeYears: string;
};

export type SunLifePerformance = { valuationDate: string; rows: SunLifePerformanceRow[] };

const PERCENT = /^(-?\d+(?:\.\d+)?)%$/u;
const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/u;

function readPercent(value: unknown, where: string) {
  if (value === null) return { value: null, printed: "N/A" };
  const match = typeof value === "string" ? PERCENT.exec(value) : null;
  if (!match) throw new Error(`Sun Life MPF performance: unexpected value ${JSON.stringify(value)} for ${where}`);
  return { value: Number(match[1]), printed: match[1]! };
}

type RawRow = {
  FUND_CD?: unknown;
  FUND_DESCRIPTION_EN?: unknown;
  FUND_CLASS_EN?: unknown;
  VALUATION_DT?: unknown;
  PERFORMANCE_1YR?: unknown;
  PERFORMANCE_3YR?: unknown;
  PERFORMANCE_5YR?: unknown;
  PERFORMANCE_10YR?: unknown;
};

export function parseSunLifeCumulativePerformance(body: unknown): SunLifePerformance {
  if (!Array.isArray(body) || body.length === 0) throw new Error("Sun Life MPF performance: response has no fund list");
  const dates = new Set<string>();
  const rows = (body as unknown[]).map((item) => {
    if (typeof item !== "object" || item === null) throw new Error("Sun Life MPF performance: fund entry is not an object");
    const raw = item as RawRow;
    if (typeof raw.FUND_CD !== "string" || !raw.FUND_CD) throw new Error("Sun Life MPF performance: fund without a code");
    const where = raw.FUND_CD;
    if (typeof raw.FUND_DESCRIPTION_EN !== "string" || !raw.FUND_DESCRIPTION_EN.trim())
      throw new Error(`Sun Life MPF performance: ${where} has no English name`);
    const date = typeof raw.VALUATION_DT === "string" ? DATE.exec(raw.VALUATION_DT) : null;
    if (!date) throw new Error(`Sun Life MPF performance: ${where} has no valuation date`);
    dates.add(`${date[3]}-${date[2]}-${date[1]}`);
    if (raw.FUND_CLASS_EN !== "A" && raw.FUND_CLASS_EN !== "B" && raw.FUND_CLASS_EN !== "--")
      throw new Error(`Sun Life MPF performance: ${where} has unexpected class ${JSON.stringify(raw.FUND_CLASS_EN)}`);
    const threeYears = readPercent(raw.PERFORMANCE_3YR, `${where} 3-year`);
    return {
      fundCode: where,
      name: raw.FUND_DESCRIPTION_EN.trim(),
      unitClass: raw.FUND_CLASS_EN === "--" ? null : raw.FUND_CLASS_EN,
      oneYear: readPercent(raw.PERFORMANCE_1YR, `${where} 1-year`).value,
      threeYears: threeYears.value,
      fiveYears: readPercent(raw.PERFORMANCE_5YR, `${where} 5-year`).value,
      tenYears: readPercent(raw.PERFORMANCE_10YR, `${where} 10-year`).value,
      printedThreeYears: threeYears.printed,
    } satisfies SunLifePerformanceRow;
  });
  if (dates.size !== 1) throw new Error(`Sun Life MPF performance: mixed valuation dates ${[...dates].join(", ")}`);
  const codes = rows.map((row) => row.fundCode);
  if (new Set(codes).size !== codes.length) throw new Error("Sun Life MPF performance repeats a fund code");
  return { valuationDate: [...dates][0]!, rows };
}

export type SunLifeMatch =
  | { status: "matched"; fundClassId: string; row: SunLifePerformanceRow }
  | { status: "unmatched" | "ambiguous"; row: SunLifePerformanceRow; candidates: string[] };

/**
 * 喺同一計劃入面按英文名精確配對，再按同 BCT 一樣嘅類別契約揀：`A` ↔ `Class A`／`Unit Class A`、
 * 官方 `--` ↔ 積金局 `n.a.`。揀唔到剛好一個就唔配（紅線 4）。
 */
export function matchSunLifeRows(
  rows: SunLifePerformanceRow[],
  schemeRecords: { fundClassId: string; constituentFundName: string; fundClassName: string }[],
): SunLifeMatch[] {
  return rows.map((row) => {
    const sameName = recordsWithSameName(schemeRecords, row.name);
    const unitClass = row.unitClass;
    const candidates = sameName.filter((record) =>
      unitClass === null ? record.fundClassName === "n.a." : classLabelMatches(record.fundClassName, unitClass),
    );
    if (candidates.length === 1) return { status: "matched", fundClassId: candidates[0]!.fundClassId, row };
    return {
      status: candidates.length > 1 ? "ambiguous" : "unmatched",
      row,
      candidates: (candidates.length > 0 ? candidates : sameName).map((record) => record.fundClassId),
    };
  });
}
