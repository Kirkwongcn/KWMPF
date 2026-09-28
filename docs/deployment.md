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

### Staging D1 backup and restore

The scheduled/manual `Backup D1` workflow runs behind the protected `staging` environment and shares the `staging-d1-mutations` concurrency lock. It records the current publication snapshot before and after export, then uploads the SQL export and a manifest with its SHA-256 and byte count to private staging R2.

After upload, it downloads both objects again. The workflow compares the returned manifest byte-for-byte and checks the SQL byte count and SHA-256 against that manifest. This confirms the stored backup objects are intact; it does not prove the SQL can be restored. The separate Restore Drill verifies that by importing the selected backup into runner-local D1 and checking database invariants.

The backup workflow does not write to remote D1 or deploy the site. Automatic R2 expiration remains disabled.

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

最近一次已驗證的正式發布是 [Deploy production run #21](https://github.com/Kirkwongcn/KWMPF/actions/runs/36321882802)：main SHA `b74ec89f787a4cfececdd8f9286bee1c0685e94f`，公開 snapshot `snapshot-mpfa-platform-2026-08-31-b74ec89f787a`。該版使用 `2026-09-26/mpf-fund-platform.json` 及 `2026-09-27-official-return-observations-candidate.json`；API、三年排名及快取檢查通過，公開三年排名有 209 隻合資格基金，另有 40 隻因披露資料超過 90 日而排除。部署前匯出的舊 D1 snapshot 是 `snapshot-mpfa-platform-2026-08-31-1cb73016b596`；備份 ID 為 `d1-2026-09-27T13-18-11Z-run-36321882802`，R2 prefix `kwmpf-production-raw/backups/d1-2026-09-27T13-18-11Z-run-36321882802/`，SQL 1,982,166 bytes，SHA-256 `755b95bc597b13f916c35fadc8277b5e8e388df4dcd34f4d9fc89615ff67fe33`。該次部署早於以下 R2 read-back guard，因此備份物件尚未經部署 workflow 讀回核對。

### Production D1 backup and restore

`Backup production D1` is scheduled for Sundays at 03:17 UTC (11:17 Hong Kong time) and can also be dispatched manually. It uses the protected `production` environment, so each run waits for its environment approval before accessing production credentials. The workflow exports `kwmpf-production`, checks that the published snapshot ID did not change during export, uploads SQL and a SHA-256/byte-count manifest to `kwmpf-production-raw/backups/<backup-id>/`, then reads both objects back and verifies them. It shares a concurrency group with `Deploy production` so the export cannot overlap a deployment.

For production deployments after this workflow change reaches `main`, the pre-deployment export and manifest are also read back from R2 before any D1 migration. The downloaded manifest must match byte-for-byte, and the SQL byte count and SHA-256 must match the manifest. Any download or integrity-check failure stops the deployment before migration. Production Deploy run 21 predates this guard; its backup was stored in R2 but was not read back by that workflow.

The D1 export is read-only; the workflow writes new backup objects to production R2. The current retention decision is to keep automatic expiration disabled for staging and production backups and source archives; review this if the storage policy changes. [Backup production D1 run #1](https://github.com/Kirkwongcn/KWMPF/actions/runs/36291241851) completed on 2026-09-27 with backup ID `d1-2026-09-27T03-24-34Z-run-36291241851` and snapshot `snapshot-mpfa-platform-2026-07-31-b39ba9d1e9d9`; the SQL and manifest were read back and integrity checks passed. [D1 Restore Drill #11](https://github.com/Kirkwongcn/KWMPF/actions/runs/36291477885) then verified the manifest, SHA-256 and byte count, imported the SQL into runner-local D1, and passed checks for 451 fund-class versions, 32 comparison groups, and zero orphan rows. The drill did not write production D1 or deploy the site. The restore workflow remains manual and protected by the source environment; no quarterly drill cadence is configured.

The pre-deployment backup from Deploy production run #19 was `d1-2026-09-27T06-33-30Z-run-36300404983`. [D1 Restore Drill #12](https://github.com/Kirkwongcn/KWMPF/actions/runs/36301548688) used that backup after approval of the protected `production` gate. It verified the manifest, SHA-256 and byte count, restored to runner-local D1, and passed checks for snapshot `snapshot-mpfa-platform-2026-07-31-b39ba9d1e9d9`, 451 fund-class versions, 32 comparison groups, and zero orphan rows. The drill did not write production D1 or deploy the site. The separate [scheduled production backup run #2](https://github.com/Kirkwongcn/KWMPF/actions/runs/36309140770) succeeded with backup ID `d1-2026-09-27T10-35-47Z-run-36309140770`; R2 read-back matched its manifest, SHA-256 and byte count. Restore drills remain manual; no quarterly cadence is configured.


### Production release tuple manifest

After this workflow change reaches `main`, a production run that successfully deploys both the Worker and Pages records its release tuple in private production R2 at `releases/<commit-sha>/run-<run-id>-attempt-<attempt>/manifest.json`. The workflow marks both deployments with the same run/attempt/SHA value, then queries Cloudflare's deployment APIs. It accepts the tuple only when that Worker deployment is the latest active deployment serving 100% traffic and the latest successful production Pages deployment has the matching commit and marker ([Worker deployments API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/deployments/methods/list/), [Pages deployments API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/list/)).

The manifest records the exact Worker deployment and version IDs, Pages deployment ID and URL, production commit, published snapshot, source and trustee-return object keys, pre-deploy D1 backup manifest and Time Travel timestamp, plus the publication smoke-check results. The workflow reads the R2 manifest back and compares it byte-for-byte. If both services deployed but a later publication smoke check failed, the tuple is still recorded with that check's failure status for incident investigation. The artifact does not contain API credentials or the D1 database identifier. It improves release identification; it does not restore D1 or coordinate a rollback. R2 expiration remains disabled by the current retention decision.

### Production incident handling and coordinated rollback

KWMPF production is a release tuple: the API Worker version, the Pages production deployment, the D1 schema and `current_publication` snapshot, plus the source snapshot and trustee-return candidate. These resources do not roll back as one transaction. A Worker version rollback does not restore D1 data or other bound resources, and a Pages rollback only targets a successful production deployment ([Workers rollback guidance](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/), [Pages rollback guidance](https://developers.cloudflare.com/pages/configuration/rollbacks/)). Confirm that the selected code, schema, and publication are compatible before changing any part of the tuple.

#### Triage by the last completed deployment step

- **Failure before `Apply D1 migrations`:** this deployment has not mutated production D1. Read the run summary and check the public API and Pages site before deciding whether a retry is appropriate; do not restore D1 without evidence of a database change.
- **Migrations applied, but Worker deployment was not attempted:** the workflow runs its pre-deploy D1 Time Travel restore on failure or cancellation. Confirm that this restore step succeeded and that the public `/summary` still serves the expected snapshot. If the restore step failed, stop new production deploys and handle this as an incident.
- **Worker deployment was attempted, or a later Pages/API check failed:** the workflow deliberately preserves the pre-deploy recovery point instead of restoring D1 automatically, because the new Worker may already depend on the new schema and publication. Do not blindly rerun the deployment, restore D1 alone, or roll back only the Worker.

#### Coordinated response

1. Pause new production deploys and record the failed Actions run, commit SHA, last completed step, pre-deploy snapshot ID, rollback timestamp, R2 backup ID/prefix, and any Worker version or Pages deployment ID shown by Cloudflare.
2. Choose a forward fix or a rollback. Prefer a forward fix when the compatibility of an older release with the current D1 state cannot be demonstrated.
3. Identify a known-good release tuple from a previously successful production run. Confirm the exact Worker version, successful Pages production deployment, D1 snapshot/schema, source snapshot, and trustee-return candidate. Check the active D1 state and the target restore point before making changes.
4. Check the D1 Time Travel timestamp with the production backup manifest and Cloudflare's current retention limits. A Time Travel restore overwrites production D1 in place; capture the current point first so an accidental restore can be undone. Obtain explicit owner approval for any production D1 restore.
5. Plan Worker, Pages, and D1 changes as one operation. Select an order that keeps every intermediate combination compatible. If no safe order is known, stop and plan a controlled maintenance window before changing resources. The current repository does not have a protected workflow that restores production D1 from the long-term R2 SQL archive, so do not improvise a direct SQL import to production.
6. After the approved change, verify `/summary` returns the chosen snapshot and a non-zero fund count; verify `/rankings?metric=return&period=3` has the expected non-zero rows, cache headers match policy, and the Pages health page shows the intended release. Record the final Worker version, Pages deployment, D1 snapshot, source candidate, and backup ID.

#### Recovery evidence and remaining validation

Production Deploy #21's pre-deploy D1 backup is `d1-2026-09-27T13-18-11Z-run-36321882802`; [Restore Drill #14](https://github.com/Kirkwongcn/KWMPF/actions/runs/36360500072) verified its R2 bytes and restored it only into runner-local D1, checking the prior snapshot, 451 fund classes, 32 comparison groups, and zero orphan rows. This proves that this archived backup can be read and restored in isolation; it does not prove that production D1 can be restored safely or that Worker and Pages can be rolled back together.

D1 Time Travel is a separate recovery point with plan-dependent retention. Check the current bookmark and timestamp immediately before any restore ([Cloudflare D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)). R2 object expiration remains disabled by the user's retention decision. A combined production rollback has not been exercised; complete and rehearse a protected production-restore workflow in staging before marking OPS-03 complete.
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
- `Deploy production` 會在資料庫改動前把 D1 匯出、manifest 和 rollback timestamp 存入 production R2；另外封存來源 JSON 及 return-observations 候選資料。此 PR 加入在 migration 前由 R2 讀回 SQL 和 manifest、比較 manifest bytes 並驗證 SQL bytes/SHA-256；核對失敗會阻止 D1 migration。
- Production backup #1 / Restore Drill #11、run #19 的 pre-deploy backup / Restore Drill #12 都已驗證成功。Run #21 的 pre-deploy backup 已寫入 production R2，但由於當時沒有 read-back guard，尚未經讀回或隔離還原演練。最新 staging Restore Drill #13 成功還原 backup #11 到 runner-local D1，但不涵蓋 production。Restore drills remain manual; no quarterly cadence is configured.
- Current decision: keep automatic R2 object expiration disabled for D1 backups and source archives. Cloudflare lifecycle rules can be scoped by prefix; do not add deletion rules without a renewed retention decision. [R2 lifecycle behavior](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).

## Trustee factsheet PDF archive

The manual `Archive trustee fact sheets to R2` workflow accepts a dated `source_batch` from `data/sources/<YYYY-MM-DD>/trustee-fact-sheet-links.json`. It downloads PDFs sequentially, verifies HTTPS redirects, PDF signatures, byte counts and SHA-256 values, and preserves per-file failures in a manifest. GitHub retains the intermediate artifact for 30 days so the protected archive job can consume it.

When at least one PDF is available, the second job waits for the protected `staging` environment, packages a deterministic archive and index, then stores both under `kwmpf-staging-raw/source-archives/trustee-fact-sheets/<batch>/run-<id>/`. It reads both objects back and compares the bytes with the uploaded files. The workflow does not touch D1 or deploy a site. The first successful post-merge archive is [run #2](https://github.com/Kirkwongcn/KWMPF/actions/runs/36291323183): 58 of 58 PDFs downloaded, zero failures, and a 63,874,721-byte deterministic archive. It stored `trustee-fact-sheets.tar.gz` and `index.json` under `kwmpf-staging-raw/source-archives/trustee-fact-sheets/2026-08-31/run-36291323183/`; both objects were read back and compared byte-for-byte. No automatic expiry is configured.
