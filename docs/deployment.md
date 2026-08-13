# Staging deployment

正式網站網域規劃為 `KWMPF.kirkwongcn.com`。目前只作為網域方案記錄；DNS、正式 custom domain 及公開發布必須另行確認後才會設定。

The `Deploy staging` GitHub Actions workflow publishes the API Worker and health page from `main`. Both deployments receive the commit SHA as their release identifier. It remains manually triggered until the required Cloudflare resources and secrets are configured; the `staging` environment requires approval from the repository owner.

## Cloudflare resources

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
