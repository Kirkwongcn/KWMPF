# KWMPF Claude Code 獨立檢查報告（2026-10-01）

檢查時間：2026-10-01 16:55–17:35 香港時間（UTC 08:55–09:35）；評估日 UTC `2026-10-01`。
範圍依 [CLAUDE_REVIEW_BRIEF](../CLAUDE_REVIEW_BRIEF.md)：**只檢查、重現及提出方案**；沒有修改網站 code／資料、沒有合併、部署、dispatch workflow、改 Cloudflare 或寫 R2。

狀態用詞：**已驗證**＝本次在本環境實際執行或讀 code 得出並可重現；**推測**＝有 code 依據但未在真實環境重現；**未核實**＝本環境無法取得證據。

## 1. 環境與版本

| 項目 | 實際值 |
| --- | --- |
| 平台 | Claude Code on the web（Anthropic 管理的 Linux 雲端容器，Linux 6.18），不是 Zo／Windows |
| 工作目錄 | `/home/user/KWMPF` |
| Remote | `https://github.com/Kirkwongcn/KWMPF`（fetch／push 同一 URL） |
| 接手 branch／SHA | `origin/docs/claude-handoff-20261001-safe` = `2e711533cd19a4c002b7d1b47f0cb80d548f947b`（與使用者提供基線相同；遠端沒有更新） |
| main | `6a593dba460b905badbfca9e9eac85a16318309e`；接手 branch 比 main 多 11 個文件／交接 commit，main 是其祖先 |
| 報告 branch | `claude/brave-cerf-17etdq`（由基線 `2e71153` 建立；此 session 指定的開發 branch） |
| 開始時 git status | 乾淨 |
| 工具 | Bun **1.3.11**（從 npm `@oven/bun-linux-x64@1.3.11` 取得，放 scratch 目錄；tgz SHA-256 `c0b56af0…1231`）；環境預設 Bun 1.3.14 **未使用**。Node 22.22.0、Python 3.11.15、Git 2.43.0、Bash 5.2.21、poppler（pdftotext/pdftohtml）、jq、curl |
| Playwright 瀏覽器 | repo 鎖 Playwright 1.57.0（要 Chromium rev 1200 / 143）；環境只有 rev 1194（Chromium 141.0.7390.37）。以 scratch 目錄 symlink 對應 rev 1200 → 1194 執行，**沒有改 repo 設定或 lockfile**，結果需注明瀏覽器版本差異 |
| 網絡 | 環境 egress policy 拒絕 `mfp.mpfa.org.hk`、`www.mpfa.org.hk`、受託人網站（AIA、BCT、Fidelity…）、`kwmpf.kirkwongcn.com`、`kwmpf-api-production.kw-screener.workers.dev`；只可用 npm registry 及 GitHub |
| R2 認證 | 環境**沒有** `R2_ENDPOINT`／`R2_ACCESS_KEY_ID`／`R2_SECRET_ACCESS_KEY`；私人原件未取得（見 §6） |
| Skills | 本環境沒有 impeccable、github-actions-efficiency、web-perf 等 skill（原件只在 private R2 `preserved/skills/`，未取得）。本次以人手 code review＋Playwright 腳本代替，**不等於該等 skill 已執行** |

## 2. 實際執行的指令與結果

| # | 指令 | 來源／overlay／評估日 | exit | 結果 | 證據 |
| --- | --- | --- | --- | --- | --- |
| 1 | `bash scripts/prepare-cloud-workspace.sh`（內含 `bun install --frozen-lockfile`） | HEAD `2e71153` | 0 | 通過；366 packages，lockfile 無變更 | install.log `a5ebd16d…` |
| 2 | `bun run check` | HEAD `2e71153` | 0 | 通過：prettier、check:shell（含 production source review preflight、freshness audit 4/4）、typecheck、test（coverage 333/333、api 80/80、web 115/115）、build（Worker `--dry-run`） | check.log `c3e567ce…` |
| 3 | `bash scripts/check-publication-seed.sh`，`KWMPF_E2E_SOURCE`＝`data/sources/2026-09-26/mpf-fund-platform.json`（SHA `04b78cfc…ca5a`），overlay＝`data/coverage/2026-09-30-official-return-observations-candidate.json`（SHA `87d1e43c…a5eb`） | UTC 2026-10-01T09:21Z | 0 | 通過：`rankingRows=37 excludedStaleCount=258`；三筆 interpretation provenance（mpfa-cf-1159／284／285）通過 | seed.log `56a87716…` |
| 4 | 同上但模擬 CI：`KWMPF_PUBLICATION_SEED_RETURN_OBSERVATIONS=""`，不設 `KWMPF_E2E_*` | 同日 | 0 | 通過，但實際用了 **2026-08-13 舊 overlay**：`rankingRows=23 excludedStaleCount=188`（見 F-02） | seed-ci-empty-overlay.log `1b7a2ba7…` |
| 5 | `bun run e2e`（CI=1）第一次 | 最新 source＋overlay | 1 | **未開始**：66 tests 全部在 `browserType.launch` 失敗（缺 Chromium rev 1200）；不是 assertion 失敗 | e2e-latest.log `59502a26…` |
| 6 | `bun run e2e`（CI=1，`PLAYWRIGHT_BROWSERS_PATH` 指向 rev 1200→1194 對應） | UTC 2026-10-01T09:23Z；最新 source＋overlay | 0 | **66/66 passed**（desktop＋Pixel 5，1.7 分鐘）；瀏覽器實為 Chromium 141 | e2e-latest2.log `69057e22…` |
| 7 | 本機 Worker（port 8898）＋`curl` 三筆基金 platform/overlay→seed→API 比對 | 最新 source＋overlay | – | 27 欄位全部一致（見 §4.2） | 本報告 |
| 8 | `curl` 搜尋邊界案例 26 項＋中文詞 21 項 | 同上 | – | 見 F-05 | 本報告 |
| 9 | `bun evidence/…/fresh.ts`（呼叫 repo `evaluateFreshness`） | 指定日期 | 0 | 時效邊界見 F-01 | [fresh.ts](evidence/claude-2026-10-01/fresh.ts) |
| 10 | `bun evidence/…/ops02-repro.ts`（真 Hono app＋假 D1） | – | 0 | OPS-02 重現：`headerSnapshot=snapshot-A`、`bodySnapshot=snapshot-B` | [ops02-repro.ts](evidence/claude-2026-10-01/ops02-repro.ts) |
| 11 | Playwright 審查腳本（14 routes × desktop/mobile） | 本機 vite preview＋本機 Worker | 0 | 見 F-12／§4.5 | [ui-audit.mjs](evidence/claude-2026-10-01/ui-audit.mjs)、[summary](evidence/claude-2026-10-01/ui-audit-summary.json) |
| 12 | GitHub 只讀：open PR、workflow runs | GitHub API（MCP） | – | open PR 0；main CI #813 success；最近 production deploy run #28（`3f65596`）success | – |
| 13 | R2 還原 `restore-private-handoff.py` | – | – | **未執行**（無 R2 認證） | – |
| 14 | 官方網站／正式網站讀取 | – | – | **未執行**（egress 拒絕，curl 得 CONNECT 403） | – |

所有 logs 只在本環境 scratch 目錄（見 §7 未同步）；歷史 CI #808／#810／#813 是別人的 runs，不計作本次通過。

## 3. 發現清單（按優先級）

| ID | 優先 | 狀態 | 問題／影響 | 重現 | 檔案行號 | 收貨條件 |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | **P0** | 已驗證（日期推算＋repo 函數） | **資料時效倒數**。一年／五年／十年回報及規模均截至 2026-08-31，45 日門檻 → **2026-10-16（UTC）起全部 stale**；三年合資格 37 筆只來自富達 23（截至 07-31）＋海通 14（截至 08-31）→ **10-30 起剩 14、11-30 起 0**。11-30 後 `deploy-production` smoke（`three_year_rows == 0` 即失敗並觸發復原）會令任何正式發布失敗；CI publication-seed 亦會因 `ranking_count == 0` 失敗 | `fresh.ts`：08-31/45 日 → 10-15 verified、10-16 stale；07-31/90 → 10-30 stale；08-31/90 → 11-30 stale | `apps/api/src/freshness.ts:31-56`；`packages/coverage/src/data-freshness.ts:5-6`；`.github/workflows/deploy-production.yml:267`；`scripts/check-publication-seed.sh:63` | 10-16 前完成新平台批次（應為 2026-09-30 資料）候選→審核→批准發布；Q3（09-30）三年候選在 10-30 前入庫；smoke 改為與「預期合資格數」或時效狀態掛鉤而不是硬性 >0（需使用者決定） |
| F-02 | **P1** | 已驗證 | **CI publication-seed 沒有用正式發布的 overlay**。code PR（高危路徑或來源）沒有改 candidate 時，CI 傳空字串 env，`e2e-serve-api.sh` 的 `:-` 回落到 **2026-08-13 partial overlay**；正式發布則用最新 candidate（2026-09-30）。CI 驗證的不是要發布的資料；舊 overlay 最新 23 筆亦會在 10-30 失效，令無關 code PR 變紅 | §2 #4：同一 source，空 overlay → 23/188；最新 overlay → 37/258 | `.github/workflows/ci.yml:180`；`scripts/e2e-serve-api.sh:9`；對照 `deploy-production.yml:74-87` | CI 與 deploy 共用同一條「最新 candidate」解析（抽成 script）；空值時明確選最新 candidate 並在 summary 印出 path＋SHA；加測試覆蓋空 env |
| F-03 | **P1** | 已驗證（code）／推測（正式影響） | **OPS-02 snapshot 不一致**。cache middleware 讀一次 `current_publication` 決定 ETag／`X-Snapshot-Id`／cache key，route 再讀一次產生 body；發布切換剛好落在兩次之間時 header 與 body 屬不同 snapshot，並以舊 key 寫入 edge cache；若之後**回滾**到舊 snapshot，會由 cache 送出新 body | `ops02-repro.ts`：`{"headerSnapshot":"snapshot-A","bodySnapshot":"snapshot-B","consistent":false}` | `apps/api/src/caching.ts:99-150`；`apps/api/src/index.ts:61-68,233-296,446-449,712-716` 等各 route 自讀 | middleware 讀出的 snapshotId 放入 Hono context，所有 route 以 `WHERE snapshot_id = ?` 讀；加並行切換單元測試（假 D1）證明 header＝body＝cache key；回滾演練時驗證 |
| F-04 | **P1** | 已驗證（機制）／未核實（官方原文） | **「三筆官方原文核對」實際只核 JSON 一致性**。`check-publication-seed.sh` 比對 interpretation provenance 與 `fund-fact-sheet-disclosures.json`／平台 JSON 的 URL、日期、標籤及樣本數，**不比對任何數值，也不讀 PDF／HTML 原文**；文件把它描述為原文核對 | 讀腳本 L72-127 | `scripts/check-publication-seed.sh:72-127`；`docs/agents/change-policy.md` §1 | 另設可重現的原文核對腳本：由 R2／archive 取 PDF SHA→`pdftotext`→指定頁抽值→與 candidate 數值字串比對；文件改正用語 |
| F-05 | **P1** | 已驗證 | **中文搜尋覆蓋不足**。基金名只有英文，別名表只有少數詞；本機 API 實測 0 結果：東亞、恒生、中銀（別名只認「中銀保誠」）、海通、新鴻基、銀聯、萬全、股票、債券、混合資產、亞洲、香港、中國、美國、歐洲、全球、指數、預設投資策略、強積金保守、太平洋。有結果：富達 27、永明 31、宏利 69、中國人壽 17、友邦 21、保守基金 29、核心累積 28 | `curl -G --data-urlencode q=東亞 /search` → `X-Total-Matches: 0` | `apps/api/src/search.ts:2-16` | 由官方中文名稱（積金局平台中文版／受託人中文便覽）建立 per-fund 中文名欄位；過渡期擴充別名表（受託人全名／簡稱、基金種類、地區）並加正反測試；0 結果時 UI 提示可用英文或受託人名稱 |
| F-06 | **P2** | 已驗證 | **比較頁把官方 N/A 與缺資料混為一談**。`FundComparePage` 熱圖只用 `returnsFreshness`，沒有讀 `returnUnavailable`；官方便覽寫 N/A 的期間顯示「未取得／缺資料」。另外過期數值在點圖被設為 `null` 後顯示「未取得」，實際是「已取得但過期」。詳情頁已正確處理 | 讀 code；BEA Income 三年官方 N/A（歷史驗收頁 9）在比較頁會顯示缺資料 | `apps/web/src/FundComparePage.tsx:109-142`；`apps/web/src/DataCharts.tsx:65,416-424` | 熱圖 cell 增加 `official-na` 狀態及頁碼／來源；點圖對過期值顯示「過期（不繪製）· 截至日」；加單元測試 |
| F-07 | **P2** | 已驗證（機制）／未核實（實際有無尾 0 原文） | **官方數字字串精度未保存**。平台 parser 以 `Number()` 轉換所有百分比／金額，`0.90%` 會變 `0.9`，UI 以 JS 數字顯示。與紅線 1「不可改寫官方數字」方向相反（去 0）；BEA Growth 管理費 API 值 `0.9`，原文是否寫 `0.90` 因無法讀官方網站而未核實 | 讀 code | `packages/coverage/src/platform-parser.ts:113,131,163,179,195,313` | 需使用者決定：保存 `raw` 字串欄位（顯示用）＋數值（排序用），或文件明確接受「數值等價」；先抽查原 HTML archive |
| F-08 | **P2** | 已驗證 | **時效評估時間點不一致**。middleware 以請求開始的 UTC 日期決定 ETag／cache key，route 另行 `new Date()`；`/schemes` 部分路徑 `evaluateFreshness(dataAsOf ?? "", graceDays)` 沒有傳入同一 `evaluatedAt`。UTC 午夜前後的請求可能以舊日期 key 快取新日期判斷（或相反） | 讀 code | `apps/api/src/caching.ts:100`；`apps/api/src/index.ts:339,822,1019,1274` | 由 middleware 傳入單一 `evaluatedAt`；`/schemes` 1019 行使用同一值；單元測試固定時鐘跨午夜 |
| F-09 | **P2** | 已驗證（code）／推測（正式成本） | **搜尋每次 cache miss 讀全部 451 筆 payload（約 1.99 MB）再 JSON.parse**；本機 50 ms，無正式 P95／D1 rows-read 數據。未有證據需要 FTS | 本機 5 次 42–59 ms；seed `fund_class_versions` 1,991,072 bytes | `apps/api/src/index.ts:262-277,339` | 先在 staging 量度 P95／D1 rows read；如需要，發布時預先產生精簡搜尋索引表（每 snapshot 一行），再考慮 FTS |
| F-10 | **P2** | 已驗證 | **沒有主動監察／時效告警**。workflows 中沒有排程 smoke／freshness probe；F-01 的到期日只會在使用者看網站或下一次發布時才被發現 | 列出全部 workflow triggers | `.github/workflows/*.yml` | 每日只讀 probe（`/summary`、`/data-quality`、三年排名行數、距到期日數）→ 失敗時 GitHub issue／通知；通知管道需使用者決定 |
| F-11 | **P2** | 已驗證 | **Actions 待批准 run 長期懸掛**：`Archive source snapshot in R2` run 36642361750 自 2026-09-29 22:55Z 一直 `waiting`（等待 environment 批准）；此 workflow 由每週 refresh 的 `workflow_run` 觸發，每週都會新增一個待批 run。`backup-production-d1` 9-27 排程 03:17Z 實際 09:22Z 才開始、耗時 73 分鐘 | GitHub runs API | `.github/workflows/archive-source-snapshot-r2.yml` | 決定：保留人手批准（並設 timeout／取消舊 run）或只在有新批次時觸發；備份 run 加耗時監察。**本次沒有批准或取消該 run** |
| F-12 | **P3** | 已驗證 | **SEO／路由**：無 sitemap、無 canonical、各頁共用同一 meta description；robots 無 sitemap；`/fund-classes/*` 及未知路由對不存在 ID 回 HTTP 200（soft 404，不存在基金顯示「未能取得基金資料」而非「找不到」）；`index.html` 寫死 preconnect 到正式 API，staging／E2E build 亦會 preconnect 正式 API；單一 JS bundle 293 KB（gzip 88 KB） | Playwright 審查；讀 `apps/web/index.html:6-10`、`public/_redirects:17`、`src/main.tsx` | 同左 | sitemap 由發布 snapshot 生成；canonical＋per-route description；不存在 ID 顯示明確 404 文案（Pages 層 404 另議）；preconnect 由 `VITE_API_URL` 生成 |
| F-13 | **P3** | 已驗證 | **小問題**：(a) `check-publication-seed.sh` 結尾印出 `source=` 用的是預設解析路徑，不是 `KWMPF_PUBLICATION_SEED_SOURCE` 實際覆寫值（L130）；(b) `bun run check` 產生未忽略的 `scripts/__pycache__/`；(c) 比較頁「左右滑動可查看…」提示在桌面亦顯示；(d) URL `?page=-1`／`page=10001` 令搜尋頁顯示錯誤而非回到第 1 頁；(e) staging snapshotId 不含 overlay／commit（production 有 SHA） | 讀 code／實跑 | `scripts/check-publication-seed.sh:130`；`apps/web/src/FundsPage.tsx:81`；`DataCharts.tsx:383` | 各自小修並加測試 |
| F-14 | **P1** | 未核實 | **三年回報新期別 discovery**：Q3（2026-09-30）便覽一般在季結後 4–8 週發布；AIA 有月度 performance review（現存最新觀察為 2026-05），理論上已有 06–08 月版本；本環境無法連線受託人網站，**未能實測任何 URL** | egress 403 | `data/coverage/2026-09-30-official-return-observations-candidate.json` | 在允許官方網域的環境逐受託人列 URL、查閱時間、HTTP 狀態、PDF SHA、文件／欄位截至日（見 §5 方法） |
| F-15 | **P1** | 未核實 | 正式網站健康、正式 API counts、Pages／Worker 現況、Cloudflare Build triggers、GitHub environment reviewers／branch protection | egress 封鎖；未用 Cloudflare 認證 | – | 由有權限環境只讀核對；本報告不重複引用 Codex 舊結果作為本次證據 |

## 4. 分項檢查結果

### 4.1 三年缺口及時效（評估日 UTC 2026-10-01）

以 repo 候選重新計算（不是沿用 09-30 數字）：451 類別／24 計劃；三年 observations 295，日期分佈 06-30 218、07-31 23、12-31（2025）22、05-31 18、08-31 14；**合資格 37／過期 258／缺 156**，與 09-30 歷史基線數字相同（因 06-30 在 09-29 已滿 91 日）。

| 計劃 | 類別 | 合資格 | 過期 | 缺 |
| --- | ---: | ---: | ---: | ---: |
| AIA MPF - Prime Value Choice | 21 | 0 | 18 | 3 |
| AMTD MPF Scheme | 16 | 0 | 16 | 0 |
| BCOM Joyful Retirement MPF Scheme | 14 | 0 | 7 | 7 |
| BCT (MPF) Industry Choice | 12 | 0 | 12 | 0 |
| BCT (MPF) Pro Choice | 26 | 0 | 26 | 0 |
| BCT MPF - Simple Plan | 10 | 0 | 10 | 0 |
| BCT MPF - Smart Plan | 14 | 0 | 14 | 0 |
| BCT MPF Scheme Series 800 | 28 | 0 | 22 | 6 |
| BCT Strategic MPF Scheme | 26 | 0 | 0 | 26 |
| BEA (MPF) Industry Scheme | 12 | 0 | 12 | 0 |
| BEA (MPF) Master Trust Scheme | 17 | 0 | 17 | 0 |
| BEA (MPF) Value Scheme | 11 | 0 | 11 | 0 |
| BOC-Prudential Easy-Choice MPF Scheme | 17 | 0 | 3 | 14 |
| China Life MPF Master Trust Scheme | 10 | 0 | 6 | 4 |
| Fidelity Retirement Master Trust | 23 | 23 | 0 | 0 |
| HSBC MPF - SuperTrust Plus | 20 | 0 | 9 | 11 |
| Haitong MPF Retirement Fund | 14 | 14 | 0 | 0 |
| Hang Seng MPF - SuperTrust Plus | 20 | 0 | 9 | 11 |
| MASS Mandatory Provident Fund Scheme | 14 | 0 | 14 | 0 |
| Manulife Global Select (MPF) Scheme | 29 | 0 | 12 | 17 |
| Manulife RetireChoice (MPF) Scheme | 39 | 0 | 0 | 39 |
| My Choice Mandatory Provident Fund Scheme | 17 | 0 | 3 | 14 |
| SHKP MPF Employer Sponsored Scheme | 10 | 0 | 8 | 2 |
| Sun Life Rainbow MPF Scheme | 31 | 0 | 29 | 2 |

候選檔所有 295 筆三年值都有數字，沒有 `null`；官方 N/A 由 disclosures 的 `returnUnavailable` 另行表達（F-06）。平台記錄只有 1／5／10 年及成立至今，沒有三年，三年完全依賴受託人便覽。

### 4.2 數字及日期鏈（platform／overlay → seed → API）

本機 Worker（最新 source＋overlay）`/fund-classes/:id` 與來源 JSON 逐欄比對，27 欄位全部相同、精度不變：

| 基金 | 1y | 5y | 10y | 3y（來源日期／狀態） | 管理費 | FER | FRI | 風險 | 規模 HKD m |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mpfa-cf-102 AIA Greater China Equity | 28.57 | 4.77 | 9.23 | 22.31（2026-05-31，stale 123 日） | 1.205 | 1.674 | 19.36 | 6 | 21939.61 |
| mpfa-cf-1159 Fidelity HK Tracker | 3.93 | 2.4 | 3.54 | 11.9（2026-07-31，verified 62 日） | 0.468 | 0.7443 | 20.16 | 6 | 2588.66 |
| mpfa-cf-1040 BEA Growth（Value Scheme） | 15.87 | 4.81 | 6.77 | 14.73（2026-06-30，stale 93 日） | 0.9 | 0.97939 | 9.82 | 4 | 31.57 |

每個三年值帶自己的 `dataAsOf`／`sourceUrl`，沒有沿用平台 `dataAsOf`。**PDF／HTML 原文 → candidate 這一段未核實**（無 R2、無官方網站存取）；UI 層由 E2E 66/66 覆蓋，未逐字截圖比對這三筆。

### 4.3 搜尋、篩選、排序、分頁、比較

已驗證：空查詢 451 筆、每頁 50、page 10 剩 1 筆、page 11 空陣列；`page=0`、`pageSize=101`、`sort=bogus`、`riskClass=8/abc` 均 400；不存在受託人 0 筆；`X-Total-Matches`、`X-Snapshot-Id` 已在 CORS expose。基金比較頁以四個 `/fund-classes/:id` 回應的 snapshotId 一致性作防護（但受 F-03 影響，header／body 可不一致）。搜尋結果 body 不含 snapshotId，跨頁選取不能偵測換版。`sort=return` 用一年回報，不排除過期值（排名頁另有排除），UI 須清楚標示（需決定是否沿用）。

### 4.4 Snapshot／ETag／快取／UTC

ETag 綁 path＋排序後 query＋contentVersion＋RELEASE_VERSION＋UTC 日期（ADR 0009 已實作）；edge cache key 同樣包含日期。304 只在 route 200 之後回應，避免偽造 validator 掩蓋 400／404（已驗證 code）。`If-None-Match` 只做完全字串比較（不支援多值或 `W/`），影響僅是少了 304。主要風險為 F-03、F-08。本地種子沒有 `candidate_batches` 行，contentVersion 為 `…:unknown`；production snapshotId 含 commit SHA，staging 沒有（F-13e）。

### 4.5 品牌、圖表、手機、鍵盤、可及性（本機 lab）

原 header／kW 品牌、深藍＋金色、世界地圖 hero 保留。14 routes × desktop 1280／Pixel 5：全部單一 h1、無標題跳級、`<main>` 及「跳至主內容」連結存在、首三個 Tab 停點有 3px solid 焦點框、無水平溢出（393 px）、沒有無名稱控制項；不存在路由只有預期的 API 404 console error。圖表：`ValueBars`／`CalendarColumns` 零起點共同尺度、不畫缺值、列出單位；曆年柱註明「每條柱代表完整曆年」；熱圖註明「不同期間並非時間走勢」並保留日期及來源——**沒有虛構連續走勢**。缺口：F-06（N/A 與過期文字）、圖表沒有明示樣本數、`<figure aria-label>` 與 `figcaption` 重複朗讀。觸控：表格內文字連結多數高度 < 24 px（排名頁 863 個），屬 inline 連結例外但手機上密集，建議真機檢查。未做：讀屏實測、200% 放大、真機、axe 自動規則（工具未安裝）、Core Web Vitals field data。

### 4.6 GitHub Actions 效率及部署觸發

觸發（已讀全部 13 個 workflow）：只有 `ci.yml` 響應 `pull_request` 及 push `main`；其餘為 schedule／workflow_dispatch／workflow_run。**push 功能分支不觸發任何 workflow**；deploy-production／staging 只有 manual。CI 已有 bun cache、同 ref concurrency cancel、按路徑決定 E2E／seed、只在失敗上傳 Playwright artifact（7 日）。可節省／加固：F-02、F-11；`actions/upload-artifact@v4` 仍在 v4（已有未合併分支處理 Node 24）；PR 及 merge 後 main 各跑一次 verify（約 40 秒，可接受）。Cloudflare Workers Builds／Pages Git 連結本次**未核實**（沒有使用 Cloudflare 認證），沿用 Codex 2026-10-01 只讀結果作參考，不作本次證據。

### 4.7 專業網站運作：監察、備份、還原

production D1 備份只有 2 次 run（9-27 manual＋schedule），下一次排程 10-04；restore-drill／restore-r2-d1 為 manual。沒有 SLO、可用性 probe、時效告警（F-10）。release tuple 寫入私人 R2 並有 verify workflow（code 已讀，未執行）。協調 D1＋Worker＋Pages 回滾演練仍未見記錄；F-03 令「回滾後 cache 送出新 body」成為演練必測項目。

## 5. 有次序的修復方案（待使用者確認範圍；本次未實作）

1. **資料時效（F-01、F-14）— 2026-10-16 前**：(a) 監察每週 refresh 是否抓到平台 2026-09-30 批次；有就走既有 candidate PR→審核 disposition→批准 production deploy。(b) 三年：逐受託人在允許官方網域的環境查新期別。方法：先用 repo `trustee-fact-sheet-links.json` 現有 URL 的「日期／季度 token」推下一期（例如 AIA `…-performance-review-<month>-2026.pdf`、BEA `…/2026/mpf-xx-2026-3rd.pdf`），以 HEAD/GET 記狀態碼、Last-Modified、bytes、SHA；再到受託人官方目錄頁核實（不能只靠推測 URL）；下載後以 parser 抽取並保留每筆自己的截至日，獨立 data PR＋三筆原文核對。先 AIA（月度）、BEA、Fidelity、Haitong（保持 10-30／11-30 前不失效）。(c) 決定 smoke「三年排名必須 > 0」的語義（F-01 收貨條件）。
2. **CI 與發布對齊（F-02、F-04）**：抽出 `scripts/resolve-latest-return-candidate.sh` 供 CI／staging／production 共用；CI summary 印 path＋SHA；建立真正的原文抽值核對腳本，文件用語改正。小型 code PR，可先做。
3. **快取一致性（F-03、F-08）**：middleware 把 `snapshotId`＋`evaluatedAt` 放入 context，route 改用 bound snapshot 查詢；加假 D1 並行切換測試及 UTC 午夜測試。屬 `apps/api/src`（`publication.ts`／`freshness.ts` 在高危路徑），需 high-risk review 憑證。
4. **中文搜尋（F-05）**：短期擴充別名＋正反測試；中期由官方中文名建立 per-fund 中文欄位（需確認官方中文來源可用）。之後按 F-09 量度再決定索引表／FTS。
5. **顯示準確度（F-06、F-07）**：比較頁官方 N/A 狀態與過期文案；決定是否保存官方原字串。
6. **運作（F-10、F-11）**：每日只讀 probe＋告警（通知管道待定）；處理懸掛 waiting run 政策；協調回滾演練包含 cache 驗證。
7. **SEO／細節（F-12、F-13）**：sitemap／canonical／per-route description、soft 404 文案、preconnect、`__pycache__` ignore 等。

不建議重做 UI；現有品牌與圖表原則可保留，修改集中在狀態文案及搜尋。

## 6. 私人證據（R2）

| 物件 | key | bytes | SHA-256 | 本次取得 |
| --- | --- | ---: | --- | --- |
| 最新指標 | `independence-current.json` | 未知 | 未知 | **未取得** |
| 固定 index | `independence/2026-10-01/snapshot-20261001-153225/preservation-index.json` | 2976331 | `d17b0602e064a1e91c8a6ea60b0fdfb101877bbba87a67294c998c083720cb72` | **未取得**（值取自使用者指示及 LOCAL_INDEPENDENCE，未讀回） |
| 8 份補充 ZIP | 由 index 指定 | 合計 391,382,987（文件記載） | 由 index 指定 | **未取得** |
| 舊基底 ZIP | `handoffs/2026-10-01/a5b565823297d7ff85ed6a612fc83e70d0a2d8ac/handoff.zip` | 4285619 | `c4d45700a01b80fd5795441725164e4f9ff4eaf74d7961a319bd9dd4f84204f6` | **未取得** |
| 4 份 Git bundles／403 skills 檔 | index 內 | – | – | **未取得、未驗證** |

原因：環境沒有 `R2_ENDPOINT`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`。環境中另有用途不明的 AWS 類變數，**沒有讀取或使用**。所有依賴原 PDF／HTML／bundle 的核對列為未核實。

## 7. 本次未同步／只在本環境的檔案

位於 session scratch 目錄（容器回收後消失；均不含 secrets）：`install.log`、`check.log`、`seed.log`、`seed-ci-empty-overlay.log`、`e2e-latest.log`、`e2e-latest2.log`、`ui-audit.json`（完整版）、`shots/*.png`（28 張截圖）、`api-state/`（本機 D1／seed.sql）、`web-dist/`、`bun1311/`、`pw/`。SHA-256 見 §2。若需要保存，建議由使用者批准後上傳私人 R2（本次沒有寫入權限，亦未嘗試）；非敏感摘要及重現腳本已提交到 `docs/reviews/evidence/claude-2026-10-01/`。
