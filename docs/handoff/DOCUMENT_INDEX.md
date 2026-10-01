# KWMPF 完整文件與私有附件索引

## 目前要交Claude的文件

- [CLAUDE_REVIEW_BRIEF](../CLAUDE_REVIEW_BRIEF.md)：本輪檢查委託、三個開始步驟、優先級、技術／來源／R2及驗證指令。
- [RETURN_TO_CODEX_TEMPLATE](RETURN_TO_CODEX_TEMPLATE.md)：待填回交格式。真正報告及回交文件由Claude完成後另建；目前沒有Claude結果。
- 最新工作順序：Claude先檢查，使用者檢視後才回Codex Cloud；即時狀態讀HANDOFF最上節。Cloud setup草稿及更早待批准安排均以此順序為準。

公開 repo 有五份接手文件及全部既有 source／data／docs；完整歷史附件保留於交接 ZIP，不公開 push。

2026-10-01 雲端儲存跟進：另讀 [CLOUD_STORAGE](../CLOUD_STORAGE.md) 與 [config/storage.json](../../config/storage.json)。
私有 `kwmpf-handoff` 已按批准建立；清單內 ZIP／入口文件／manifest／current 指標已上傳及逐件讀回核對。
目前最新完整版本由 R2 `current.json` 與外部 `HANDOFF_RECEIPT.json` 定位；本機原件沒有刪除。
GitHub 文件更新不代表附件、NAS、Codex Cloud 或另一個 LLM 已取得資料。
本輪 Cloudflare 設定讀回摘要：[CLOUD_STATUS.json](CLOUD_STATUS.json)。

## 最新補充保存（R2上傳及下載核對完成）

[LOCAL_INDEPENDENCE](../LOCAL_INDEPENDENCE.md) 列8份約391MB補充ZIP、逐檔可攜索引、4份Git bundles及403個skills檔案。已上傳私有R2并逐件下載核對，全部路徑/bundles驗證通過；獨立雲端還原仍未執行。下面舊包15-checkout/301-entry/266-attachment/32手冊數量保留為歷史checkpoint；新盤點16個checkout及全部保存範圍由補充index定位。舊Downloads原ZIP及binary已在R2補充包中；完成文件/回執由`independence-current.json`定位。保存於雲端不等於雲端環境已執行驗收。

## 閱讀順序

1. 根目錄 CLAUDE → AGENTS，共用規則及批准邊界。
2. [HANDOFF](../HANDOFF.md) → [PROJECT_MAP](../PROJECT_MAP.md) → [DECISIONS](../DECISIONS.md) → [公開狀態摘要](STATE_SUMMARY.json)。
3. 最新 [正式發布記錄](../reviews/2026-09-30-production-repair-release.md)、[全流程審查](../reviews/2026-09-30-full-process-and-design-review.md)、[三年缺口](../reviews/2026-09-30-three-year-gap-resolution.md)、[來源修復](../reviews/2026-09-30-source-extraction-repair.md)。
4. docs/agents／adr／specs／plans／research 及 data 來源／candidate／reference。

## 私有交接 ZIP 內容與取得方法

- `repo/`：公開交接分支的完整 code／data／文件 snapshot；沒有 node_modules、secrets、build／SQLite。
- `HANDOFF_RECEIPT.json`：exact repo／branch／commit、GitHub push核對、最後 status、archive commit及私有／本機排除清單定位。
- `private-preservation/docs/handoff/archive/`：本機 commit 78e84da4a24e848fa278b129089f2728e33d8d4e 保存的歷史手冊與差異。
- `local-repository-status.json`：15 checkout／branch／HEAD／完整 git status；`local-worktree-files.json`：301 entries及逐檔精確原路徑／SHA／保存分類；10本機commit的patch另存local-worktrees。
- `local-attachments-inventory.json`：266本機附件的原路徑／SHA／bytes；其中未傳 binary 不算已到 Zo。
- `previous-documents-manifest.json`：32份文檔原路徑／SHA；原download ZIP只索引，未重新公開未知內容或執行腳本。
- `main-task-commits.json`：本地舊main基線之後91個commits／檔案；`verified-pr-and-ci.json`、`remote-and-deployment-verification.json`：只讀白名單證據。
- `private-preservation/docs/handoff/verification/`：本次本機指令失敗logs與有限安全／連結核對；不是測試成功或全歷史認證。
- 原件PDF、D1備份及其他binary仍依manifest本機路徑／已有私有R2取回，需適當授權／私有傳送，不公開token或signed URL。

自動批准審查拒絕整批歷史payload公開push；完整保存commit只在本機分支，不在公開GitHub。未用別的工具繞過，亦未聲稱Claude已收到。可由用戶私下傳送 ZIP，或在獨立授權後從 R2 下載並驗證 SHA；不聲稱 Zo／Claude 已取得資料。歷史 patch 不能直接套進最新網站。

## 以往手冊／報告（私有附件，原樣保存）

- `KWMPF-Skills-使用方案-2026-09-26.md`
- `KWMPF-trustee-returns-audit-2026-09-27.json`
- `KWMPF-trustee-returns-candidate-2026-09-27.json`
- `KWMPF-三年回報來源稽核-2026-09-26.md`
- `KWMPF-優化及不足跟進手冊-2026-09-26.md`
- `three-year-gap-audit-2026-09-30.json`
- `evidence.json`
- `evidence.json`
- `evidence.json`
- `evidence.json`
- `allocation-label-map.json`
- `archive-run-36720235207-source-manifest.json`
- `archive-run-36720235207-verification.json`
- `candidate.json`
- `disclosures.json`
- `e2e-proof.json`
- `final-data-proof.json`
- `freshness-audit.json`
- `github-ci-status.json`
- `github-final-release-ci-status.json`
- `KWMPF-三年回報缺口解決手冊.md`
- `KWMPF-來源修復及三年缺口跟進手冊.md`
- `KWMPF-正式發布及驗收記錄-2026-09-30.md`
- `pipeline-returns.json`
- `production-browser-verification.json`
- `production-release-receipt.json`
- `production-run-36721593812-api-proof.json`
- `publication-proof.json`
- `repair-audit.json`
- `seed-meta.json`
- `manifest.json`
- `KWMPF-完整建構及接手手冊.md`

同名 JSON 在不同子目錄的精確路徑／SHA看 previous-documents-manifest，不憑短檔名取代原件。舊數字／待辦／批准只描述當時；HANDOFF與AGENTS優先。

## 公開 repo 的既有長期文件

- [.github/pull_request_template.md](<../../.github/pull_request_template.md>)
- [.impeccable/surfaces/kwmpf.md](<../../.impeccable/surfaces/kwmpf.md>)
- [AGENTS.md](<../../AGENTS.md>)
- [CONTEXT.md](<../../CONTEXT.md>)
- [DESIGN.md](<../../DESIGN.md>)
- [PRODUCT.md](<../../PRODUCT.md>)
- [README.md](<../../README.md>)
- [data/coverage/README.md](<../../data/coverage/README.md>)
- [docs/adr/0001-github-cloudflare-deployment.md](<../../docs/adr/0001-github-cloudflare-deployment.md>)
- [docs/adr/0002-publication-scoped-edge-caching.md](<../../docs/adr/0002-publication-scoped-edge-caching.md>)
- [docs/adr/0003-trustee-first-fact-sheet-sources.md](<../../docs/adr/0003-trustee-first-fact-sheet-sources.md>)
- [docs/adr/0004-overlaid-text-layer-by-draw-order.md](<../../docs/adr/0004-overlaid-text-layer-by-draw-order.md>)
- [docs/adr/0005-editorial-asset-class-buckets.md](<../../docs/adr/0005-editorial-asset-class-buckets.md>)
- [docs/adr/0006-fund-overview-freshness-by-fiscal-period.md](<../../docs/adr/0006-fund-overview-freshness-by-fiscal-period.md>)
- [docs/adr/0007-quarterly-three-year-return-freshness.md](<../../docs/adr/0007-quarterly-three-year-return-freshness.md>)
- [docs/adr/0008-field-scoped-fact-sheet-temporal-scope.md](<../../docs/adr/0008-field-scoped-fact-sheet-temporal-scope.md>)
- [docs/adr/0009-time-scoped-representation-caching.md](<../../docs/adr/0009-time-scoped-representation-caching.md>)
- [docs/agents/change-policy.md](<../../docs/agents/change-policy.md>)
- [docs/agents/domain.md](<../../docs/agents/domain.md>)
- [docs/agents/editorial-mapping.md](<../../docs/agents/editorial-mapping.md>)
- [docs/agents/fact-sheet-extraction.md](<../../docs/agents/fact-sheet-extraction.md>)
- [docs/agents/fact-sheet-source-notes.md](<../../docs/agents/fact-sheet-source-notes.md>)
- [docs/agents/fact-sheet-sources.md](<../../docs/agents/fact-sheet-sources.md>)
- [docs/agents/freshness-policy.md](<../../docs/agents/freshness-policy.md>)
- [docs/agents/issue-tracker.md](<../../docs/agents/issue-tracker.md>)
- [docs/agents/platform-fields.md](<../../docs/agents/platform-fields.md>)
- [docs/agents/reference-datasets.md](<../../docs/agents/reference-datasets.md>)
- [docs/agents/triage-labels.md](<../../docs/agents/triage-labels.md>)
- [docs/deployment.md](<../../docs/deployment.md>)
- [docs/plans/2026-08-08-hk-mpf-comparison-product-spec.md](<../../docs/plans/2026-08-08-hk-mpf-comparison-product-spec.md>)
- [docs/plans/2026-08-08-hk-mpf-data-architecture-and-update-flow.md](<../../docs/plans/2026-08-08-hk-mpf-data-architecture-and-update-flow.md>)
- [docs/plans/2026-08-08-hk-mpf-technical-solution.md](<../../docs/plans/2026-08-08-hk-mpf-technical-solution.md>)
- [docs/plans/2026-08-10-deployable-foundation-design.md](<../../docs/plans/2026-08-10-deployable-foundation-design.md>)
- [docs/plans/2026-09-05-hk-mpf-comparison-interpretation-tools-scope.md](<../../docs/plans/2026-09-05-hk-mpf-comparison-interpretation-tools-scope.md>)
- [docs/plans/2026-09-05-hk-mpf-comparison-interpretation-tools-technical-solution.md](<../../docs/plans/2026-09-05-hk-mpf-comparison-interpretation-tools-technical-solution.md>)
- [docs/research/2026-08-08-mpf-data-dictionary-and-sources.md](<../../docs/research/2026-08-08-mpf-data-dictionary-and-sources.md>)
- [docs/research/2026-08-11-current-mpf-coverage-sources.md](<../../docs/research/2026-08-11-current-mpf-coverage-sources.md>)
- [docs/research/2026-08-11-mympfchoice-source-assessment.md](<../../docs/research/2026-08-11-mympfchoice-source-assessment.md>)
- [docs/research/2026-08-11-official-fund-fact-sheet-3y-parser.md](<../../docs/research/2026-08-11-official-fund-fact-sheet-3y-parser.md>)
- [docs/research/2026-08-12-china-life-manulife-three-year-return-source-gap.md](<../../docs/research/2026-08-12-china-life-manulife-three-year-return-source-gap.md>)
- [docs/research/2026-08-13-official-return-coverage-status.md](<../../docs/research/2026-08-13-official-return-coverage-status.md>)
- [docs/research/2026-08-27-lipper-category-crosswalk.md](<../../docs/research/2026-08-27-lipper-category-crosswalk.md>)
- [docs/research/2026-08-28-fund-class-category-map.md](<../../docs/research/2026-08-28-fund-class-category-map.md>)
- [docs/research/2026-08-30-fact-sheet-allocation-holdings-survey.md](<../../docs/research/2026-08-30-fact-sheet-allocation-holdings-survey.md>)
- [docs/research/2026-09-08-allocation-label-inventory.md](<../../docs/research/2026-09-08-allocation-label-inventory.md>)
- [docs/research/2026-09-10-fund-fact-sheet-publication-deadline.md](<../../docs/research/2026-09-10-fund-fact-sheet-publication-deadline.md>)
- [docs/research/2026-09-27-aia-top-holdings-temporal-scope-backfill.md](<../../docs/research/2026-09-27-aia-top-holdings-temporal-scope-backfill.md>)
- [docs/reviews/2026-09-30-full-process-and-design-review.md](<../../docs/reviews/2026-09-30-full-process-and-design-review.md>)
- [docs/reviews/2026-09-30-production-repair-release.md](<../../docs/reviews/2026-09-30-production-repair-release.md>)
- [docs/reviews/2026-09-30-source-extraction-repair.md](<../../docs/reviews/2026-09-30-source-extraction-repair.md>)
- [docs/reviews/2026-09-30-three-year-gap-resolution.md](<../../docs/reviews/2026-09-30-three-year-gap-resolution.md>)
- [docs/specs/2026-08-08-hk-mpf-comparison-v1-implementation-spec.md](<../../docs/specs/2026-08-08-hk-mpf-comparison-v1-implementation-spec.md>)
- [docs/specs/interpretation-thresholds.md](<../../docs/specs/interpretation-thresholds.md>)

## 技術、來源、任務及工具定位

- P1/P2/P3與24計劃缺口：HANDOFF第4節及全流程／三年手冊，不能把已發布永明／BEA修復再當成未完成。
- MPFA官方平台／名冊／asset-size分母：fetch-platform、data/sources/2026-09-26及docs/research。
- 每個受託人目錄／PDF URL／SHA／own dates：trustee-fact-sheet-links、最新source-repair manifest／audit及fact-sheet-source-notes。
- Lipper、編輯三桶與版本：data/sources/lipper、data/reference、reference-datasets與editorial-mapping。
- 來源／候選／報告／seed／網站產生、Actions→Cloudflare、變數名稱及preview：PROJECT_MAP第4–7節，沒有secret值。
- 原skill方案在私有附件；github-actions-efficiency、Impeccable／frontend／UI-UX／web-design、Cloudflare／Wrangler／web-perf、computer-use等工具在Claude環境須另核實。不能把Windows技能資料夾、未批准engine／hooks自動下載或複製到Zo。
- 歷史Impeccable是code-led審查，沒有engine／hooks認證；Zo登入／runtime／plugin／Claude實讀均未核實。
