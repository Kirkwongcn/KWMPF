# KWMPF 即時交接

最新狀態見 [#400 逐項核對及待放行記錄](reviews/2026-11-12-pr400.md)。main 已至 ac72c13，正式部署 #52 等候放行。以下是上一個已驗證的正式發布。

更新於 2026-11-12 香港時間。GitHub main 與正式網站版本為 `248c46e6bbf5b7433a06c97c53c9c2ee2727abe1`。[#402 費率及發布記錄](reviews/2026-11-12-pr402.md) 列出七項原文、日期、精度、來源及驗收。正式網站採用 2026-10-31 平台快照，覆蓋 451 個基金類別、24 個計劃、11 個受託人。三年年率化排名 37 筆、313 筆過期排除。

## 取得目前工作

- Repo 為 https://github.com/Kirkwongcn/KWMPF.git 。交接分支 `docs/status-audit-20261112` 已納入上述 main。取得該分支並核對遠端完整 SHA；最新文件 commit 由交付回執提供。
- 本次 checkout 在 C:/Users/user/Documents/Codex/2026-09-26/kwmpf/work/kwmpf-review-redesign。官方原頁網址、原印值、資料日期、來源 HTML 與批次 SHA-256 均在 GitHub 的 [覆核記錄](../data/sources/2026-11-10/review-disposition.json)。本機抓取 HTML 與隔離測試 SQL 放在工作區 outputs/pr402-review，未上傳到 R2；重建請用 repo 的候選與已記錄的來源。私有 R2 歷史交接指標本次未改。
- [原獨立審計](reviews/2026-11-12-independent-status-audit.md) 保存 #399、#396 及部署 #50 的歷史證據。其 main、部署、#402 待辦已由 #51 更新。歷史的跨工具／R2 資料見[上一版交接](https://github.com/Kirkwongcn/KWMPF/blob/ca48b181283b225d33ff33fe502854d5c7034f70/docs/HANDOFF.md)。

## 本次交付

- 積金局平台每週三香港時間 03:00 排程擷取並建立候選；受託人回報每日排程。核實了實際 scheduled run。#402 同時修正後續新候選 JSON 的格式化。
- #403 修復 CI 瀏覽器 runner 與鍵盤測試對固定日期樣本的依賴；#402 通過完整 CI 及 production source preflight。兩個積壓的正式備份成功完成，正式部署 #51 已完成並通過 R2 release tuple 核對。
- 已從正式 API 獨立讀回完整版本、月份、七項費率及上限。Chrome 首頁已呈現十月資料。未做整套正式站 E2E、還原演練或 NAS／其他 LLM 接收測試。
- 後續合併及發布依使用者當次授權、來源審查及正式環境保護執行。本次有條件批准涵蓋 #402 的合併、部署及必要設定。

## 接手頭三步

1. 核實遠端 main、交接 branch 與 /health，再讀 AGENTS.md、CONTEXT.md、[專案地圖](PROJECT_MAP.md)及[待辦](NEXT_TASKS.md)。
2. 審查 #400 是否仍有可用增量；九月受託人回報須對九月平台核對。三年缺口以來源及各欄位日期跟進。
3. 核對下一個受託人及平台排程的日期、數量、原檔和候選。就 #396 追蹤隔離行、無變更批次的證據保留及官方計算方法。
