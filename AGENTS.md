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
目前只有 Lipper 香港退休基金分類（`lipper-hk-pension-categories.json`，見 #194）。
這些數據屬非官方來源，顯示時須標明出處及期別，不可與官方平台數據混為一談。
MPF Navigator 檔案的 Sheet1（風險取向配置比重）不在範圍內，不要入庫或引用。

## End-to-end tests

`bun run e2e` 會用 `scripts/e2e-serve-api.sh` 把已發布快照載入本機 D1，啟動本機 Worker 及 `vite preview`，再以 Playwright 在桌面及手機兩個 project 跑跨頁流程。首次執行前需安裝瀏覽器：`cd apps/e2e && node node_modules/@playwright/test/cli.js install chromium`。E2E 不屬於 `bun run check`，在 CI 由獨立 job 執行。

## Canonical specification

第一版實作以 `docs/specs/2026-08-08-hk-mpf-comparison-v1-implementation-spec.md` 為準。較早的計劃和研究文件只作決策來源及背景。

## User milestone preference

當工作進入最終網站設計及網域接入階段，先通知使用者；未獲確認前不處理正式網域或最終公開發布。
