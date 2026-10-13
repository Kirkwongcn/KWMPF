# 2026-10-13 中銀保誠簡易強積金：官網接口官方三年累積回報（每月）

評估日：2026-10-13（UTC）。

## 來源調查

使用者喺網絡允許清單加入 `www.boci-pru.com.hk` 同中國人壽受託人網域之後再查：

| 受託人／計劃 | 結果 |
| --- | --- |
| 中銀保誠簡易強積金 | 官網「強積金價格及表現」（`https://www.boci-pru.com.hk/en/mpf/mpf-prices`）累積回報分頁，數據來自 `POST /en/api/mpf/MpfFund/mpfListing`（body `{"Lang":"en"}`）；17 隻基金全部 `asOfDate` 2026-08-31，有 1、3、5 年同成立至今累積回報 → 採用 |
| 我的強積金計劃（同一受託人） | 唔喺呢個接口；官網冇其他計劃清單 → 維持季度便覽 |
| 中國人壽集成信託 | 官網下載區只有季度《Fund Performance Review》（第二季已用）；「每日價格」轉去 `onepartner.chinalife.com.hk`，網絡唔准，而且只係價格，唔係回報 → 冇每月三年來源 |

## 讀取及核對

`packages/coverage/src/boci-prudential-mpf-listing.ts`：

- 表頭 `header.cumulative` 要有「1Y」「3Y」「5Y」而冇「10Y」；回應入面嘅 `tenY` 全部留空，唔當官方數字，亦唔核對。
- 每隻基金 `asOfDate` 必須一樣。
- 一年、三年要係 `12.34` 格式。
- 五年留空記官方未提供（香港穩定退休基金 2022 年成立）。
- 英文名只准有 `<sup>…</sup>` 註腳標記，去掉後精確配對。

以上任何一項唔啱，整份報錯。三年留空今期冇出現，出現就整份停低，等人手確認官方點寫，唔估係「-」定「N/A」。

`build-monthly-summary-returns.ts --bocpru`，`--check-source data/sources/2026-09-26/mpf-fund-platform.json`
（積金局平台 2026-08-31）：17 隻英文名精確配對；一年 17／17、五年 16／16 同平台逐行一致。

## 資料

候選 `data/coverage/2026-10-12-official-return-observations-candidate.json` 追加 17 行 `basis: "cumulative"`
（截至 2026-08-31），其餘 533 行逐字不變。報告 `bociPrudentialListing` 一節記錄：

- 接口回應 SHA-256 `11cb6af3…af0e`（23,527 bytes，讀取 2026-10-13T08:05:07Z）；
- 核對數目。

同一基金嘅季度年率化（截至 2026-06-30）保留，兩者分欄並存，唔互相換算。

`check-publication-seed.sh`：`rankingRows` 68、`excludedStaleCount` 280 不變（累積回報唔入年率化排名）。
本機 API `/fund-classes/<id>` 抽三筆：

| 基金 | 三年累積（官方） | 截至 | 接口原文 |
| --- | ---: | --- | --- |
| 核心累積（`mpfa-cf-1541`） | 41.8 | 2026-08-31 | `"oneY":"13.15","threeY":"41.80","fiveY":"31.33"` |
| 北美指數追蹤（`mpfa-cf-1000`） | 68.82 | 2026-08-31 | `"oneY":"18.69","threeY":"68.82","fiveY":"65.78"` |
| 強積金保守（`mpfa-cf-230`） | 9.03 | 2026-08-31 | `"oneY":"1.91","threeY":"9.03","fiveY":"12.19"` |

API 嘅 `printed` 照錄原文（`41.80`）。

## 自動更新

每日工作流程加入中銀保誠：

- 用 `curl` POST 下載（普通 curl 已得，唔使瀏覽器指紋）。
- `asOfDate` 同平台快照日期唔一樣就略過（source-behind／source-ahead）。
- 下載失敗或者 source-ahead 即刻開跟進 issue。
