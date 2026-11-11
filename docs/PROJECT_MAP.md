# KWMPF 接手地圖

核對基線：2026-11-12、main11750936e88f697b54dca40d0c58afeac5ea3bac；即時狀態讀[HANDOFF](HANDOFF.md)，工作次序讀[NEXT_TASKS](NEXT_TASKS.md)。

## 目錄與流程

- `apps/web`：React/Vite；`src/main.tsx`頁面路由，`SiteChrome.tsx`／styles品牌，基金圖／搜尋、排名、基金/計劃比較及詳情；設計讀根`DESIGN.md`。
- `apps/api`：Hono Worker，`src/index.ts`公開health/summary/search/rankings/fund-classes等GET，`migrations/`為D1 schema。
- `packages/coverage`：平台抓取、受託人PDF/JSON抽取、嚴格核對、candidate/report、完整seed。
- `data/sources`保存平台批次與disclosures；`data/coverage`保存年率化／累積候選及來源衝突；`data/reference`保留具名對照表。歷史Lipper分類不再用作基金比較類型；Lipper累積補位是ADR0015的另一用途。
- `scripts`包含source preflight、候選解析、seed與本機驗收；`apps/e2e`為Playwright；`docs/agents`／`adr`／`specs`／`reviews`為規則、決定與歷史證據。

官方平台 `https://mfp.mpfa.org.hk/`＋受託人官方PDF/JSON → 有日期原件／SHA → parser及同期核對 → 候選/report/disposition → 人工覆核與PR → 完整seed/migration → D1 publication → API → Web。
原件、備份、release tuple在私有R2；下載成功不等於期別正確，候選不直接影響正式站。官方數值、N/A、own date、隔離及第三方標示依AGENTS/ADR。

## 自動化與Cloudflare接入

- `.github/workflows/ci.yml`：PR及push main檢查。
- `refresh-source-snapshot.yml`：定期/手動擷取平台、數量與異常核對、開候選PR；`archive-source-snapshot-r2.yml`另封存原件。
- `refresh-trustee-returns.yml`：每日/手動抓同期受託人月報及第三方Lipper資料，開資料PR/跟進issue；目前official-conflict跟進缺口見NEXT_TASKS。
- `deploy-production.yml`／`deploy-staging.yml`：手動dispatch，受保護環境，精確來源/CI、備份與讀回、migration/seed、Worker/Pages、smoke/tuple。
- backup、restore-drill、restore-r2-d1、configure-domain是分開的操作，不由本輪執行。remote restore與runner-local drill不能混稱。
- GitHub runner經Wrangler連Cloudflare；production Worker `kwmpf-api-production`、Pages `kwmpf-web-production`、D1 `kwmpf-production`、private R2 `kwmpf-production-raw`。正式網域`https://kwmpf.kirkwongcn.com/`。
- 本次查到Pages無Git source、兩Worker Builds triggers空；沒有已核實的feature push自動正式部署。外部hooks／GitHub環境reviewers與branch policy未核實。

## 開發指令與變數名稱

packageManager `bun@1.3.11`、`bun.lock`；固定lockfile安裝 `bun install --frozen-lockfile`；檢查 `bun run typecheck`／`bun run test`；`bun run check`包含format、shell/Python、typecheck、test、build；E2E另 `bun run e2e`。
`bun run build`含API Wrangler **dry-run**。`bash scripts/check-publication-seed.sh`會解析最新入庫source及最新候選；端到端另核三筆原文。以上定義已核，本輪沒有執行。
準備Git、Node、POSIX Bash、Python3、jq、curl、Poppler及需用的Chromium；不從舊Windows junction複製依賴。

環境變數只列名稱：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_D1_DATABASE_ID`、`RELEASE_VERSION`、`VITE_API_URL`、`GH_TOKEN`／`GITHUB_TOKEN`；本機隔離用`KWMPF_E2E_SOURCE`、`KWMPF_E2E_STATE`、`KWMPF_PUBLICATION_SEED_SOURCE`、`KWMPF_PUBLICATION_SEED_RETURN_OBSERVATIONS`及各port變數。不要把值／signed URL寫入文件。
10月1私人交接工具位於歷史safe branch，最新main並未整批合入那套儲存文件／setup scripts；不能假稱Codex Cloud、Claude、NAS或private R2憑證已在本輪配置。
