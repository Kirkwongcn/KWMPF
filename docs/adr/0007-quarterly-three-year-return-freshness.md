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

2026-09-26 的來源稽核在 57 份成功下載的官方 trustee factsheet 中，最新三年回報截至 2026-07-31，距稽核日 57 日。既有 45 日月度門檻令 211 筆三年回報全部退出排名。候選中有 147 筆資料截至日期在 90 日內；18 筆較早的 2026-05-31 觀察及 48 筆 2025-12-31 觀察仍須排除。官方來源抽查及候選限制記錄於 KWMPF handoff follow-up report dated 2026-09-26.

## 後果

- 90 日內且通過來源與身分驗證的季度回報可以進入三年排名。
- 介面依 API 提供的 freshness methodology 顯示 90 日規則；排名行保留來源及截至日期，避免把季度資料誤認為當月數值。
- 每次發布仍須核對非空排名與三筆官方來源；候選本身需獨立審閱及批准。
