# Deployment

最新狀態（2026-09-30）：PR #358／#359 已合併，main 3f65596 已由 production run #28 成功發布；私有原件、D1 備份及 release tuple 讀回、正式 API 與桌面／手機畫面已核對。詳見 [本次實際發布記錄](reviews/2026-09-30-production-repair-release.md)。以下較早的待辦／未發布敘述保留作歷史紀錄；三年 258 過期／156 未取得及其他 P1／P2 仍須跟進。


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

After upload, it downloads both objects again. The workflow compares the returned manifest byte-for-byte and checks the SQL byte count and SHA-256 against that manifest. This confirms the stored backup objects are intact; it does not prove the SQL can be restored. The separate `D1 Restore Drill` workflow verifies restorability by importing the selected backup into runner-local D1 and checking database invariants; it does not write to a Cloudflare D1. By contrast, `Restore D1 from R2 backup` targets the selected remote environment's D1. After that environment's protected gate, it verifies the chosen backup, creates and reads back a recovery backup of the current D1, then imports the selected SQL and checks live database invariants. Treat the remote restore as a separate, approved D1 mutation.

The backup workflow does not write to remote D1 or deploy the site. Automatic R2 expiration remains disabled.

## Production

`Deploy production` 是 `workflow_dispatch` 專用，永不自動觸發。它需要三重閘門：

1. 觸發時必須在 `confirm` 輸入框逐字輸入 `deploy-production`。
2. `production` GitHub environment 受保護，需要 repository owner 批准。
3. 部署本身不重跑 `bun run check` 或 E2E。「Require main and reuse successful checks for this exact commit」步驟要求同一 SHA 在 `main` 已有成功的 `CI` push run，否則中止，並沿用該 run `verify` job 的 `bun run check`。完整 Playwright E2E（desktop + Pixel 5）只在 PR 的 `CI` 按改動範圍執行（`ci.yml` 的 `e2e` job）；`main` push 只跑 `verify`，因此部署前的 E2E 證據來自合併前的 PR。

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

此前已驗證的正式發布包括 [Deploy production run #21](https://github.com/Kirkwongcn/KWMPF/actions/runs/36321882802)：main SHA `b74ec89f787a4cfececdd8f9286bee1c0685e94f`，公開 snapshot `snapshot-mpfa-platform-2026-08-31-b74ec89f787a`。該版使用 `2026-09-26/mpf-fund-platform.json` 及 `2026-09-27-official-return-observations-candidate.json`；API、三年排名及快取檢查通過，公開三年排名有 209 隻合資格基金，另有 40 隻因披露資料超過 90 日而排除。部署前匯出的舊 D1 snapshot 是 `snapshot-mpfa-platform-2026-08-31-1cb73016b596`；備份 ID 為 `d1-2026-09-27T13-18-11Z-run-36321882802`，R2 prefix `kwmpf-production-raw/backups/d1-2026-09-27T13-18-11Z-run-36321882802/`，SQL 1,982,166 bytes，SHA-256 `755b95bc597b13f916c35fadc8277b5e8e388df4dcd34f4d9fc89615ff67fe33`。該次部署早於以下 R2 read-back guard，因此備份物件尚未經部署 workflow 讀回核對。

### Production source review gate — 2026-09-29

[Deploy production run #24](https://github.com/Kirkwongcn/KWMPF/actions/runs/36509493973) successfully published main `63538b1aa76f927743e026864b8834c57985945f` using `data/sources/2026-09-26/mpf-fund-platform.json`. The API smoke checks passed. The report still says `needs_review` and `publishable: false`, with 14 anomalies across six fund classes (13 OCI changes and one FER change). A live reread of the official MPFA pages on 2026-09-29 at 08:20 UTC found all 14 candidate values matching the values then displayed: CF-131 OCI HKD 18/55/94; CF-141 OCI HKD 15/46/80; CF-145 OCI HKD 17/54/93; CF-876 OCI HKD 10/30/52; CF-877 OCI HKD 9/28/49; CF-1579 Latest FER 1.24313%. The [Fund Information Table](https://mfp.mpfa.org.hk/eng/mpp_list.jsp) labels its latest information as of 31 Aug 2026. The six [official detail pages](https://mfp.mpfa.org.hk/mobile/eng/cf_detail.jsp?cf_id=131), [CF-141](https://mfp.mpfa.org.hk/mobile/eng/cf_detail.jsp?cf_id=141), [CF-145](https://mfp.mpfa.org.hk/mobile/eng/cf_detail.jsp?cf_id=145), [CF-876](https://mfp.mpfa.org.hk/mobile/eng/cf_detail.jsp?cf_id=876), [CF-877](https://mfp.mpfa.org.hk/mobile/eng/cf_detail.jsp?cf_id=877), and [CF-1579](https://mfp.mpfa.org.hk/mobile/eng/cf_detail.jsp?cf_id=1579) date fund size and performance as of 31 Aug; the OCI and Latest FER fields have no separate dates. An earlier cached retrieval showed CF-131 OCI 17/54/93 and CF-1579 FER 1.24314%, so the current match does not establish the exact effective date of those fee fields at the candidate capture on 26 Sep. The recheck neither clears the warnings nor proves the candidate values wrong. No review disposition has been committed, so the preflight still blocks this batch; run #24 predates the guard and does not prove that it passed.

The production workflow requires a same-batch refresh report before resolving return observations, building a seed, exporting production D1, or writing the backup to R2. The candidate date must match the source snapshot, readiness must pass, and source failures must be absent. The preflight requires an explicit anomaly list and fails closed if a report lists anomalies while saying human review is not required. Only `ready`/publishable batches, clean `no_new_data` batches, or `needs_review` batches with a valid `review-disposition.json` may proceed past preflight. A disposition must bind to the exact source and report SHA-256 values, identify the reviewer and UTC review time, reproduce every refresh decision reason exactly, and cover each reported anomaly exactly once with its report detail, matching candidate value, source date, review note, and official MPFA detail URL for that same fund class. The report itself remains `needs_review` / `publishable: false`; the disposition does not change the source or report. The preflight checks completeness and version binding, not the truth of the reviewer's judgment; the review still requires inspecting the linked official evidence. Unsupported anomaly kinds and fields, missing or stale hashes, blocked readiness, source failures, and date mismatches remain fail-closed. Passing preflight only reaches the protected production environment gate; it does not approve or dispatch a deployment.

PR #345 adds the initial preflight. For that PR only, the repository owner accepted the documented manual diff review as equivalent to the unavailable `/code-review` command on 2026-09-29. PR #346 adds exact source/report-bound review dispositions and fails closed when the anomaly list contradicts the report's review flag; for PR #346 only, the repository owner accepted manual diff review as equivalent evidence on 2026-09-29. These review-evidence exceptions do not clear the source batch's `needs_review` status or authorize a production deployment.

### Production D1 backup and restore

`Backup production D1` is scheduled for Sundays at 03:17 UTC (11:17 Hong Kong time) and can also be dispatched manually. It uses the protected `production` environment, so each run waits for its environment approval before accessing production credentials. The workflow exports `kwmpf-production`, checks that the published snapshot ID did not change during export, uploads SQL and a SHA-256/byte-count manifest to `kwmpf-production-raw/backups/<backup-id>/`, then reads both objects back and verifies them. It shares a concurrency group with `Deploy production` so the export cannot overlap a deployment.

For production deployments after this workflow change reaches `main`, the pre-deployment export and manifest are also read back from R2 before any D1 migration. The downloaded manifest must match byte-for-byte, and the SQL byte count and SHA-256 must match the manifest. Any download or integrity-check failure stops the deployment before migration. Production Deploy run 21 predates this guard; its backup was stored in R2 but was not read back by that workflow.

The D1 export is read-only; the workflow writes new backup objects to production R2. The current retention decision is to keep automatic expiration disabled for staging and production backups and source archives; review this if the storage policy changes. [Backup production D1 run #1](https://github.com/Kirkwongcn/KWMPF/actions/runs/36291241851) completed on 2026-09-27 with backup ID `d1-2026-09-27T03-24-34Z-run-36291241851` and snapshot `snapshot-mpfa-platform-2026-07-31-b39ba9d1e9d9`; the SQL and manifest were read back and integrity checks passed. [D1 Restore Drill #11](https://github.com/Kirkwongcn/KWMPF/actions/runs/36291477885) then verified the manifest, SHA-256 and byte count, imported the SQL into runner-local D1, and passed checks for 451 fund-class versions, 32 comparison groups, and zero orphan rows. The drill did not write production D1 or deploy the site. The restore workflow remains manual and protected by the source environment; no quarterly drill cadence is configured.

The pre-deployment backup from Deploy production run #19 was `d1-2026-09-27T06-33-30Z-run-36300404983`. [D1 Restore Drill #12](https://github.com/Kirkwongcn/KWMPF/actions/runs/36301548688) used that backup after approval of the protected `production` gate. It verified the manifest, SHA-256 and byte count, restored to runner-local D1, and passed checks for snapshot `snapshot-mpfa-platform-2026-07-31-b39ba9d1e9d9`, 451 fund-class versions, 32 comparison groups, and zero orphan rows. The drill did not write production D1 or deploy the site. The separate [scheduled production backup run #2](https://github.com/Kirkwongcn/KWMPF/actions/runs/36309140770) succeeded with backup ID `d1-2026-09-27T10-35-47Z-run-36309140770`; R2 read-back matched its manifest, SHA-256 and byte count. Restore drills remain manual; no quarterly cadence is configured.


### Production release tuple manifest

After this workflow change reaches `main`, a production run that successfully deploys both the Worker and Pages records its release tuple in private production R2 at `releases/<commit-sha>/run-<run-id>-attempt-<attempt>/manifest.json`. The workflow marks both deployments with the same run/attempt/SHA value, then queries Cloudflare's deployment APIs. It accepts the tuple only when that Worker deployment is the latest active deployment serving 100% traffic and the latest successful production Pages deployment has the matching commit and marker ([Worker deployments API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/deployments/methods/list/), [Pages deployments API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/list/)).

The manifest records the exact Worker deployment and version IDs, Pages deployment ID and URL, production commit, published snapshot, source and trustee-return object keys, pre-deploy D1 backup manifest and Time Travel timestamp, plus the publication smoke-check results. The workflow reads the R2 manifest back and compares it byte-for-byte. If both services deployed but a later publication smoke check failed, the tuple is still recorded with that check's failure status for incident investigation. The artifact does not contain API credentials or the D1 database identifier. It improves release identification; it does not restore D1 or coordinate a rollback. R2 expiration remains disabled by the current retention decision.


#### Deploy production run #22 — 2026-09-28

[Run #22](https://github.com/Kirkwongcn/KWMPF/actions/runs/36433388885) deployed main commit `19639687a44dc3f8a2a8d5863d37bf24a11383ac` with the 2026-08-31 source snapshot. The published snapshot is `snapshot-mpfa-platform-2026-08-31-19639687a44d`. Worker deployment `ce2d678f-7f45-47f0-93ff-ec16971be8f2` serves version `d229676c-9507-4bec-8935-ad4e5df6ff65` at 100%; Pages deployment `77149d51-8b46-4071-a836-50b614a0eb7b` completed successfully.

The pre-deployment D1 backup `d1-2026-09-28T14-09-49Z-run-36433388885` was written to private R2 and read back successfully; Time Travel rollback timestamp: `1790604589`. Migrations, publication seed, Worker/Pages deployments and public smoke checks all passed. The public API serves 451 fund classes and 209 three-year return rows (40 stale rows excluded) with the expected cache header. A post-deploy desktop lab trace recorded LCP 930 ms and CLS 0.00; CrUX field data is unavailable for this page.

The Actions run is marked failed because its final release-tuple step requested the Pages deployments list with `per_page=100`, which Cloudflare rejected as invalid (error `8000024`). The step stopped before uploading the release manifest. A separate approved repair later backfilled the run-#22 tuple at `kwmpf-production-raw/releases/19639687a44dc3f8a2a8d5863d37bf24a11383ac/run-36433388885-attempt-1/manifest.json`. The R2 listing read-back confirmed the key, 3,650-byte size, `application/json` content type, and ETag `04e4826a3a3af3c221e9226d4f784a3c`; the available Cloudflare connector could not return the raw object bytes, so the uploaded object was not independently compared byte-for-byte. The repair did not modify D1, deploy either service, or change the website. PR #328 removes the unsupported Pages query parameter; it did not rerun production deployment. Because Worker deployment had already been attempted, the workflow preserved the D1 recovery point and did not restore the old database. R2 expiration remains disabled.

#### Read-back and staging restore follow-up — 2026-09-28

[Verify production release manifest run #1](https://github.com/Kirkwongcn/KWMPF/actions/runs/36492108342) passed the protected production gate and fetched the run-#22 manifest from R2 with HTTP 200, the expected 3,650-byte size, and an accepted JSON content type. It stopped at the supplied ETag comparison: the input was `04e4826a3a3af3c221e9226d4f784a3c`, which matched the preceding R2 listing, but the workflow did not record the ETag returned by Get Object. It therefore did not reach JSON validation. The read-back workflow made no writes. The current fix records both normalized ETag values on a mismatch. Corrected production manifest read-back run #3 later passed and validated the manifest JSON and SHA-256; see the verified results below.

[Restore D1 from R2 run #2](https://github.com/Kirkwongcn/KWMPF/actions/runs/36488749768) targeted staging backup `d1-2026-09-28T20-46-15Z-run-36474215557`. Before restore it created and read-back-verified recovery backup `d1-2026-09-28T23-10-14Z-run-36488749768`; both source and pre-restore snapshots were `snapshot-mpfa-platform-2026-07-31`. The Wrangler 4.120.0 SQL-file import returned exit status 0, and the follow-up remote checks passed for the snapshot and 451 fund-class versions; the restored schema has no `comparison_group_stats` table. The job was nevertheless marked failed because it attempted to parse Wrangler's file-import stdout as a JSON array (`jq: Invalid numeric literal`). The outcome manifest was written and read back at `kwmpf-staging-raw/restores/run-36488749768-attempt-1/manifest.json`, and records restore step `failure`, verification `success`, and import exit status `0`. This is a workflow-result parsing failure, not proof of a byte-for-byte database comparison. The fix now uses Wrangler's exit status for file-import command success and retains the separate live invariant check. Do not repeat a remote restore or recovery write without a fresh approval for that run.

### 2026-09-29 corrected production read-back and staging restore

[Verify production release manifest run #3](https://github.com/Kirkwongcn/KWMPF/actions/runs/36504662274) completed successfully after the protected production gate. It read the run-#22 release manifest at `kwmpf-production-raw/releases/19639687a44dc3f8a2a8d5863d37bf24a11383ac/run-36433388885-attempt-1/manifest.json`: HTTP 200, 3,650 bytes, JSON content type, and SHA-256 `61e9bf99a57f874eaac34b4a14ac0c94a5e1f1daeea5ff6c3424e7082af56830`. The manifest matched the run ID, attempt, commit, snapshot, and source data date. The run only read private production R2; it did not write R2 or D1, deploy either service, or change the website. The GET ETag was `W/04e4826a3a3af3c221e9226d4f784a3c`; the unreliable listing ETag was excluded from validation.

[Remote staging Restore D1 run #4](https://github.com/Kirkwongcn/KWMPF/actions/runs/36504598246) completed successfully after the protected staging gate. It verified source backup `d1-2026-09-28T20-46-15Z-run-36474215557` at 482,753 bytes, then wrote and read back the pre-restore recovery backup `d1-2026-09-29T01-11-48Z-run-36504598246` in private staging R2. The SQL import exited successfully and post-restore checks confirmed snapshot `snapshot-mpfa-platform-2026-07-31` and 451 fund-class rows. This older schema has no `comparison_group_stats` table, so no comparison-group count applied. The restore outcome manifest was read back byte-for-byte. This run changed staging D1 and wrote recovery/outcome objects to staging R2; it did not access production or deploy the site. Automatic R2 expiration remains disabled.

The earlier read-back run #1 and staging restore run #2 remain failed historical attempts. Corrected runs #3 and #4 are the successful evidence. The staging restore verifies the R2-to-D1 path for this backup; it does not exercise a coordinated production D1/Worker/Pages rollback.

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
5. Plan Worker, Pages, and D1 changes as one operation. Select an order that keeps every intermediate combination compatible. If no safe order is known, stop and plan a controlled maintenance window before changing resources. The manual `Restore D1 from R2 backup` workflow can restore only the selected environment's D1 from its private R2 SQL archive. It permits `main` only, uses that environment's protected GitHub gate and D1-mutation concurrency lock, requires a target-specific confirmation phrase, and accepts SQL files up to Cloudflare's 5 GiB import limit. It verifies the chosen backup, writes and reads back a fresh pre-restore backup, then imports and checks the selected snapshot. This is a D1-only operation: it does not roll back the Worker or Pages. Staging Restore D1 run #2 on 2026-09-28 applied the selected SQL, and the post-restore checks found the expected snapshot and 451 fund-class rows. The overall job was marked failed because that version tried to parse Wrangler's human-readable SQL-file output as JSON. PR #341 fixed the import result check to use Wrangler's exit status; the run is useful partial staging evidence, not a successful end-to-end rehearsal. Corrected remote staging Restore D1 run #4 on fixed `main` later completed successfully; see the verified results below. Do not treat this workflow as a coordinated production rollback. For a production recovery, first establish a compatible release-tuple plan; a staging drill remains a separate protected D1 write. ([D1 import limit](https://developers.cloudflare.com/d1/platform/limits/)).
6. After the approved change, verify `/summary` returns the chosen snapshot and a non-zero fund count; verify `/rankings?metric=return&period=3` has the expected non-zero rows, cache headers match policy, and the Pages health page shows the intended release. Record the final Worker version, Pages deployment, D1 snapshot, source candidate, and backup ID.

#### Recovery evidence and remaining validation

Production Deploy #21's pre-deploy D1 backup is `d1-2026-09-27T13-18-11Z-run-36321882802`; [Restore Drill #14](https://github.com/Kirkwongcn/KWMPF/actions/runs/36360500072) verified its R2 bytes and restored it only into runner-local D1, checking the prior snapshot, 451 fund classes, 32 comparison groups, and zero orphan rows. This proves that this archived backup can be read and restored in isolation; it does not prove that production D1 can be restored safely or that Worker and Pages can be rolled back together.

D1 Time Travel is a separate recovery point with plan-dependent retention. Check the current bookmark and timestamp immediately before any restore ([Cloudflare D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)). Cloudflare documents that a failed SQL-file import restores the database to its original state ([D1 import and export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)); still verify live D1 before taking further action after any failed or inconclusive run. R2 object expiration remains disabled by the user's retention decision. The remote staging R2-to-D1 restore rehearsal completed in run #4. No combined production rollback covering D1, Worker, and Pages has been exercised; plan the compatible release-tuple sequence before marking OPS-03 complete.

#### OPS-03 coordinated rollback rehearsal preflight

The latest successful production deployment workflow is [run #24](https://github.com/Kirkwongcn/KWMPF/actions/runs/36509493973), commit `63538b1aa76f927743e026864b8834c57985945f`. Its release-tuple step succeeded and read the manifest back byte-for-byte. Treat that manifest as evidence of what the workflow deployed, then recheck the live tuple before any rehearsal; a successful historical run does not prove that its tuple is still active.

Before requesting the protected production gate:

1. Record the live production commit, Worker version and traffic percentage, Pages deployment ID, and D1 snapshot. Select a previously successful production release tuple, and verify that its Pages deployment is still a valid production rollback target.
2. Match the application target to the database recovery point. For a rollback of the latest release, the current release manifest's `databaseBeforeRelease` identifies the pre-release D1 backup and Time Travel point; the prior release tuple identifies its Worker version and Pages deployment. Confirm the current D1 snapshot still matches the expected post-release state and identify any later writes that a restore could discard.
3. Check schema and binding compatibility between the target Worker and the D1 snapshot. Cloudflare Worker rollback immediately activates the selected version but does not revert bound resources; older code may fail against a changed database schema ([Workers rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)). Pages rollback immediately changes production and only accepts a successful production deployment ([Pages rollback](https://developers.cloudflare.com/pages/configuration/rollbacks/)). D1 Time Travel overwrites the database in place and cancels in-flight queries ([D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)).
4. Define the maintenance or compatibility plan and exact order for the three independent operations. They are not an atomic transaction; do not start if a mixed Worker/D1/Pages state could serve incompatible requests.
5. The approval packet must name the exact current and target release tuples, D1 backup ID and snapshot, Worker version ID, Pages deployment ID, operation order, smoke checks, and forward-recovery target. The existing protected `restore-r2-d1.yml` workflow verifies the selected backup and records a D1 restore outcome, but it does not roll back Worker or Pages.
6. After each operation, verify the active Worker version and traffic, Pages production deployment, D1 snapshot and integrity checks, and public API/site smoke checks. On any mismatch, stop and preserve the pre-restore backup and current deployment identifiers before taking another action.

OPS-03 remains incomplete until one approved rehearsal has restored all three components to the selected compatible tuple, passed the checks above, and retained a read-back-verified outcome record covering D1, Worker, and Pages. The existing D1 restore manifest covers only the D1 result.
## 來源更新

`Refresh source snapshot` 每星期三 03:00（香港時間）自動執行，也可以手動觸發。它只產生
候選批次，**永遠不會改動公開網站**：

1. 以 `scripts/resolve-previous-snapshot.sh` 找出 `data/sources/` 之下最新、而且真正帶有 `mpf-fund-platform.json` 的日期目錄（`YYYY-MM-DD`）作為上一批次，讀取它的獨立數量核對值。只放其他官方檔案的日期目錄（例如基金便覽連結批次）會被略過。
   其他名稱的目錄（例如存放使用者提供資料的 `data/sources/lipper/`）不會被當成批次。
2. 擷取官方強積金基金平台，寫出候選快照及原始 HTML 封存（workflow artifact 保留 30 日）。如需長期保存原始 HTML，另以受保護的 staging archive workflow 封存到 private R2；run #2 已封存 refresh run #10 的 452 份來源頁並逐位元讀回核對。
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

### 已完成與仍待驗證

- MPFA raw HTML 已由 [archive run #2](https://github.com/Kirkwongcn/KWMPF/actions/runs/36460730619) 封存 refresh run #10 的 452 個 source entries / bodies 到 private staging R2：`kwmpf-staging-raw/source-archives/refresh-source-snapshot/run-36460369839/`。Deterministic tar.gz 為 1,893,953 bytes；archive 與 manifest 均讀回並逐位元相同。R2 物件沒有自動到期；這不是 offsite 或 immutable backup。
- `Deploy production` 會在資料庫改動前將 D1 export、manifest 和 rollback timestamp 寫入 production R2，並封存 source JSON 和 return-observations candidate。現行 workflow 在 migration 前讀回 SQL 與 manifest，逐位元核對 manifest，並驗證 SQL bytes / SHA-256；核對失敗會停止 migration。
- Production Backup #1 / Restore Drill #11、run #19 pre-deploy backup / Restore Drill #12 已通過。Deploy #21 的 pre-deploy backup 在部署當時沒有 read-back guard；[Restore Drill #14](https://github.com/Kirkwongcn/KWMPF/actions/runs/36360500072) 後來讀回並驗證該 backup，亦在 runner-local D1 還原及核對 snapshot、451 fund classes、32 comparison groups、zero orphan rows。這證明該備份可隔離還原，不證明 production D1 可安全覆寫還原，也不涵蓋 Worker / Pages 協同回滾。
- 隔離的 staging [Restore Drill #13](https://github.com/Kirkwongcn/KWMPF/actions/runs/36317081116) 還原到 runner-local D1，並不會寫 Cloudflare D1。遠端 staging [Restore D1 run #2](https://github.com/Kirkwongcn/KWMPF/actions/runs/36488749768) 則已套用來源 SQL；套用前建立並讀回驗證復原點 `d1-2026-09-28T23-10-14Z-run-36488749768`。還原後 snapshot 及 451 筆基金類別核對通過，但舊 workflow 將 Wrangler 輸出誤當 JSON 而標記失敗。PR #341 已修正這個判斷；待修正版再次完成 staging gate 後，才算有完整遠端還原演練證據。
- Restore drills 仍是手動執行，尚未設定季度演練週期。
- Current decision: keep automatic R2 object expiration disabled for D1 backups and source archives. Cloudflare lifecycle rules can be scoped by prefix; do not add deletion rules without a renewed retention decision. [R2 lifecycle behavior](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).
## Trustee factsheet PDF archive

The manual `Archive trustee fact sheets to R2` workflow accepts a dated `source_batch` from `data/sources/<YYYY-MM-DD>/trustee-fact-sheet-links.json`. It downloads PDFs sequentially, verifies HTTPS redirects, PDF signatures, byte counts and SHA-256 values, and preserves per-file failures in a manifest. GitHub retains the intermediate artifact for 30 days so the protected archive job can consume it.

When at least one PDF is available, the second job waits for the protected `staging` environment, packages a deterministic archive and index, then stores both under `kwmpf-staging-raw/source-archives/trustee-fact-sheets/<batch>/run-<id>/`. It reads both objects back and compares the bytes with the uploaded files. The workflow does not touch D1 or deploy a site. The first successful post-merge archive is [run #2](https://github.com/Kirkwongcn/KWMPF/actions/runs/36291323183): 58 of 58 PDFs downloaded, zero failures, and a 63,874,721-byte deterministic archive. It stored `trustee-fact-sheets.tar.gz` and `index.json` under `kwmpf-staging-raw/source-archives/trustee-fact-sheets/2026-08-31/run-36291323183/`; both objects were read back and compared byte-for-byte. No automatic expiry is configured.
