# Deployment

正式網站是 `https://kwmpf.kirkwongcn.com`，由 Cloudflare Pages 專案 `kwmpf-web-production` 提供，
DNS 以 proxied CNAME 指向 `kwmpf-web-production.pages.dev`，前端讀取 Worker `kwmpf-api-production`。
更換網域或改變公開發布狀態，一律要先取得使用者確認。

## Staging

The `Deploy staging` GitHub Actions workflow publishes the API Worker and health page from `main`. Both deployments receive the commit SHA as their release identifier. It remains manually triggered until the required Cloudflare resources and secrets are configured; the `staging` environment requires approval from the repository owner.

### Cloudflare resources

Create these staging resources before enabling the workflow:

- D1 database: `kwmpf-staging`
- R2 bucket: `kwmpf-staging-raw`
- Pages project: `kwmpf-web-staging`

Configure the following secrets in the protected GitHub `staging` environment:

- `CLOUDFLARE_API_TOKEN`: an account-scoped token limited to Workers Scripts, D1, R2 and Pages edit permissions
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`

The D1 identifier is inserted into a temporary Wrangler file during the workflow. Secrets and resource identifiers are not printed by application code or included in the health response.

After deployment, verify that the Pages health page and `GET /health` on the Worker show the same commit SHA. The API must report both `d1` and `r2` as `true` without exposing their names or identifiers.

## Production

`Deploy production` 是 `workflow_dispatch` 專用，永不自動觸發。它需要三重閘門：

1. 觸發時必須在 `confirm` 輸入框逐字輸入 `deploy-production`。
2. `production` GitHub environment 受保護，需要 repository owner 批准。
3. 部署前先跑 `bun run check` 及完整 `bun run e2e`（desktop + Pixel 5），任何一項失敗即中止。

`source_snapshot` 輸入指定要發布的官方來源快照（`data/sources/` 之下的路徑）。
Workflow 會先確認該檔案存在，才建立發布種子。

部署後會自動核對公開 API：`/summary` 必須回傳非 null 的 `snapshotId` 及至少一個
fund class，並且 `Cache-Control` 必須是 `public, max-age=300, stale-while-revalidate=600`。
若公開端點仍未有已發布快照，workflow 會失敗而不是靜靜通過。

### Cloudflare resources

以下 production 資源已經建立並在服務中：

- D1 database: `kwmpf-production`
- R2 bucket: `kwmpf-production-raw`
- Pages project: `kwmpf-web-production`
- Worker 以 `kwmpf-api-production` 名義部署，與 staging 的 `kwmpf-api` 分開。

受保護的 GitHub `production` environment 設有同名 secrets
（`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_D1_DATABASE_ID`），
其值指向 production 資源。Environment secrets 會覆蓋 repository secrets，
所以 staging 與 production 不會互相污染。

發布快照識別碼由來源快照的 `sourceDataAsOf` 推導（例如 `snapshot-mpfa-platform-2026-07-31`），
不再硬編在種子腳本內。ADR 0002 的 edge cache 以此識別碼分界，所以每個官方截至日期
都會得到自己的快取世代。

### Production D1 backup and restore

`Backup production D1` is scheduled for Sundays at 03:17 UTC (11:17 Hong Kong time) and can also be dispatched manually. It uses the protected `production` environment, so each run waits for its environment approval before accessing production credentials. The workflow exports `kwmpf-production`, checks that the published snapshot ID did not change during export, uploads SQL and a SHA-256/byte-count manifest to `kwmpf-production-raw/backups/<backup-id>/`, then reads both objects back and verifies them. It shares a concurrency group with `Deploy production` so the export cannot overlap a deployment.

The D1 export is read-only; the workflow writes new backup objects to production R2. No automatic object expiration is configured while the retention policy remains undecided. A successful staging restore drill does not prove production recovery. `D1 Restore Drill` can select production as its source, but requires production environment approval and restores only into runner-local D1; no production restore has been performed.

## 來源更新

`Refresh source snapshot` 每星期三 03:00（香港時間）自動執行，也可以手動觸發。它只產生
候選批次，**永遠不會改動公開網站**：

1. 以 `scripts/resolve-previous-snapshot.sh` 找出 `data/sources/` 之下最新、而且真正帶有 `mpf-fund-platform.json` 的日期目錄（`YYYY-MM-DD`）作為上一批次，讀取它的獨立數量核對值。只放其他官方檔案的日期目錄（例如基金便覽連結批次）會被略過。
   其他名稱的目錄（例如存放使用者提供資料的 `data/sources/lipper/`）不會被當成批次。
2. 擷取官方強積金基金平台，寫出候選快照及原始 HTML 封存（上載為 workflow artifact，保留 30 日）。
3. 產生發布前檢查報告及異常核對報告，判斷結果為
   `no_new_data`、`blocked`、`needs_review` 或 `ready`。
4. 若官方截至日期沒有改變，就此結束，不開 PR。
5. 否則把候選快照及報告提交到 `data/source-snapshot-<截至日期>` 分支並開 PR，
   PR 內文列出數量核對、被阻擋記錄及異常分類。

合併 PR 等於接受該批次成為下一次比較的基準，所以只應合併你打算採用的批次。
發布仍然是獨立步驟：合併之後手動觸發 `Deploy production`，並在 `source_snapshot`
填入新的快照路徑。

數量守門是刻意的。基金類別數量改變時擷取會失敗並自動開 issue，要求先在官方資產規模文件
核對現行數量，再以 `workflow_dispatch` 填入新數量重跑。不要為了令 workflow 通過而
放寬這個檢查。

### 尚未處理

- 已發布快照的原始 HTML 只保留在 workflow artifact（30 日），未按規格長期存入 R2。
- `Deploy production` 會在資料庫改動前把 D1 匯出、manifest 和 rollback timestamp 存入 production R2；另外封存來源 JSON 及 return-observations 候選資料。
- Production D1 backups now have a weekly, production-environment-gated workflow, but a successful run and a production-source restore drill still need to be verified.
- `D1 Restore Drill` 只有手動觸發，未有每季執行的紀錄。
- R2 retention remains undecided; no automatic expiration or deletion policy is configured.

## Trustee factsheet PDF archive

The manual `Archive trustee fact sheets to R2` workflow accepts a dated `source_batch` from `data/sources/<YYYY-MM-DD>/trustee-fact-sheet-links.json`. It downloads PDFs sequentially, verifies HTTPS redirects, PDF signatures, byte counts and SHA-256 values, and preserves per-file failures in a manifest. GitHub retains the intermediate artifact for 30 days so the protected archive job can consume it.

When at least one PDF is available, the second job waits for the protected `staging` environment, packages a deterministic archive and index, then stores both under `kwmpf-staging-raw/source-archives/trustee-fact-sheets/<batch>/run-<id>/`. It reads both objects back and compares the bytes with the uploaded files. The workflow does not touch D1 or deploy a site. A successful PR check does not run this workflow; the first real R2 write still needs a manual dispatch and staging approval.
