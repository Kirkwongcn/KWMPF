# KWMPF → Claude Code 即時交接

更新：2026-10-01 14:07（Asia/Hong_Kong；網站驗收基線保留 00:55 證據，時效 API 使用 UTC 日界）。
任務：暫停新增功能與重構，核實並安全保存網站／資料／工作差異及接手文件。
今次不合併、不改 Cloudflare、不 dispatch／批准部署。入口共用規則 [AGENTS](../AGENTS.md)，Claude 入口 [CLAUDE](../CLAUDE.md)。

## 本輪雲端儲存跟進（2026-10-01；尚待 R2 批准）

使用者要求先安排 GitHub／Cloudflare，再更新交接；NAS 尚未設置。先以 KWMPF 處理，沒有把其他項目視為已完成。
本段是較新的儲存狀態；下列網站開發、來源及驗收仍保留原來的證據日期。

**已驗證**：本機與 GitHub 交接分支起始 HEAD 均為 `2c08f15cd14d50e3fa60a5bc983f8f6d0311c5a0`；
main 仍為 `6a593dba460b905badbfca9e9eac85a16318309e`，正式 Pages canonical id／code SHA 未變。
兩個 Worker Build triggers 仍為空，Pages 詳情無 source 欄位；repo CI 是 PR／push main，部署仍 manual。
rulesets GET 回空清單；classic main protection GET 403，不能据此說 main 未受保護。

**已準備、未啟用**：[storage declaration](../config/storage.json) 與 [雲端儲存／取回手冊](CLOUD_STORAGE.md)。
擬建 `kwmpf-handoff` Standard 私有 bucket，保存交接包／入口文件及核對清單；不綁現有 Worker／Pages。
自動批准審查因先前 Cloudflare 批准要求，拒絕首次 bucket creation；已提交具體方案待使用者批准，沒有繞過。
因此目前 **bucket 尚未建立、没有新增 R2 上傳／讀回、没有設定新 token／NAS／自動備份**。

既有初始交接 ZIP 的 bytes `4270131`、SHA-256 `57534ae6bcdecc80b25a44845b1b09a45dbd1c2b5109d859f3b475514bf73c8f`；
425 個文字 entries 經有限秘密模式／檔名／path 檢查無 finding，CRC 無錯誤。不是完整 credential history 認證。
本機路徑：`C:/Users/user/Documents/Codex/2026-09-26/kwmpf/outputs/claude-handoff-2026-10-01/KWMPF-Claude-Code-完整交接-2026-10-01.zip`。

使用者提供 NAS 為 ASUSTOR AS5402T／HDD／RAID 後 12 TB；這是使用者資料，不是本次登入 NAS 核實。
剩餘容量、ADM、Btrfs／ext4、RAM、網絡及每個 LLM 的私人網絡能力均未核實。
Codex Cloud 環境由使用者報稱已設定；本次仍在 Windows 本機，沒有證據已把任務移到雲端 executor。

本輪文件保存後的 exact commit／GitHub push 及 cloud package 結果，讀外部
`C:/Users/user/Documents/Codex/2026-09-26/kwmpf/outputs/cloud-storage-handoff-2026-10-01/HANDOFF_RECEIPT.json`
（不是本檔自己的 hash，也不是公開 repo 路徑），與使用者最後回報核對。
保存初始 ZIP，不能覆寫它而把舊 SHA 當成新包。沒有新增網站功能、合併 main 或正式部署。


## 保存邊界（本次實際狀態）

公開 GitHub 接手分支保存五份入口文件、README、文件索引、非敏感狀態摘要及雲端儲存設定宣告／手冊。
自動批准審查拒絕將整批 production evidence／歷史報告／本機 patch 公開推送，理由是可能含敏感內容，未有明確公開輸出批准。
因此本機原分支 `docs/claude-handoff-20261001` 的保存 commit `78e84da4a24e848fa278b129089f2728e33d8d4e` **未 push**；没有换工具繞過。
全部資料另在交接 ZIP 的 `private-preservation/`，供使用者以私有檔案傳給 Zo。Zip `repo/` 是公開分支的完整網站 snapshot，兩部分不可互相覆蓋。
本文提到的 `handoff/archive/`／`handoff/verification/` 路徑均指 ZIP 的 `private-preservation/docs/` 下附件，**不是公開分支已有檔案**。
公開可讀摘要是 [STATE_SUMMARY.json](handoff/STATE_SUMMARY.json)；最終 commit／push 實證是 ZIP 根目錄 `HANDOFF_RECEIPT.json`。
不能聲稱 Claude 已得到這個 ZIP；接手時需由使用者提供，先核對回執 SHA。

## 1. 版本與環境：已驗證

| 項目 | 實際結果 |
| --- | --- |
| Repo／clone URL | `https://github.com/Kirkwongcn/KWMPF`／`https://github.com/Kirkwongcn/KWMPF.git`；public |
| Codex 工作空間 | `C:/Users/user/Documents/Codex/2026-09-26/kwmpf`；這是本機工作空間資料夾，網站 Git checkout 在下一行 |
| 本次網站 checkout | `C:/Users/user/Documents/Codex/2026-09-26/kwmpf/work/kwmpf-review-redesign`，Windows 本機，非 Zo／Claude 雲端工作目錄 |
| 接手前 Git 狀態 | detached HEAD at `origin/main`；HEAD `6a593dba460b905badbfca9e9eac85a16318309e`；`git status --porcelain=v2 --branch --untracked-files=all` 沒有檔案差異 |
| 現在功能分支 | `docs/claude-handoff-20261001-safe`；由上述 HEAD 建立，網站 code／data 不改 |
| GitHub main | 已即時 GET branch／commits 及 `git fetch --no-tags origin` 核實為 `6a593dba460b905badbfca9e9eac85a16318309e` |
| 遠端保存目標 | `origin/docs/claude-handoff-20261001-safe`；只有核實無部署路徑及有 push 權限後才推送 |
| 交接文件最新 commit ID | 由 `git rev-parse HEAD`／GitHub 該分支取得完整 SHA；本檔不能包含其自身最終 commit hash。最終 SHA／push／clean status 另在交接包 `HANDOFF_RECEIPT.json` 及使用者回報記錄，不把 main SHA 當成文件 tip |
| Push 狀態 | code 基線 `6a593db` 已在 GitHub；公開入口／摘要文件依保存程序 commit／push，最終回執核對 exact tip。歷史 payload 不推公開 GitHub。交接開始時沒有未提交 code，舊 checkout 的未同步差異另保留 |
| 現有 PR | 本次 GitHub open PR API 0 項；#354／357／358／359／360 已合併，merge SHA 及 changed-file count 已核實 |
| 正式 frontend | Cloudflare Pages canonical deployment `48675d4f-4815-4f87-bb8f-b1f3aa5df51d`，stage success，commit `3f655960c620b019f245886d709283c0e1b67590`，ad_hoc、run #28 marker |

查 remote／PR／workflow／Cloudflare 證據：`handoff/archive/remote-and-deployment-verification.json`、`verified-pr-and-ci.json`。
最新 main 與正式版本相差一個文件 commit #360，不是漏發布網站功能。
本機另一個舊 `main` 仍在 `08e269f`，不能在那個 checkout 執行 pull／merge 取代本分支。
盤點開始時 GitHub 有 86 條 remote branches；完整名稱／SHA 隨只讀 metadata 保存，不能把舊分支視為未結 PR。

## 2. 本次網站開發原目標

接手 KWMPF，審視來源時效、搜尋、準確度、架構及 GitHub Actions，修復可證明的缺陷，
沿用原 header／品牌，提供簡潔首頁與深入分析、專業且有來源的多種圖表，解決三年回報缺口。
資料可用度與新 PDF 發現仍未完整；不因介面／測試通過而宣稱「全部優化完成」。

## 3. 已完成：code／commit／實際核實範圍

| 範圍 | 相關檔案／commit | 證據 |
| --- | --- | --- |
| 全流程審查、搜尋／分頁／跨頁比較、資料狀態、UTC freshness／cache | `apps/web/src/`、API `search.ts`／`caching.ts`／`data-quality.ts`；`66b34374976399651e8616b17cbe21be529850a6`（#354） | GitHub merged PR、53 個 changed files、實際入口 code 及審查手冊 |
| 原 header／風格、多種圖表及三年缺口手冊 | `SiteChrome.tsx`、`DataCharts.tsx`、`styles.css`、`DESIGN.md`；`307d481dd4f25ae56247eee2613f64965982d3f0`（#357） | GitHub merged、24 個 changed files；不是虛構時序或合成推薦分數 |
| 永明 draw layer／期間／N/A、東亞雙基金及配置區塊 | `sun-life-fund-fact-sheet-parser.ts`、`bea-fund-fact-sheet-parser.ts`、allocation contracts／fixtures／詳情頁；`59a41349fe8a10744e5ac3763fe74731378bcfdf`（#358） | 已核實 code diff、CI #808 verify／high-risk／E2E／publication-seed success |
| 新官方回報／配置候選 | `data/coverage/2026-09-30-*.json`、`data/sources/2026-09-30/fund-fact-sheet-disclosures.json`、allocation map；`3f655960c620b019f245886d709283c0e1b67590`（#359） | 7 個資料檔、295 observations；CI #810 全 gate 成功，run #28 成功發布 |
| 原件保存、正式發布及驗收記錄 | `docs/reviews/2026-09-30-production-repair-release.md`；`6a593dba460b905badbfca9e9eac85a16318309e`（#360） | GitHub main CI #813 實跑安裝／check 成功；Cloudflare canonical tuple 仍與正式 code SHA 相符 |

本地保留舊 main 基線之後的 commits（基線 `08e269f21e245c0ebed06e919de72f6ef17bf3c0` 後）及涉及檔案完整列在
`handoff/archive/main-task-commits.json`；不是只凭聊天記憶概括為完成。
更早的備份／隔離還原、fail-closed source disposition、手機／鍵盤／快取修正，逐次證據讀
`docs/deployment.md`、上述完整 commit 清單及以往優化手冊；歷次 run 不能當成今次新執行。

### 最新資料與歷史驗收的區別

- 最新平台批次 `data/sources/2026-09-26/mpf-fund-platform.json`，官方截至 2026-08-31。
- 2026-09-30 已保存正式驗收：451 類別／24 計劃／11 受託人，三年 **37 eligible／258 stale／156 missing**。
  295 observations 不等於 295 可排名；六月底來源仍過期。只有有原文的 N/A 才標官方 N/A。
- 2026-09-30 原驗收有永明 Conservative B 三年 2.84%、東亞 Industry Balanced 9.33%、Growth 14.73%，
  各截至六月底；Income 三年官方 N/A／頁 9，一年較新平台 2.58%；全部 40 BEA 配置及持倉曾線上讀回。
- **本次沒有重新完成這些 40 筆來源／API 內容驗收**。本次 Python 直接讀公開 API 遇 HTTP 403，
  不能把它說成健康检查通過或官方沒資料；當前完整健康程度／即時 counts 未核實。
  Pages／GitHub 部署狀態已由其他只讀 API 核實，與 liveness 是不同證據。
- 原件 SHA、backup ID、private R2 prefix、release tuple 及當時實際畫面在最新發布手冊／保留 JSON。
  今次沒有新 backup／restore／R2 read-back，也沒聲稱逐字核對全部 451 類別。

## 4. 未完成事項／優先次序

| 優先 | 具體下一步與收貨條件 |
| --- | --- |
| P1 DATA-01／02 | 逐受託人找最新官方目錄／期別，先 AIA、BEA、Fidelity golden cases；保存 URL、發現時間、PDF SHA／own date，完整抽取、獨立 candidate PR、三筆原文 seed；合資格數只按真實新日期增加 |
| P1 來源 reconciliation | 其他 226 筆舊 observations 尚未全部逐筆重核原文；不能靠下载 58／58 宣稱最新或全數正確；24 計劃缺口表見三年手冊 |
| P1 OPS-02 | 一次請求固定 publication snapshot，避免 middleware／route 分別讀 current publication 在切換時不一致；需要並行發布測试 body／headers／cache，不在交接時重構 |
| P1 OPS-01／04 | 正式可用性／失效來源／時效漂移監察及 SLO；核實通知管道與所有 required checks／rulesets，必要時再提出具體設定方案待使用者批准 |
| P2 DATA-03／04、API-01／02 | 官方名冊每日／停辦差異、FER own period 更全面結構化；搜尋 P95／D1 用量先量度；再談 FTS、路由／shared helper／runtime payload contract |
| P2 WEB／PERF／A11Y／CI | route SEO／canonical／sitemap、香港手機 field CWV、讀屏／真機／放大抽查、高危 helper 與 CODEOWNERS 同步；不可把本機 lab 當全站認證 |
| P2 OPS-03 | 既有 isolated restore 有紀錄；協調 D1＋Worker＋Pages 的完整 release rollback rehearsal／SLO 與容量成本 review 仍需依部署手冊核實，不自行改 retention 或演練 production |
| P3 PRODUCT | 三年累積回報若有可靠官方來源可作獨立指標；不得反算官方未披露的年率化。完整時序／任意期間回測與 ±2pp 試用驗證另作產品決策 |

完整技術／來源／逐任務收貨條件：`reviews/2026-09-30-full-process-and-design-review.md`、
`reviews/2026-09-30-three-year-gap-resolution.md`、`plans/`、`specs/` 及文件索引。
早期 P1 永明／BEA 修復已發布，舊手冊保留的「待修復」不能再次當作目前待辦。

## 5. 已知 bug／風險及不確定

**已驗證**：三年時效覆蓋不足；manifest 不是新期別 discovery；14 项平台 fee anomaly／6 類別的
`needs_review` 由精確 blob disposition 處理，不是清空異常。`/search` 仍全批 JSON 篩選。
沒有完整連續價格序列；不能造 daily trend。root `check` 包含 shell suite，E2E 另跑。

**推測／待重現**：跨 publication 切換可能造成 middleware／route snapshot 不一致，先前 code review 已列風險，
本次沒有模擬正式並行發布；更大資料量可能需要 FTS，未量測前不是已證明瓶頸。

**未核實**：Cloudflare 全部 DNS／WAF／Access／token scopes／R2 lifecycle／D1 現況，GitHub環境 gate 的實際 reviewer／branch policy，
Zo／Claude 登入與安裝、最新來源月份、全站 live health／field CWV／完整讀屏、任意外部 webhook。

Cloudflare Pages upload metadata 另顯示 `commit_dirty=true`。release marker／SHA／stage success 已核實，
但該旗標的具體來源本次未核實，不能宣稱逐個 bundle bytes 都已與乾淨 checkout 重驗。

## 6. 未同步檔案及保存

主 checkout 接手前乾淨；本輪只新增／更新文件與保存證據，没有新網站 code／data 修改。
15 個 checkout 另盤點出 **301 個 staged／modified／untracked entries**，14 個目錄有差異或本機 commit；
其中本機不可達 origin refs 的 commit 共 10 個。詳細路徑及分類不可用一句「全已 push」代替：

- `handoff/archive/local-repository-status.json`：所有 checkout branch／HEAD／status，含 12 個 dirty checkout。
- `handoff/archive/local-worktree-files.json`：全部 301 個檔案及 SHA／bytes，保留／排除方法；非主要 checkout 未被 reset／清理。
- `handoff/archive/local-worktrees/`：安全 source 差異、staged patch、本機 commit patch及 untracked scripts／migration
  保存至本機 archive commit `78e84da4a24e848fa278b129089f2728e33d8d4e` 及 ZIP，**沒有推到公開 GitHub，也沒有合入 live code**。21 個變動檔與 main 忽略 CRLF 相同；其餘需語義核對。
- 主要舊目錄：`work/KWMPF` 246 entries、`current-main-clean` 5、`work/kwmpf-followup-20260929` 7、
  `work/kwmpf-meth04-transparency` 12、`work/kwmpf-meth04-clean` 3；其他完整清單見 JSON。
- 不推送的 SQLite／WAL／SHM／pyc及暫存輸出仍留在清單的精確原路徑；需要時經批准以私有檔案方式傳送，
  **不要把整個 work 目錄上傳 GitHub**。本機 `.tmp-*` 忽略研究脚本亦有索引，不能假稱已全同步。
- 前一次正式網站 source／candidate／code 已在 GitHub main；其他舊 commit 不在現在 remote branch 不證明以前從未 push。
  原 `.zip`、PDF binary、runner downloaded artifact、第三方 skills／本機工具不盲目重新公開。
- 266 個本機附件的完整原路徑／SHA／bytes另列 `handoff/archive/local-attachments-inventory.json`；
  未在 branch 的 binary 依清單及保存區的私有傳送方法處理，不聲稱已送到 Zo。

全部已檢查舊手冊 32 份原樣保存在 ZIP 的 `private-preservation/docs/handoff/archive/previous-handbooks/`（包括 9 月 25 原接手手冊、
433KB 優化總手冊、skills 方案、三年／修復／發布及驗證 JSON），原路徑與 SHA見 manifest。
GitHub取得code與本機私有／暫存交付是两件事；無法取得的部分不能寫「已交接到 Zo」。

## 7. 實際指令與結果

本次核實：`git rev-parse`／`status --porcelain`／`branch -avv`／`remote -v`／`log`／`worktree list`／
`fetch --no-tags origin`、GitHub branch／commit／PR／jobs GET、Cloudflare Pages／Worker／Build triggers GET；
347 個原 tracked files 及 32 份外部文字文件模式掃描無匹配秘密，ignored credential-like paths 未發現。
它是有限模式檢查，不是秘密／個人資料的全歷史認證；未執行歷史 ZIP內脚本。

| 本次本機指令 | 結果 |
| --- | --- |
| `bun --version` | 成功，1.3.11；使用本機既有 Bun binary，不全局安裝 |
| `bun run typecheck` | exit 1；四 workspace `tsc` command not found，檢查未開始 |
| `bun run test` | exit 1；Web／API／coverage `vitest` command not found，測試未開始，不是 assertions 失敗 |
| `bun run build` | exit 1；`vite`／`wrangler`／`tsc` command not found，bundle 未開始 |
| `bun install --frozen-lockfile`、`bun run check`、`bun run e2e`／publication-seed | **本次本機未執行**；沒有為交接改 dependency／lockfile 或取得 secrets |
| Python公開 API GET | HTTP 403；本次 API health／counts 沒重新驗證 |
| `node node_modules/prettier/bin/prettier.cjs --check AGENTS.md CLAUDE.md README.md` | 成功；僅入口 Markdown 格式檢查，不是網站測試；repo 本身排除 docs format check |

本次文件核對亦確認本分支 8 份入口／摘要沒有壞連結或模式匹配秘密，application／deployment path diff 為空。
歷史附件 32 份 SHA在本機保存前一致，`.gitattributes` 只對本機 archive branch 保留原 bytes；公開分支沒有該檔案或整批 payload。

根目錄 `node_modules` 是指向較舊 `work/KWMPF/node_modules` 的 Windows junction；其 CLI／workspace shim
不足以執行標准指令。不能把歷史 333／115／80／66 成績當成今次實跑。
在 Zo 的新 clone 應用 packageManager 指定版本執行 frozen install，確保 Node／Bash／Python 3／Chromium再驗。
本次原 logs及 commands JSON收在 `handoff/verification/`；環境路徑不等於應搬到Linux的依賴。

**本次重讀 GitHub 已完成結果**：main CI #813 / run `36726494268` 的
`bun install --frozen-lockfile` 與 `bun run check` steps success；main E2E／high-risk 是 skipped。
PR #358 CI #808 / `36719163141`、#359 CI #810 / `36720125609` 的 verify、high-risk、
Playwright、最新 publication-seed 真實 steps success。run #28 的 migration／seed／Worker／Pages／
smoke／release tuple steps success；失敗後復原 steps skipped。這是已有 cloud runs，不是本次另跑。

## 8. 正式部署觸發：已核實與未核實

**已核實 repo**：production workflow只有 `workflow_dispatch`，需 `main`、`deploy-production` 確認、
同 exact SHA main CI success、匹配來源／report／disposition、production environment。
push `main` 只觸发 CI；候選refresh與raw R2 archive不等於production deploy。還原／改域名／backup另有 workflow。

**已核實 Cloudflare API**：兩 Pages project `source=null`、`production_branch=main`；
兩個 KWMPF Worker Build trigger 清單為空。功能分支 push不會經這些已核實路徑自動正式發布。
沒有自行修改此設定。最新 Pages deployment 是既有 9 月 30 日 #28，不是交接造成。

**未核實**：GitHub environment API本次connector拒絕；實際 reviewer及所有 branch rules不能由 YAML 的 environment 猜。
任意外部 webhook／非本repo手動操作未全面核實。若新環境發現其他部署接入，先停 push重新查。

## 9. Claude 接手頭三個具體步驟

1. 用使用者收到的完整 **repo／branch／final SHA** clone，不是舊 `main`／9月25ZIP：
   `git clone --branch docs/claude-handoff-20261001-safe https://github.com/Kirkwongcn/KWMPF.git`。
   `cd KWMPF`；`git rev-parse HEAD`、`git status --short`、`git remote -v`，與最終回執對照；
   開啟 CLAUDE→AGENTS→HANDOFF→PROJECT_MAP→DECISIONS→文件索引，遇 import不能讀就手動開同repo根AGENTS。
2. 先核實 Zo tools，Bun 1.3.11、Node、可用 POSIX Bash／Python；`bun install --frozen-lockfile`、
   `bun run check`，在需要時依 Playwright config 安裝 Chromium再 `bun run e2e`；全部本機，不帶 Cloudflare secrets。
   最新候選驗收必須指定 `2026-09-26/mpf-fund-platform.json` 與 `2026-09-30-...candidate.json`，
   用本機 D1／三筆原文，不靠預設舊 fixture；失敗記錄原因，不偷偷改 lockfile。
3. 先從 DATA-01／02／來源 reconciliation 的 24 計劃清單建立可重現 baseline；
   查最新官方期別、保留源PDF hash／各自日期，與 37／258／156 的歷史基線分開。
   若使用者未另授權功能開發，先交出資料核對／技術方案；不要直接套舊 archive patch、merge或deploy。

## 10. 需要使用者決定

- 完成交接後是否恢復新增功能，以及 DATA-01／02、snapshot consistency、監察／保護設定的先後。
- 正式監察通知管道與 SLO、ruleset／Cloudflare設定調整：須有具體可審方案及批准。
- 三年累積回報是否獨立新增、完整時序來源／權利是否可接受；目前不混入年率化。
- Zo若需要私有 PDF／R2／D1資料，採甚麼私有傳送及權限；不能從 public repo拿到所有私有原件。
- 本輪具體 `kwmpf-handoff` 私有 bucket／交接包上傳方案尚待批准；新 LLM 需獨立授權，NAS稍後設定。
- 每一次合併正式分支／改Cloudflare／production deploy／restore仍須新批准；本次交接授權不涵蓋這些操作。

未聲稱已登入 Zo、Claude 已讀到文檔，或本次 Cloudflare 已部署。
