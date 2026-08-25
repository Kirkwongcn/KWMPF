# Deployment

正式網站網域規劃為 `KWMPF.kirkwongcn.com`。目前只作為網域方案記錄；DNS、正式 custom domain 及公開發布必須另行確認後才會設定。

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

正式部署前必須先建立以下 production 資源（目前**尚未建立**）：

- D1 database: `kwmpf-production`
- R2 bucket: `kwmpf-production-raw`
- Pages project: `kwmpf-web-production`
- Worker 會以 `kwmpf-api-production` 名義部署，與 staging 的 `kwmpf-api` 分開。

並在受保護的 GitHub `production` environment 設定同名 secrets
（`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_D1_DATABASE_ID`），
其值指向 production 資源。Environment secrets 會覆蓋 repository secrets，
所以 staging 與 production 不會互相污染。

### 尚未處理

- `KWMPF.kirkwongcn.com` 的 DNS 及 custom domain 未設定。
- 上述 Cloudflare production 資源未建立。

在這兩項完成前，`Deploy production` 可以合併及審查，但執行必然失敗。這是刻意的：
workflow 先落地並經 review，正式開通才是獨立的、需要明確批准的決定。
