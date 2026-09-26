# ADR 0007 — 季度 factsheet 三年回報採用 90 日 freshness

日期：2026-09-26
狀態：已接受（使用者批准）

## 決定

受託人季度 factsheet 提供的三年年化回報，自該 factsheet 的 `dataAsOf` 起最多採用 **90 個日曆日**。第 90 日仍可列入排名；第 91 日起標為 stale，並從排名剔除。排名每一列都保留官方來源及資料截至日期。

此規則只用於三年年化回報。其他月度回報與基金規模維持 45 日；基金現行狀態及基金概覽沿用各自 freshness policy。

## 實作約束

- 新發布的 publication payload 將 `threeYearReturnGraceDays: 90` 存入 `provenance.freshnessPolicy`。
- Seed build 和 API 對 period 3 的 return freshness 使用 90 日；其他 period 使用既有 `returnsGraceDays`。
- API 的排名 methodology 回傳所選期間的寬限日數，頁面需展示該期限及每行的原 `dataAsOf`。
- 舊快照若無 `threeYearReturnGraceDays`，沿用其既有 `returnsGraceDays`；新規則不回溯改寫已發布判斷。
- 不推算、改寫或補造 factsheet 日期。資料晚於 90 日一律排除，即使數值仍可在基金詳情顯示。

## 背景

2026-09-26 的來源稽核在 57 份成功下載的官方 trustee factsheet 中，最新三年回報截至 2026-07-31，距稽核日 57 日。既有 45 日月度門檻令 211 筆舊觀察全部退出排名。MASS 日期修正後，213 筆候選中 161 筆在 90 日內；18 筆截至 2026-05-31 及 34 筆保留的 2025-12-31 觀察仍須排除。5 筆身份未能安全配對，沒有模糊配對。候選數據及來源限制見 PR #274。

## 後果

- 90 日內且通過來源與身分驗證的季度回報可以進入三年排名。
- 介面依 API 提供的 freshness methodology 顯示 90 日規則；排名行保留來源及截至日期，避免把季度資料誤認為當月數值。
- 每次發布仍須核對非空排名與三筆官方來源；候選本身需獨立審閱及批准。


## 驗證紀錄（2026-09-27）

使用 PR #273 修正日期後的候選 observations 及本 ADR 的 90 日規則，以 2026-09-26 platform snapshot（451 個基金類別）產生 seed，套用 213 筆觀察。將兩份 D1 migration 及 seed 載入記憶體 SQLite，再用 API 的 returnGraceDaysForPeriod 與 evaluateFreshness helpers 評估每個三年回報，2026-09-27 結果為 161 筆 eligible、52 筆 stale；排名非空。

三筆官方 factsheet 抽樣一致：AIA 22.31%（2026-05-31，因超過 90 日排除）、BEA 12.95%（2026-06-30，納入）、Fidelity HK Tracker 11.90%（2026-07-31，納入）。本機缺少 Bun/Wrangler，Bash 啟動受限，因此未執行 Wrangler HTTP GET gate，也未接觸 staging 或 production。PR #271 已把候選 overlay 接入該 gate，待 90 日政策及 workflow 可在同一 CI base 使用後重跑。
