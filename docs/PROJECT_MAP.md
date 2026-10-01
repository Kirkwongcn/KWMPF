# KWMPF 網站及資料流程地圖

核實日期：2026-10-01（香港）。這份是實際 code／workflow／只讀 API 地圖；未實作的 spec 構想不當作現有能力。
即時版本、測試及 push 結果讀 [HANDOFF](HANDOFF.md)；歷史／附件讀 [文件索引](handoff/DOCUMENT_INDEX.md)。

## 1. Repo、技術與目錄

- Repo：<https://github.com/Kirkwongcn/KWMPF>；Git clone：`https://github.com/Kirkwongcn/KWMPF.git`；public、預設 `main`。
- Bun workspaces：`apps/*`、`packages/*`；lockfile `bun.lock`；package manager `bun@1.3.11`。
- 前端：React 19.2.8、Vite 8.2.1；API：Hono 4.13.1、Wrangler 4.120.0；TypeScript 7.0.2、Vitest 4.1.10、Playwright 1.57.0。版本取自已核實 package manifests，不是升級建議。
- `apps/web/src/main.tsx`：client-side 路由分派。`SiteChrome.tsx`／`styles.css`：共用 header、品牌及響應式；`DataCharts.tsx`：實際數據圖表；`DESIGN.md`／`.impeccable/`：設計規範與審查配置。
- `apps/api/src/index.ts`：公開 API；`publication.ts`／`caching.ts`／`freshness.ts`／`data-quality.ts`／`search.ts`：payload、快取、日期、覆蓋及搜尋。
- `apps/api/migrations/`：D1 schema；`wrangler.jsonc`：含占位 D1 ID 的本機模板；`wrangler.restore.jsonc`：隔離還原演練用本機 D1。
- `packages/coverage/src/`：抓取、不同受託人 PDF parser、嚴格配對、官方回報 overlay、配置 mapping、比較組及 seed。`test/fixtures/`：來源版面 golden cases。
- `data/sources/`：有日期的來源、抓取／refresh 報告、便覽連結與披露；`data/coverage/`：候選及稽核；`data/reference/`：非官方分類及編輯 mapping；`data/sources/lipper/`：Lipper 比較分類來源。
- `scripts/`：來源批次解析、preflight、隔離 API、原件包裝、redacted Wrangler 及驗證；`.github/`：workflow、CODEOWNERS、PR 證據規則。
- `docs/agents/`：細項抽取／來源／時效／改動政策；`docs/adr/`：決策；`docs/specs/`／`plans/`：需求及計劃；`docs/research/`／`reviews/`：來源證據及歷次驗收。

## 2. 頁面與入口

| URL | 程式 | 功能 |
| --- | --- | --- |
| `/` | `App.tsx` | 搜尋、已發布覆蓋、簡潔／深入模式；`?view=analysis` 指深入模式 |
| `/funds` | `FundsPage.tsx` | 名稱／類別／受託人等搜尋及篩選、50 筆分頁、排序與比較選取 |
| `/funds/compare` | `FundComparePage.tsx` | 1–4 個基金類別、逐期間原值／日期／來源；同 snapshot 防護 |
| `/fund-classes/:id` | `FundClassPage.tsx` | 官方值、各自日期、N/A／缺失／過期、期間／曆年圖、配置及持倉、編輯解讀 |
| `/rankings` | `RankingsPage.tsx` | `metric=return/fee/risk`、`period=1/3/5/10`、`group`、同組點圖／橫條圖／原值表 |
| `/schemes` | `SchemesPage.tsx` | 計劃搜尋及比較選取 |
| `/schemes/compare` | `SchemeComparePage.tsx` | 最多四個計劃；基金數、披露 FER 中位數、DIS 等實際單位 |
| `/data-status` | `DataStatusPage.tsx` | 指標覆蓋、45／90 日、過期／缺失與評估日 |
| `/methodology` | `MethodologyPage.tsx` | 比較方法、非官方分類、資料與時序限制 |

未知 route 由前端顯示找不到頁面；CSR 畫面不代表 HTTP 404、搜尋引擎收錄或 SSR 已完成。
`apps/web/public/` 保存品牌圖、robots／llms 等公開資產；build 輸出 `apps/web/dist/`，不提交。

## 3. 公開 API、D1 及原件

`apps/api/src/index.ts` 已核實全部主要 GET routes：`/health`、`/summary`、`/search`、`/filters`、
`/fund-classes/:id`、`/fund-classes/:id/interpretation`、`/comparison-group-stats`、`/data-quality`、
`/schemes`、`/schemes/compare`、`/rankings`。沒有從公開 API 抓取來源或發布候選的 route。

正式 API：<https://kwmpf-api-production.kw-screener.workers.dev>；正式前端：<https://kwmpf.kirkwongcn.com>。
Bindings `DB`（D1）、`RAW_ARCHIVE`（R2）、`RELEASE_VERSION`（程式版本）。D1 保存發布 payload、基金／計劃、
比較組及 current publication；詳見 migrations。R2 原件／備份為私有，不是公開 API 的完整下載站。

| 環境 | Worker | Pages project | D1 名稱 | R2 bucket |
| --- | --- | --- | --- | --- |
| 本機／staging | `kwmpf-api` | `kwmpf-web-staging` | `kwmpf-staging` | `kwmpf-staging-raw` |
| production | `kwmpf-api-production` | `kwmpf-web-production` | `kwmpf-production` | `kwmpf-production-raw` |

名稱取自 repo，Worker／Pages 亦經只讀 Cloudflare API 核實存在。實際 D1 ID／token／環境值不列於文件；
本次沒有進控制台核對全部 D1、R2、DNS 或權限設定。

## 4. 來源、搜尋與產物生成

1. 平台來源：積金局 MPF Fund Platform，`https://mfp.mpfa.org.hk/`；官方登記冊／計劃文件核實身分。
   `fetch-platform.ts`／`retry-platform.ts` 抓取；保存 HTTP／解析／異常結果，不把 403／451 當 N/A。
2. `fetch-platform`／refresh 產生有日期的 `mpf-fund-platform.json`、`refresh-report.json` 及原始 HTML archive。
   目前最新有平台 JSON 的批次是 `2026-09-26`，官方資料截至 `2026-08-31`。
3. 受託人官網便覽優先，積金局連結／登記冊用於配對；`trustee-fact-sheet-links.json` 保存精確 URL。
   `scripts/fetch-trustee-fact-sheets.py` 下載及算 SHA／bytes；包裝脚本產生 deterministic tar.gz／index。
   「連結清單批次」不等於 PDF 自己的報告日期；同 URL 更換內容必須另留版本。
4. `parse-fact-sheets.ts` 及受託人 parser 產生 observations／disclosures；`build-return-overlay.ts`、
   `build-candidate-audit-report.ts`、`build-candidate-ranking-report.ts`、配置報告及
   `scripts/audit-source-freshness.mjs` 整理稽核。PDF 需本機／runner 的 pdftotext、pdftohtml 等工具；不在 Worker 執行。
5. 官方回報、基金類別、期間及日期嚴格配對；Lipper 分類是非官方，沒有 Lipper 的類別獨立以「平台分類：」分組。
   `data/reference/allocation-label-map.json` 是編輯三桶，不能覆蓋官方配置原文。
6. 候選經 code／data 分開 PR 及三筆原文核對。`check-production-source-review.mjs` 對異常來源 fail closed；
   有效 disposition 綁定 GitHub source／report **原 blob bytes**。Windows CRLF 不能偷偷重算成另一份已核准來源。
7. `packages/coverage/src/build-staging-seed.ts` 是 staging／production 共用完整 seed 路徑；
   `--source`、`--return-observations`、`--output` 必須明確指定，不能只用平台欄位代替 trustee 三年回報。
   它輸出 seed SQL 及發布 payload；migration／seed 進 D1、原件／候選進 R2、API 讀相同 snapshot、Web 讀 API。

最新已接受回報候選：`data/coverage/2026-09-30-official-return-observations-candidate.json`（295 observations）。
最新修復披露：`data/sources/2026-09-30/fund-fact-sheet-disclosures.json`。
四份修復 PDF 的 URL／SHA／bytes／頁數讀 `2026-09-30-source-extraction-repair-manifest.json`、
`docs/reviews/2026-09-30-source-extraction-repair.md` 及同名 audit。舊 249 筆候選屬歷史，不能覆蓋新候選。
24 計劃缺口表、受託人官方目錄及各方案讀 `docs/reviews/2026-09-30-three-year-gap-resolution.md`、
`docs/agents/fact-sheet-sources.md`／`fact-sheet-source-notes.md`；原始 URL 完整保存在資料，不凭搜尋摘要補值。

## 5. GitHub Actions → Cloudflare

| Workflow | 觸發 | 作用／邊界 |
| --- | --- | --- |
| `ci.yml` | PR；push `main` | verify 跑完整 check；PR 才有 high-risk-review／E2E，重型步驟依 scope；不是部署 |
| `refresh-source-snapshot.yml` | schedule `0 19 * * 2` UTC；manual | 香港周三 03:00 抓取平台，建立候選分支／PR；不發布 production |
| `archive-source-snapshot-r2.yml` | refresh workflow 完成；manual | 驗證同 repo `main` 的 schedule／manual run，重用 artifact；protected staging R2 保存 raw archive |
| `archive-trustee-fact-sheets-r2.yml` | manual，jobs 限 `main` | 下载 PDF，再 protected staging gate 寫私有 R2及讀回；非部署 |
| `deploy-staging.yml` | manual，步驟要求 `main` | 同 SHA main CI、最新批次、備份、完整 seed、Worker／Pages、smoke、失敗復原 |
| `deploy-production.yml` | **manual only**，步驟要求 `main` | 確認字串、同 SHA main CI、精確來源審查、backup／Time Travel／讀回、migration／seed、Worker／Pages、smoke、release tuple |
| `backup-d1.yml` | 周日 02:17 UTC；manual | 香港周日 10:17，staging D1→private R2；不部署 |
| `backup-production-d1.yml` | 周日 03:17 UTC；manual | 香港周日 11:17，production D1→private R2；共用 production D1 鎖，不部署 |
| `restore-drill.yml` | manual | protected 選定來源環境，只還原 runner 臨時本機 D1 |
| `restore-r2-d1.yml` | manual，job 限 `main` | **寫入選定 remote D1**，需獨立批准；不是隔離演練 |
| `verify-production-release-manifest.yml` | manual | protected production 私有 R2 release manifest 讀回 |
| `configure-staging-domain.yml`／`configure-production-domain.yml` | manual | 域名／DNS 設定 mutation，需獨立批准 |

排程時間來自已核實 workflow，GitHub schedule 是否準時建立 run 不能保證。此交接不 dispatch／批准任何 workflow。
部署透過 GitHub environments 的 secrets，由 Wrangler action／CLI 連 Cloudflare；
`render-worker-config.sh` 將模板產生 staging／production 配置，真實資源值不進 Git。
production 使用 `pages deploy ... --project-name kwmpf-web-production --branch main --commit-hash ...`。
**`--branch main` 是 Pages 對該次 upload 的環境標記，不代表 push main 自動發布。**

Cloudflare 只讀 API 已核實兩個 Pages project `source=null`、`production_branch=main`；
兩個 KWMPF Worker 的 Workers Builds triggers 都是空清單。沒有已核實的 Cloudflare Git 自動部署。
故推送 `docs/claude-handoff-20261001-safe` 不符合 repo CI push main 或任何部署 workflow 觸發條件。
PR 會執行 CI，但本次不建立 PR、合併或發布。公開推送只包含入口／技術摘要；歷史 payload 已改為本機 ZIP 保存。

## 6. 本機 preview、staging 與 production

- 本機：前端 Vite，API Wrangler **本機** D1／R2；`apps/e2e/playwright.config.ts` 和 `scripts/e2e-serve-api.sh`
  是已核實預覽／隔離資料流程，E2E API／Web 默認 port 8799／4179。
- `bun run build` 的 API 子指令是 `wrangler deploy --dry-run --outdir dist`，不可刪除 `--dry-run`。
- E2E 默認來源刻意綁定歷史 fixture；驗最新資料必須指定 `KWMPF_E2E_SOURCE` 和
  `KWMPF_E2E_RETURN_OBSERVATIONS`／`KWMPF_PUBLICATION_SEED_RETURN_OBSERVATIONS`。
- 可按本機需求在 `apps/web` 使用 `bun run vite --host 127.0.0.1`、在 `apps/api` 使用
  `bun run wrangler dev --local`；這是由已安裝 CLI／設定推得的操作方式，**本次未實跑這兩條預覽指令**。
- 雲端 staging 由受保護 `deploy-staging` 使用 `main`，沒有已核實的 feature branch cloud preview 自動發布。
  `kwmpf-web-staging.pages.dev` 是 staging project 的 main upload，Cloudflare 名稱顯示 production environment
  不代表本網站正式域名。staging 可能較舊，不把它當最新驗收站。
- 正式 Pages 經 API 核實當前 canonical deployment 指向 `3f655960c620b019f245886d709283c0e1b67590`，
  deployment `48675d4f-4815-4f87-bb8f-b1f3aa5df51d`、stage success、ad_hoc、run #28 marker。
  GitHub main `6a593db` 後續只改文件；這次交接沒有新部署。

## 7. 環境變數名稱（沒有值）

| 名稱 | 範圍／作用 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_D1_DATABASE_ID` | GitHub staging／production environment secrets；部署／備份身份及目標 |
| `D1_DATABASE_ID` | workflow 由 environment secret 注入的渲染腳本參數 |
| `VITE_API_URL` | 前端 build-time API origin；不是 secret，不應接錯環境 |
| `RELEASE_VERSION` | Worker 程式 commit marker；`DB`／`RAW_ARCHIVE` 為 bindings |
| `GH_TOKEN`、`GITHUB_TOKEN` | GitHub runner token；不要寫入文件或使用長期 token 取代 |
| `KWMPF_E2E_SOURCE`、`KWMPF_E2E_RETURN_OBSERVATIONS`、`KWMPF_E2E_STATE`、`KWMPF_E2E_API_PORT`、`KWMPF_E2E_WEB_PORT` | 本機隔離 E2E 路徑／ports |
| `KWMPF_PUBLICATION_SEED_SOURCE`、`KWMPF_PUBLICATION_SEED_RETURN_OBSERVATIONS`、`KWMPF_PUBLICATION_SEED_PORT` | 本機 publication-seed gate |
| `WRANGLER_SEND_METRICS`、`CI`、`RUNNER_TEMP`、`GITHUB_SHA`／`GITHUB_RUN_ID`／`GITHUB_RUN_ATTEMPT` | CLI／runner 行為及版本標識；不是自訂憑證 |

## 8. 雲端交接儲存補充（2026-10-01）

非網站 runtime 設定：[config/storage.json](../config/storage.json)；操作與跨 LLM 取回方式：[CLOUD_STORAGE](CLOUD_STORAGE.md)。
GitHub public code／文件和私有 R2 附件分開。`kwmpf-handoff` 已按使用者批准建立，Standard／APAC，
公開 enabled=false、無 custom domain、完整物件無自動到期；預設七日中止未完成 multipart upload 保留。
建立時間香港 2026-10-01 14:18:51.869，物件清單空。私有資料上傳另被自動批准審查拒絕，需明確傳送批准。
目前沒有 ZIP／manifest／current pointer，也沒有新增 Worker／MCP／GitHub workflow／environment secrets。
既有 production／staging raw bucket 不改名、不搬移，未將其所有物件複製到交接區。

取回工具的變數名稱：`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`；S3 客戶端為
`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_ENDPOINT`。此處沒有值；S3 object token 不自動適用管理 REST API。
新客戶端優先只讀交接 bucket，實際 credential 尚未配置；Codex 的授權不會自動轉給 Claude／Zo。
NAS 使用者報稱 AS5402T／HDD／RAID 後 12 TB，但尚未設置，沒有已核實備份或備用入口。

本輪追加只讀查核：兩個 KWMPF Worker Build triggers 仍空；Pages API 無 source 欄位（不是回傳明確 null），
canonical production deployment／commit 與上次一致。rulesets GET 空；classic main protection GET 403。
以上是本轮較精確的 API 表述；既有手冊 `source=null` 指未見 Git source，不應解讀為本輪存在明確 null 欄位。

## 9. 仍待核實

- GitHub production／staging environment required reviewers、deployment branch policy、全部 branch protection／rulesets：
  本次 connector 不允許 environment endpoint；workflow 有 environment 不等於 gate 一定啟用。
- 未逐項核實 Cloudflare DNS／WAF／Access／API token scopes、build hooks、帳單、D1 schema／row counts、
  R2 ACL／lifecycle 全部實際值；不從 repo 名稱猜控制台狀態。
- 任意第三方 webhook／外部手動操作的存在無法由這次 repo 與內建 Cloudflare build 查核排除。
- 來源權利／完整連續時序、最新官方 PDF、全部欄位原文 reconciliation 未全面完成。
- Zo Computer 是否有這個 Windows 工作目錄、Claude 是否讀到匯入、當地 Bun／Bash／Python／Chromium：未核實。

完整核實附件不在公開分支；本機 archive commit／私有交接 ZIP 的附件為：
`private-preservation/docs/handoff/archive/remote-and-deployment-verification.json`（白名單 metadata；沒有憑證／變數值）。
