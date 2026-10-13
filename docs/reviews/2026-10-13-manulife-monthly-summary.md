# 2026-10-13 宏利環球精選《每月摘要》：官方三年累積回報（每月）

評估日：2026-10-13（UTC）。

## 來源調查

| 受託人 | 結果 |
| --- | --- |
| 宏利環球精選 | 《每月摘要 Monthly Fund Summary》（固定網址 `zh-hk/documents/fund-price/mpf-monthly-summary.pdf`，Last-Modified 2026-09-15）截至 2026-08-31，29 隻基金有三年**累積**回報 → 採用 |
| 宏利退休精選 | 逐隻基金便覽改咗每月（截至 2026-08-31），但累積只有 1 個月、3 個月、1、5、10 年同成立至今，年率化只有 1、5、10 年同成立至今，冇三年 → 維持官方未提供 |
| 友邦 | 官網目錄最新仍係 jul-2026；aug／sep 網址 404 |
| 萬通（MASS） | 便覽仍然截至 2026-07-31 |
| 富達、海通 | 仍然截至 2026-08-31 |
| 永明 | 官網接口 `MPF_CR_PERFORMANCE` 仍然係 2026-06-30 |

## 讀取及核對

`packages/coverage/src/manulife-monthly-summary-parser.ts` 用 `pdftotext -bbox` 按欄位讀：以推出日期定位每行
（預設投資策略基金有「SHK148/」「DIS148」兩個編號），英文名斷行照接、名後註腳剔走；「不適用▲」（上）
「N/A▲」（下）一對先當官方未提供；每欄剛好一格，否則整份報錯。

`build-monthly-summary-returns.ts --manulife`，`--check-source data/sources/2026-09-26/mpf-fund-platform.json`
（積金局平台 2026-08-31）：29 隻英文名精確配對；一年 29／29、五年及十年 55／55 同平台逐行一致。

## 資料

候選 `data/coverage/2026-10-12-official-return-observations-candidate.json` 追加 29 行 `basis: "cumulative"`
（截至 2026-08-31），其餘 504 行逐字不變；報告 `manulifeMonthlySummary` 一節有來源 SHA-256 同核對數目。
同一基金嘅季度年率化（截至 2026-06-30）保留，兩者分欄並存，唔互相換算。

`check-publication-seed.sh`：`rankingRows` 68、`excludedStaleCount` 280 不變（累積回報唔入年率化排名）。
本機 API `/fund-classes/<id>` 抽三筆：

| 基金 | 三年累積（官方） | 截至 | 原文 |
| --- | ---: | --- | --- |
| 核心累積（`mpfa-cf-1485`） | 41.17 | 2026-08-31 | `4/1/2017 19.247 4.60 8.09 12.64 41.17 30.43 N/A▲` |
| 亞太股票（`mpfa-cf-370`） | 82.62 | 2026-08-31 | `12/1/2000 50.425 9.44 28.67 43.34 82.62 50.53 153.44` |
| 退休收益（`mpfa-cf-1719`） | 10.85 | 2026-08-31 | `9/21/2020 9.427 -1.58 2.08 3.86 10.85 -13.81 N/A▲` |

## 自動更新

每日工作流程加入宏利：固定網址只得最新一期，「As at」日期同平台快照日期唔一樣就略過（source-behind／
source-ahead）；下載失敗或者 source-ahead 即刻開跟進 issue。官網擋普通 curl，經
`scripts/download-pdf-impersonated.py`（curl_cffi，chrome124 → 403 → chrome150）下載。
