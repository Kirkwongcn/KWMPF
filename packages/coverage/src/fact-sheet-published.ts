import type { FactSheetTemporalScopes } from "./fact-sheet-temporal";

/**
 * 已發布 payload 入面「一份便覽披露」的形狀，抽取、seed、API 同網站共用。
 *
 * 之前 API 同網站各自抄一份，加一個代號（`unreadable-layout`）要改三處，漏一處
 * 型別檢查都唔會發現——網站會當冇呢個代號，靜靜講錯原因。所以集中喺度，唔好再喺
 * 各 app 重新聲明。呢個檔只放型別同常數，唔 import Node 或 PDF 模組，Worker 同
 * 瀏覽器都用得。
 */

export const NARRATIVE_FIELDS = [
  "investmentObjective",
  "managerCommentary",
  "marketForecast",
  "investmentManager",
] as const;

export type NarrativeField = (typeof NARRATIVE_FIELDS)[number];

/** 便覽官方文字欄位（ADR 0012）：原文照錄，中英各一份，唔由本站翻譯補齊。 */
export type NarrativeText = {
  /** 便覽自己的標題原文（中英對照時連埋兩個語文）。 */
  heading: string;
  /**
   * 同一期便覽（一份或逐隻基金一份）有幾多隻基金的同一欄位一字不差（包括本基金）。
   * 多過一隻即係計劃共用的市場評論，網站要標明，唔可以當成呢隻基金專屬的評論。
   */
  sharedAcrossFunds?: number;
  zh?: string;
  en?: string;
};

export type FactSheetNarrative = Partial<Record<NarrativeField, NarrativeText>>;

/**
 * 「點解冇呢一塊」的分類代號。原因文字係診斷用的英文長句，網站唔可以靠字串比對
 * 反推分類，所以另附代號。
 *
 * - `not-disclosed`：便覽該區段根本冇呢一塊，即官方未提供。
 * - `chart-only`：官方有披露但只畫成圖表／向量，唔係文字。
 * - `values-without-names`：有百分比但名稱畫成向量，出局部名單等於改寫官方披露。
 * - `overlaid-text-layer`：文字層把另一隻基金的同一張表疊印上去，分唔清邊個數值屬邊隻。
 * - `unreadable-layout`：官方有印，但跨頁或改為並排，讀唔齊；唔可以講成官方未提供。
 */
export type FactSheetUnavailableKind =
  | "not-disclosed"
  | "chart-only"
  | "values-without-names"
  | "overlaid-text-layer"
  | "unreadable-layout";

/** 一個披露維度。`heading` 是便覽自己用的標題原文，不是我們改寫的維度名。 */
export type AllocationEntry = { label: string; percent: number };
export type AllocationDimension = { heading: string; entries: AllocationEntry[] };

/** 官方只列名次同證券名、冇披露持有量時 `percent` 會缺席，唔可以當成 0。 */
export type TopHolding = { rank: number; security: string; percent?: number };

/** Explicit N/A in an identified official return cell, never inferred from a gap. */
export type OfficialReturnUnavailable = {
  reason: "official-na";
  dataAsOf: string;
  sourceUrl: string;
  sourceSha256: string;
  page: number;
};

export type FactSheetSource = "trustee" | "mpfa-registry";

/**
 * 讀已發布 payload 用的形狀。標成 optional 的欄位係舊快照冇的（帶來源、帶代號、
 * 文字欄位都係後來先加），讀嘅一方要處理缺席，唔可以假設一定有。
 */
export type PublishedFactSheetPayload = {
  schemeName?: string;
  constituentFundName?: string;
  factSheetFile: string;
  factSheetUrl?: string;
  /** `trustee` 係受託人官網最新一期，`mpfa-registry` 係退回積金局副本，兩者期別唔同。 */
  factSheetSource?: FactSheetSource;
  /** 有抄錄受託人來源但抽唔到，先至退回副本；未抄錄嘅計劃冇呢一欄。 */
  trusteeFallback?: true;
  factSheetAsOf: string;
  temporalScopes?: FactSheetTemporalScopes;
  allocations: AllocationDimension[];
  topHoldings: TopHolding[];
  narrative?: FactSheetNarrative;
  unavailableFields: string[];
  returnUnavailable?: Record<string, OfficialReturnUnavailable>;
  unavailableReasons: Record<string, string>;
  unavailableKinds?: Record<string, FactSheetUnavailableKind>;
};
