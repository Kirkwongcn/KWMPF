# 2026-10-12 中國人壽及 MASS 三年年率化回報更新

評估日：2026-10-12（UTC）。候選檔就地更新 `data/coverage/2026-10-12-official-return-observations-candidate.json`，
報告 `factSheetRefresh` 一節有來源 manifest（URL、Last-Modified、SHA-256、取得時間）同逐行改動。

## 來源

| 計劃 | 來源 | 截至 | 行數 |
| --- | --- | --- | ---: |
| 中國人壽 | 受託人官網 2026 年第二季基金表現便覽 | 2026-06-30 | 10 |
| MASS | 萬通信託官網逐隻基金便覽 `app2.yflife.com/MPFWeb/pdf/fact_sheet/<code>_E.pdf`（Published in September 2026） | 2026-07-31 | 14 |

MASS 官網便覽已改為每月出（約落後兩個月），唔再係季度。

## MASS parser：年份斷行

官網版左窄欄排成「Fund Data as at July 31,」（同一行右邊係「Fund Price (HKD)」），年份「2026」落咗下一行行頭。
舊 regex 只容許月份同日期斷開，十四份全部報「data-as-of date is missing」。新增一個後備式樣：
日期逗號後同一行冇年份，就取下一行行頭四位數年份；兩個式樣都唔中照舊報錯。新測試喺舊 parser 上 fail。

## 結果

- 換新 20 行：中國人壽 6 行（2025-12-31 → 2026-06-30）、MASS 14 行（2026-06-30 → 2026-07-31）。
- 新增 4 行：中國人壽 US Equity、Retire-Easy Global Equity、Balanced、Age 65 Plus（舊 parser 每版漏讀第二隻，#383 修正）。
- 其餘 431 行（包括 156 行累積回報）逐字不變。
- 24 個數值逐個用 `pdftotext -layout` 對返該份便覽自己嘅「1 year / 3 years」表頭讀第二格核對一致；
  MASS 核心累積及 65 歲後取「Fund」行，唔取「Reference Portfolio」行。

## 時效

三年回報用季度 90 日時限（ADR 0007，publication 凍結 `threeYearReturnGraceDays: 90`），唔係一、五、十年嗰個 60 日。

- MASS 2026-07-31：73 日，重新入三年排名，至 2026-10-29。
- 中國人壽 2026-06-30：104 日，已過時限，只更新基金頁。

`check-publication-seed.sh`（source `2026-10-12/mpf-fund-platform.json`）新舊候選對比：
`rankingRows` 54 → 68、`excludedStaleCount` 241 → 231（MASS 14 隻轉回有效；中國人壽新增 4 行計入過期）。

本機 API `/fund-classes/<id>` 抽三筆：

| 基金 | API 三年 | 截至 | 原文 |
| --- | ---: | --- | --- |
| 中國人壽 Hong Kong Equity（`mpfa-cf-895`） | 7.72 | 2026-06-30 | 年率化行 `- - -1.17 7.72 -5.61 3.75 3.49` |
| 中國人壽 US Equity（`mpfa-cf-1840`） | 18.68 | 2026-06-30 | 年率化行 `- - 24.41 18.68 - - 7.50` |
| MASS Hong Kong Equities（`mpfa-cf-389`） | 10.21 | 2026-07-31 | HKEF：`Annualized Return 11.68% 10.21% 0.89% 4.75% 2.76%` |

三年 `returnSources` 各自帶受託人 URL 同截至日，一年仍係積金局平台 2026-09-30。
