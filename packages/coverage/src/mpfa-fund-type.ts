/**
 * 積金局基金類型：網站唯一的基金分類口徑（ADR 0011）。
 *
 * 英文 `en` 逐字等於積金局基金平台列表頁「Fund Type」欄（亦即平台快照的 `fundType`），
 * 中文 `zh` 逐字取自同一頁中文版同一隻基金的「基金類型」欄；`family` 是平台篩選的六個
 * 基金類別。2026-10-04 擷取時 451 隻基金類別逐隻對照，中英一對一，沒有例外。
 * 對不上的 `fundType` 一律報錯，不做模糊配對，亦不自行翻譯。
 */
export const MPFA_FUND_TYPE_SOURCE = {
  provider: "積金局強積金基金平台",
  urls: ["https://mfp.mpfa.org.hk/eng/mpp_list.jsp", "https://mfp.mpfa.org.hk/tch/mpp_list.jsp"],
  capturedAt: "2026-10-04",
  official: true,
} as const;

export type MpfaFundType = {
  en: string;
  zh: string;
  family: { en: string; zh: string };
};

export const MPFA_FUND_TYPES: readonly MpfaFundType[] = [
  { en: "Equity Fund - Asia Equity Fund", zh: "股票基金 - 亞洲股票基金", family: { en: "Equity Fund", zh: "股票基金" } },
  { en: "Equity Fund - China Equity Fund", zh: "股票基金 - 中國股票基金", family: { en: "Equity Fund", zh: "股票基金" } },
  { en: "Equity Fund - Europe Equity Fund", zh: "股票基金 - 歐洲股票基金", family: { en: "Equity Fund", zh: "股票基金" } },
  { en: "Equity Fund - Global Equity Fund", zh: "股票基金 - 環球股票基金", family: { en: "Equity Fund", zh: "股票基金" } },
  { en: "Equity Fund - Greater China Equity Fund", zh: "股票基金 - 大中華股票基金", family: { en: "Equity Fund", zh: "股票基金" } },
  { en: "Equity Fund - Hong Kong Equity Fund", zh: "股票基金 - 香港股票基金", family: { en: "Equity Fund", zh: "股票基金" } },
  { en: "Equity Fund - Hong Kong Equity Fund (Index Tracking)", zh: "股票基金 - 香港股票基金（追蹤指數）", family: { en: "Equity Fund", zh: "股票基金" } },
  { en: "Equity Fund - Japan Equity Fund", zh: "股票基金 - 日本股票基金", family: { en: "Equity Fund", zh: "股票基金" } },
  { en: "Equity Fund - Uncategorized Equity Fund", zh: "股票基金 - 未分類股票基金", family: { en: "Equity Fund", zh: "股票基金" } },
  { en: "Equity Fund - United States Equity Fund", zh: "股票基金 - 美國股票基金", family: { en: "Equity Fund", zh: "股票基金" } },
  { en: "Bond Fund - Asia Bond Fund", zh: "債券基金 - 亞洲債券基金", family: { en: "Bond Fund", zh: "債券基金" } },
  { en: "Bond Fund - Global Bond Fund", zh: "債券基金 - 環球債券基金", family: { en: "Bond Fund", zh: "債券基金" } },
  { en: "Bond Fund - Hong Kong Dollar Bond Fund", zh: "債券基金 - 港元債券基金", family: { en: "Bond Fund", zh: "債券基金" } },
  { en: "Bond Fund - RMB Bond Fund", zh: "債券基金 - 人民幣債券基金", family: { en: "Bond Fund", zh: "債券基金" } },
  { en: "Mixed Assets Fund - 21% to 40% Equity", zh: "混合資產基金 - 21% 至 40% 股票", family: { en: "Mixed Assets Fund", zh: "混合資產基金" } },
  { en: "Mixed Assets Fund - 41% to 60% Equity", zh: "混合資產基金 - 41% 至 60% 股票", family: { en: "Mixed Assets Fund", zh: "混合資產基金" } },
  { en: "Mixed Assets Fund - 61% to 80% Equity", zh: "混合資產基金 - 61% 至 80% 股票", family: { en: "Mixed Assets Fund", zh: "混合資產基金" } },
  { en: "Mixed Assets Fund - 81% to 100% Equity", zh: "混合資產基金 - 81% 至 100% 股票", family: { en: "Mixed Assets Fund", zh: "混合資產基金" } },
  { en: "Mixed Assets Fund - Default Investment Strategy - Age 65 Plus Fund", zh: "混合資產基金 - 預設投資策略-65歲後基金", family: { en: "Mixed Assets Fund", zh: "混合資產基金" } },
  { en: "Mixed Assets Fund - Default Investment Strategy - Core Accumulation Fund", zh: "混合資產基金 - 預設投資策略-核心累積基金", family: { en: "Mixed Assets Fund", zh: "混合資產基金" } },
  { en: "Mixed Assets Fund - Uncategorized Mixed Asset Fund", zh: "混合資產基金 - 未分類混合資產基金", family: { en: "Mixed Assets Fund", zh: "混合資產基金" } },
  { en: "Guaranteed Fund", zh: "保證基金", family: { en: "Guaranteed Fund", zh: "保證基金" } },
  { en: "Money Market Fund - MPF Conservative Fund", zh: "貨幣市場基金 — 強積金保守基金", family: { en: "Money Market Fund - MPF Conservative Fund", zh: "貨幣市場基金 — 強積金保守基金" } },
  { en: "Money Market Fund - Other than MPF Conservative Fund", zh: "貨幣市場基金 — 不包括強積金保守基金", family: { en: "Money Market Fund - Other than MPF Conservative Fund", zh: "貨幣市場基金 — 不包括強積金保守基金" } },
];

const byEnglish = new Map(MPFA_FUND_TYPES.map((type) => [type.en, type]));
const byChinese = new Map(MPFA_FUND_TYPES.map((type) => [type.zh, type]));

/** 平台 `fundType` 原文 → 積金局基金類型；缺少或不在官方清單內回傳 undefined。 */
export function mpfaFundTypeOf(fundType: string | undefined): MpfaFundType | undefined {
  return fundType === undefined ? undefined : byEnglish.get(fundType.trim());
}

/** 中文類型名稱（比較組別的鍵）→ 積金局基金類型。 */
export function mpfaFundTypeByName(name: string): MpfaFundType | undefined {
  return byChinese.get(name);
}

/** 發布前斷言：每個 `fundType` 都必須在官方清單內，否則整份發布停下。 */
export function assertMpfaFundTypes(records: { fundClassId: string; fundType?: string }[]) {
  const unknown = records.filter((record) => !mpfaFundTypeOf(record.fundType));
  if (unknown.length > 0) {
    throw new Error(
      `MPFA fund type missing or not in the official list for ${unknown.length} fund class(es): ${unknown
        .slice(0, 5)
        .map((record) => `${record.fundClassId}=${JSON.stringify(record.fundType ?? null)}`)
        .join(", ")}`,
    );
  }
}
