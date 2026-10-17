import type { OfficialCumulativeReturnObservation } from "./official-return-overlay";

/**
 * 交叉核對同隔離邏輯（ADR 0014、ADR 0016）。由 build-monthly-summary-returns.ts 抽出，
 * 語義見該檔頂部說明同 ADR 0016：一年唔啱照成份作廢；5／10 年同平台同期嚴格比較唔等
 * 定義為官方來源衝突，只隔離該行並登記兩個官方數字（照錄，唔揀邊、唔加容差）。
 */

export type MatchedRow = {
  fundClassId: string;
  label: string;
  oneYear: number | null;
  threeYears: number | null;
  fiveYears: number | null;
  tenYears: number | null;
  /** 官方原文：數字、「-」（滙豐／恒生、宏利）或者「N/A」（BCT、宏利、永明）；中銀保誠一定係數字。 */
  printedThreeYears: string;
};

export type SourceDocument = {
  kind: "monthly-summary-pdf" | "bct-fund-information" | "manulife-monthly-summary-pdf" | "boci-prudential-mpf-listing"
    | "sun-life-mpf-cumulative-performance"
    | "yf-life-monthly-performance-pdf";
  schemeName: string;
  url: string;
  retrievedAt: string;
  sha256: string;
  bytes: number;
  page?: number;
  dataAsOf: string;
  rows: number;
  failed: string[];
  matched: MatchedRow[];
};

/** 只做核對所需嘅平台紀錄形狀（來源快照 `parseSourceSnapshot` 嘅紀錄結構上符合）。 */
export type CrossCheckPlatformReturn = { annualized?: number; cumulative?: number; dataAsOf: string };
export type CrossCheckPlatformRecord = {
  fundClassId: string;
  returns?: Partial<Record<1 | 3 | 5 | 10, CrossCheckPlatformReturn>>;
};

/** 官方來源衝突登記（ADR 0016）：兩個數字連各自日期照錄，唔平均、唔揀邊。 */
export type OfficialSourceConflict = {
  fundClassId: string;
  label: string;
  periodYears: number;
  trusteeValue: number;
  trusteeDataAsOf: string;
  platformValue: number;
  platformDataAsOf: string;
};

const CROSS_CHECK_PERIODS = [
  ["oneYear", 1],
  ["fiveYears", 5],
  ["tenYears", 10],
] as const;

/**
 * 逐行同積金局平台同期回報核對（紅線 3）：一年必須核對到，五年、十年兩邊同期都有就要一致。
 * 單位類別一年回報可以啱啱一樣（例如 D／I 類），所以多核五年、十年，減低類別對調而唔被發現。
 * 官方冇一年回報（`N/A` 或「-」）嘅行，只有平台都冇一年回報而且三年都係官方未提供先接受。
 *
 * 失敗分類（ADR 0016）：結構性失敗（表讀唔到、配對失敗、類別重複、計劃基金缺行）或者一年
 * 核對失敗照舊成份文件作廢。一行一年通過而 5／10 年同期嚴格比較唔等，屬官方來源衝突：
 * 只隔離該行——該行唔出任何紀錄（三年出自同一條內部序列，衝突未排除之前全部唔用），
 * 兩個官方數字連各自日期記入 `conflicts`。全部行都隔離視同整份作廢。
 */
export function verifyDocument(
  document: SourceDocument,
  options: {
    schemeRecords: readonly { fundClassId: string }[];
    checkRecords: readonly CrossCheckPlatformRecord[];
  },
): {
  observations: OfficialCumulativeReturnObservation[];
  source: {
    kind: SourceDocument["kind"];
    schemeName: string;
    url: string;
    retrievedAt: string;
    sha256: string;
    bytes: number;
    page?: number;
    dataAsOf: string;
    rows: number;
    matched: number;
    quarantinedRows: string[];
    officialNotDisclosed: string[];
    oneYearCrossChecks: number;
    fiveTenYearCrossChecks: number;
  };
  conflicts: OfficialSourceConflict[];
} {
  const { schemeName } = document;
  if (document.failed.length > 0)
    throw new Error(
      `${document.failed.length} row(s) not matched exactly: ${document.failed.join("; ")}`,
    );
  const matchedIds = document.matched.map((row) => row.fundClassId);
  if (new Set(matchedIds).size !== matchedIds.length)
    throw new Error("two source rows matched the same fund class");
  const missing = options.schemeRecords
    .filter((record) => !matchedIds.includes(record.fundClassId))
    .map((record) => record.fundClassId);
  if (missing.length > 0)
    throw new Error(`${missing.length} scheme fund(s) not in the source: ${missing.join(", ")}`);

  let oneYearChecks = 0;
  let longerChecks = 0;
  const problems: string[] = [];
  const conflicts: OfficialSourceConflict[] = [];
  const quarantined = new Set<string>();
  for (const row of document.matched) {
    const record = options.checkRecords.find((item) => item.fundClassId === row.fundClassId);
    const platformOneYear = record?.returns?.[1];
    if (!platformOneYear || platformOneYear.dataAsOf !== document.dataAsOf) {
      if (row.oneYear === null && row.threeYears === null && record && !platformOneYear) {
        oneYearChecks += 1;
        continue;
      }
      problems.push(
        `${row.fundClassId} has no platform one-year return dated ${document.dataAsOf}` +
          (platformOneYear ? ` (platform is ${platformOneYear.dataAsOf}; pass --check-source)` : ""),
      );
      continue;
    }
    for (const [field, period] of CROSS_CHECK_PERIODS) {
      const platform = record?.returns?.[period];
      const value = row[field];
      const platformValue = period === 1 ? platform?.annualized : platform?.cumulative;
      if (period === 1) {
        if (value === null || typeof platformValue !== "number") {
          problems.push(`${row.fundClassId} one-year source ${value} vs platform ${platformValue}`);
          continue;
        }
        oneYearChecks += 1;
      } else if (
        value === null ||
        typeof platformValue !== "number" ||
        platform?.dataAsOf !== document.dataAsOf
      ) {
        continue;
      } else {
        longerChecks += 1;
      }
      if (value !== platformValue) {
        if (period === 1) {
          problems.push(`${row.fundClassId} ${period}-year source ${value} vs platform ${platformValue}`);
        } else {
          conflicts.push({
            fundClassId: row.fundClassId,
            label: row.label,
            periodYears: period,
            trusteeValue: value,
            trusteeDataAsOf: document.dataAsOf,
            platformValue,
            platformDataAsOf: platform!.dataAsOf,
          });
          quarantined.add(row.fundClassId);
        }
      }
    }
  }
  if (problems.length > 0) throw new Error(`cross-check failed: ${problems.join("; ")}`);
  if (document.matched.length > 0 && quarantined.size === document.matched.length)
    throw new Error(
      `official-source conflict quarantine covers all ${quarantined.size} matched row(s) of ${schemeName} dated ${document.dataAsOf}: ${[...quarantined].join(", ")}; treating the whole document as conflicted (ADR 0016)`,
    );

  const observations: OfficialCumulativeReturnObservation[] = document.matched
    .filter((row) => !quarantined.has(row.fundClassId))
    .map((row) => ({
      fundClassId: row.fundClassId,
      periodYears: 3,
      basis: "cumulative" as const,
      cumulative: row.threeYears,
      printed: row.printedThreeYears,
      dataAsOf: document.dataAsOf,
      sourceUrl: document.url,
      retrievedAt: document.retrievedAt,
      sourceSha256: document.sha256,
    }));
  return {
    observations,
    source: {
      kind: document.kind,
      schemeName,
      url: document.url,
      retrievedAt: document.retrievedAt,
      sha256: document.sha256,
      bytes: document.bytes,
      ...(document.page === undefined ? {} : { page: document.page }),
      dataAsOf: document.dataAsOf,
      rows: document.rows,
      matched: document.matched.length,
      // 官方來源衝突而被隔離嘅行（ADR 0016）：該行連三年都唔發布，數字記入報告 officialConflicts。
      quarantinedRows: [...quarantined],
      // 官方印「-」或者 `N/A`：記錄為官方未提供（唔當 0），網站照講原因。
      officialNotDisclosed: document.matched
        .filter((row) => row.threeYears === null)
        .map((row) => row.fundClassId),
      oneYearCrossChecks: oneYearChecks,
      fiveTenYearCrossChecks: longerChecks,
    },
    conflicts,
  };
}
