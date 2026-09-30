# KWMPF

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

一般強積金成員及專業研究者同等重要。使用者於 2026-09-30 確認：簡潔首頁，加深入分析模式。手機與桌面都須完成搜尋、同組比較及來源核對。

## Product Purpose

整理香港強積金計劃、成分基金及基金類別的官方披露，協助理解回報、風險、費用及資料限制。最小比較單位是基金類別；沒有推薦總分或個人化投資建議。

## Capabilities and Constraints

- React / Vite 前端；Hono Worker API；D1 發布快照；私有 R2 原始文件、manifest 及備份；GitHub Actions 處理批次。
- 只讀取已發布快照；候選資料先驗證及覆核。
- 官方數值、來源及每個欄位日期須保留；缺失不可填零；圖表不可合成未披露時間序列。
- 排名只在同一比較組別內；Lipper 分類及編輯歸類須明示非官方。
- 月度數值 45 日、季度三年回報 90 日；依欄位採用凍結的政策，過期數據仍可查看但不排名。
- 比較組平均最少三隻；解讀門檻仍屬試用，待驗證。
- 正式發布使用受保護環境；新增版本發布需按使用者既有里程碑要求確認。

## Brand Commitments

KWMPF / Kirk Wong Research。繁體中文優先、免費及無廣告。沒有使用者指定的新色盤或字型。

## Evidence on Hand

`CONTEXT.md`、canonical implementation spec、ADR、官方平台快照、受託人便覽及觀察候選、來源核對報告、部署與備份紀錄。官方平台截至日期不能當成所有便覽欄位的日期。

## Product Principles

1. 先交代可以比較甚麼，再顯示結果。
2. 源資料與網站計算分清楚；數字可以逐項查證。
3. 搜尋應完整、可翻頁且不暗示推薦。
4. 圖表揭示資料，不補造資料。

## Source of Product Truth

以 `AGENTS.md`、`CONTEXT.md`、ADR 及 canonical implementation spec 的原資料政策為準。此文件記錄已確認的產品目的，不能用來宣称尚未驗收的功能。
