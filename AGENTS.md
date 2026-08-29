# KWMPF

香港強積金計劃及基金比較網站。開始工作前先閱讀 `CONTEXT.md`、相關 ADR，以及 canonical implementation spec。

## Agent skills

### Issue tracker

工作項目以 GitHub Issues 管理。詳見 `docs/agents/issue-tracker.md`。

### Triage labels

採用五個預設 triage labels。詳見 `docs/agents/triage-labels.md`。

### Domain docs

本專案採用 single-context：根目錄 `CONTEXT.md` 配合 `docs/adr/`。詳見 `docs/agents/domain.md`。

## Reference datasets

`data/reference/` 存放使用者提供、非官方來源的參考資料，原始檔留在 `data/sources/`。
目前有 Lipper 香港退休基金分類（`lipper-hk-pension-categories.json`，見 #194）
及由它產生的基金對照表（`fund-class-category-map.json`）。對照表由
`bun --filter @kwmpf/coverage category-map <平台快照路徑>` 重建，會一併輸出與舊版的差異報告；
未能配對的基金會報錯，不可靜默回退到平台 `fundType`。
這些數據屬非官方來源，顯示時須標明出處及期別，不可與官方平台數據混為一談。
對照表在 `publication-seed` 時寫入每筆快照 payload 的 `lipperCategory`，網站的比較組別由
`apps/api/src/comparison-group.ts` 統一決定；計劃不在 Lipper 來源內的基金以「平台分類：」前綴自成一組。
MPF Navigator 檔案的 Sheet1（風險取向配置比重）不在範圍內，不要入庫或引用。

## Official scheme fact sheets

積金局的「基金便覽」按計劃發布，連結抄錄自〈註冊強積金計劃及成分基金〉登記冊，存放於
`data/sources/<YYYY-MM-DD>/fund-fact-sheet-links.json`。`packages/coverage/src/fact-sheet-lookup.ts`
只認 `YYYY-MM-DD` 目錄，取最新一個帶有該檔案的批次，並在 `publication-seed` 時把
`schemeFactSheet`（連結、抄錄日期、登記冊網址）寫入每筆快照 payload。
快照內有計劃在連結檔中找不到就會報錯，不可靜默略過。
檔案編號的前綴代表計劃類型（`MT` 集成信託、`IS` 行業、`ES` 僱主營辦），不可由編號推算。
更新做法：開新的日期目錄，由登記冊重新抄錄全部計劃，再重跑 seed。

## End-to-end tests

`bun run e2e` 會用 `scripts/e2e-serve-api.sh` 把已發布快照載入本機 D1，啟動本機 Worker 及 `vite preview`，再以 Playwright 在桌面及手機兩個 project 跑跨頁流程。首次執行前需安裝瀏覽器：`cd apps/e2e && node node_modules/@playwright/test/cli.js install chromium`。E2E 不屬於 `bun run check`，在 CI 由獨立 job 執行。

## Canonical specification

第一版實作以 `docs/specs/2026-08-08-hk-mpf-comparison-v1-implementation-spec.md` 為準。較早的計劃和研究文件只作決策來源及背景。

## User milestone preference

當工作進入最終網站設計及網域接入階段，先通知使用者；未獲確認前不處理正式網域或最終公開發布。
