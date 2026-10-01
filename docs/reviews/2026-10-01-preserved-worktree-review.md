# 保存區未提交修改逐檔核對（2026-10-01）

執行者：Claude Code（Anthropic 雲端 Linux 容器）。範圍：R2 還原（固定 index `d17b0602…`）所得 16 個舊 checkout 中，**不在 GitHub 任何分支**的 50 個 tracked 檔案修改。對照基線：GitHub `main` `6a593dba460b905badbfca9e9eac85a16318309e`。
本文件只列 repo 路徑及結論；私人檔案內容沒有提交。**沒有把任何舊修改套回工作分支。**

## 方法

1. 每檔取三份：checkout 保存的 HEAD 版本（base）、保存的未提交版本（dirty）、`main` 版本。
2. 換行正規化（舊 checkout 為 Windows CRLF）後執行 `git merge-file main base dirty`。合併結果等於 `main` → 修改已完整被吸收（22 檔）。
3. 其餘 28 檔：列出 base→dirty 新增而 `main` 沒有逐字出現的行，逐行在 `main` 搜尋等同功能或較新描述，人手判斷。
4. 所有 checkout HEAD 都是 `main` 的祖先或已被取代的分支；50 檔在其 HEAD 之後 `main` 都再修改過。

## 結論

| 結論 | 檔數 |
| --- | ---: |
| 已取代：三方合併後與 main 相同 | 22 |
| 已取代：衝突只因鄰近新增，內容已在 main／main 為超集 | 6 |
| 已取代：main 有較新／較準確描述、搬檔、重構或設計改變 | 19 |
| 部分過時，但揭示 main 文件錯誤（P-01） | 1 |
| **未在 main 且仍適用**（P-02） | 2 |

**已驗證**：沒有任何未提交的程式碼、測試、workflow 或資料修改需要搬回 main。值得跟進的只有下列兩項文件問題。

### P-01（已驗證，P2）`docs/deployment.md:46` 與 workflow 不符

`main` 的 `docs/deployment.md` 第 46 行寫「部署前先跑 `bun run check` 及完整 `bun run e2e`」。實際 `.github/workflows/deploy-production.yml:49-55` 只查同一 SHA 的 `main` push CI 是否成功並沿用，不在部署時重跑；而 `ci.yml:64-66` 的 E2E job 只在 `pull_request` 執行，`main` push 只跑 verify。
舊 checkout 修改（#24）曾改為「重用同 SHA CI，CI 已跑完整 e2e」，但後半句在現行 CI 下亦不正確。建議：改寫為「部署重用同 SHA `main` push CI（verify）成功；完整 E2E 在 PR 階段執行」，獨立文件 PR，按改動政策處理。

### P-02（已驗證，P2）ADR-0001 及 v1 規格仍寫「正常批次自動發布／每日預算排名」

`docs/adr/0001-github-cloudflare-deployment.md:14` 及 `docs/specs/2026-08-08-hk-mpf-comparison-v1-implementation-spec.md:124` 仍描述正常批次自動發布、排名每日預先計算。現況（已核實 `main`）：正式部署只有手動 `workflow_dispatch`；`apps/api/wrangler.jsonc` 沒有 `crons`；排名在請求時計算；來源擷取是每週二 19:00 UTC 排程（`refresh-source-snapshot.yml`）並經 PR 審查。
舊 checkout 修改（#23、#25）曾補記此差異，但引用 `08e269f`／PR #270 等已過時 SHA，不宜原文搬回。依 AGENTS「改到 ADR 前提要先更新對應 ADR」，建議由使用者決定：補一份 superseding ADR，或在 ADR-0001／規格加有日期的實作狀態補記（引用現行 SHA）。

## 逐檔結果

| # | checkout @ HEAD | 檔案 | 結論 | 依據 |
| --- | --- | --- | --- | --- |
| 00 | `current-main-clean` @ `391778845` | `.github/CODEOWNERS` | 已取代 | main 已有同一行 CODEOWNERS（另加其他行） |
| 01 | `current-main-clean` @ `391778845` | `.github/workflows/ci.yml` | 已取代 | main 已有相同 E2E 略過條件及摘要文字 |
| 02 | `current-main-clean` @ `391778845` | `docs/deployment.md` | 已取代（main 較新） | main 同段已改寫為 staging 演練完成後的較準確描述 |
| 03 | `current-main-clean` @ `391778845` | `scripts/high-risk-paths.txt` | 已取代 | main 已有同一 high-risk 路徑 |
| 04 | `work/restore-import-output` @ `d1de6993e` | `.github/workflows/restore-r2-d1.yml` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 05 | `work/restore-import-output` @ `d1de6993e` | `.github/workflows/verify-production-release-manifest.yml` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 06 | `work/restore-import-output` @ `d1de6993e` | `docs/deployment.md` | 已取代（main 較新） | main 已記錄 manifest read-back run #3 成功，舊「仍需讀回」已過時 |
| 07 | `work/search-result-a11y` @ `57a7a6792` | `apps/web/src/App.tsx` | 已取代（重構） | 首頁搜尋已移至 FundsPage，main 以 role=status／aria-live 顯示符合總數 |
| 08 | `work/KWMPF` @ `08e269f21` | `.github/workflows/backup-d1.yml` | 已取代 | main 已有同等改動，`actions/cache` 已升至 v6 |
| 09 | `work/KWMPF` @ `08e269f21` | `.github/workflows/deploy-production.yml` | 已取代 | 同上，cache v6 |
| 10 | `work/KWMPF` @ `08e269f21` | `.github/workflows/deploy-staging.yml` | 已取代 | 同上，cache v6；wrangler 步驟按 main 現行結構 |
| 11 | `work/KWMPF` @ `08e269f21` | `.github/workflows/refresh-source-snapshot.yml` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 12 | `work/KWMPF` @ `08e269f21` | `.github/workflows/restore-drill.yml` | 已取代（main 較新） | main 的 restore-drill 查詢已擴充 comparison_group_stats 檢查，cache v6 |
| 13 | `work/KWMPF` @ `08e269f21` | `apps/e2e/playwright.config.ts` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 14 | `work/KWMPF` @ `08e269f21` | `apps/web/src/FundClassPage.test.tsx` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 15 | `work/KWMPF` @ `08e269f21` | `apps/web/src/FundClassPage.tsx` | 已取代 | 全部新增行已在 main |
| 16 | `work/KWMPF` @ `08e269f21` | `apps/web/src/FundsPage.test.tsx` | 已取代（重構） | main 測試已涵蓋費用上限及過期標示；搜尋請求斷言按新分頁結構 |
| 17 | `work/KWMPF` @ `08e269f21` | `apps/web/src/FundsPage.tsx` | 已取代（設計改變） | 費用上限、過期、取消請求已在 main；預設排序改為使用者可選（預設官方名稱） |
| 18 | `work/KWMPF` @ `08e269f21` | `apps/web/src/SchemeComparePage.tsx` | 已取代（設計改變） | main 圖表改為逐項實際數值，不再換算 0–100，舊說明已不適用 |
| 19 | `work/KWMPF` @ `08e269f21` | `apps/web/src/SchemesPage.test.tsx` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 20 | `work/KWMPF` @ `08e269f21` | `apps/web/src/SchemesPage.tsx` | 已取代 | main 已有 URL／history 狀態同步 |
| 21 | `work/KWMPF` @ `08e269f21` | `apps/web/src/SiteChrome.tsx` | 已取代 | main 已有 skip link 及 `id="main-content"` |
| 22 | `work/KWMPF` @ `08e269f21` | `apps/web/src/styles.css` | 已取代（重設計） | main 有全域 `:focus-visible` 及 skip link 樣式；其餘為 #357 重設計前的外觀 |
| 23 | `work/KWMPF` @ `08e269f21` | `docs/adr/0001-github-cloudflare-deployment.md` | **未在 main，仍適用** | 記錄 ADR-0001「正常批次自動發布／每日預算排名」與現況（人工發布、無 Worker Cron）差異；main ADR 仍寫舊決定 |
| 24 | `work/KWMPF` @ `08e269f21` | `docs/deployment.md` | 部分過時；揭示 main 文件錯誤 | 見下方發現 P-01 |
| 25 | `work/KWMPF` @ `08e269f21` | `docs/specs/2026-08-08-hk-mpf-comparison-v1-implementation-spec.md` | **未在 main，仍適用** | 規格「實作狀態補記」：同 23；main 規格第 124 行仍寫正常批次自動發布 |
| 26 | `work/KWMPF` @ `08e269f21` | `packages/coverage/src/fetch-platform.ts` | 已取代（搬檔） | 失敗抓取 artifact 邏輯已移至 `fetch-platform-http.ts` |
| 27 | `work/KWMPF` @ `08e269f21` | `packages/coverage/src/raw-archive.ts` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 28 | `work/KWMPF` @ `08e269f21` | `scripts/e2e-serve-api.sh` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 29 | `work/kwmpf-followup-20260929` @ `fbcb8a888` | `.github/workflows/deploy-production.yml` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 30 | `work/kwmpf-followup-20260929` @ `fbcb8a888` | `docs/deployment.md` | 已取代（main 較新） | run #24 及 review-disposition 段落已在 main，措辭較新 |
| 31 | `work/kwmpf-followup-20260929` @ `fbcb8a888` | `package.json` | 已取代 | main check:shell 是超集 |
| 32 | `kwmpf-data-08-dates` @ `c580c49fd` | `docs/agents/fact-sheet-extraction.md` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 33 | `kwmpf-data-08-dates` @ `c580c49fd` | `packages/coverage/src/fact-sheet-allocation-contracts.ts` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 34 | `kwmpf-data-08-dates` @ `c580c49fd` | `packages/coverage/test/fact-sheet-allocation.test.ts` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 35 | `kwmpf-mobile-nav` @ `0f018316b` | `apps/e2e/tests/layout.spec.ts` | 已取代（數值改變） | main 測試改為 14px＋44px 觸控目標 |
| 36 | `kwmpf-mobile-nav` @ `0f018316b` | `apps/web/src/styles.css` | 已取代（數值改變） | main 已有 340px 媒體查詢，字號 14px 由測試鎖定 |
| 37 | `kwmpf-trustee-pdf-archive` @ `0f018316b` | `docs/agents/fact-sheet-sources.md` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 38 | `kwmpf-trustee-pdf-archive` @ `0f018316b` | `docs/deployment.md` | 已取代 | main 第 196 行已有同段（措辭較新） |
| 39 | `kwmpf-trustee-pdf-archive` @ `0f018316b` | `package.json` | 已取代 | main check:shell 是超集 |
| 40 | `work/kwmpf-followup-clean` @ `1cb73016b` | `docs/deployment.md` | 已取代（main 較新） | run #19／Drill #12 歷史已在 main，後續 release 亦已記錄 |
| 41 | `work/kwmpf-meth04-clean` @ `d69ab0724` | `data/sources/2026-08-31/fund-fact-sheet-disclosures.json` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 42 | `work/kwmpf-meth04-clean` @ `d69ab0724` | `packages/coverage/src/fact-sheet-allocation-contracts.ts` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 43 | `work/kwmpf-meth04-clean` @ `d69ab0724` | `packages/coverage/test/fact-sheet-allocation.test.ts` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 44 | `work/kwmpf-meth04-transparency` @ `1cb73016b` | `apps/api/test/caching.test.ts` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 45 | `work/kwmpf-meth04-transparency` @ `1cb73016b` | `packages/coverage/src/build-staging-seed.ts` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 46 | `work/kwmpf-meth04-transparency` @ `1cb73016b` | `packages/coverage/src/comparison-group-stats.ts` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 47 | `work/kwmpf-meth04-transparency` @ `1cb73016b` | `packages/coverage/test/comparison-group-stats.test.ts` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 48 | `work/kwmpf-meth04-transparency` @ `1cb73016b` | `packages/coverage/test/fund-interpretation.test.ts` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |
| 49 | `work/kwmpf-meth04-transparency` @ `1cb73016b` | `scripts/check-publication-seed.sh` | 已取代（三方合併無差異） | 修改已完整包含於 main（只差 CRLF） |

## 限制

- 判斷基於 `main` 現行內容；沒有執行舊版本的測試，也沒有核對官方來源。
- 「已取代（設計改變）」代表 main 已有不同的既定做法，不代表舊做法錯誤；若想恢復舊行為（例如預設按一年回報排序），屬新的產品決定。
- 1,074 個 `work/` 暫存檔（returns-refresh、pr269-format、本機 D1／SQLite seed 輸出）及 `78e84da` 私人保存 commit 不在本次逐檔範圍。
