# KWMPF → Claude Code 即時交接

## 最新：Claude 雲端 R2 還原完成（2026-10-01 20:42 香港）

Claude Code（Anthropic 雲端 Linux 容器，`/home/user/KWMPF`）由 `claude/eager-hawking-a491zc` @ `24c19a9a0684bd4fcde39edaba69ea742fa3363b` 接續，工作分支 `claude/relaxed-goldberg-5ytvfk`；最後 SHA 以 GitHub 該分支為準，本檔不自引。
**已驗證**：環境設定提供 `R2_ENDPOINT`／`R2_ACCESS_KEY_ID`／`R2_SECRET_ACCESS_KEY`（值不入 Git／日誌；token 是否只讀／只限此 bucket **未核實**，本輪只發 GET）。以固定 index（2976331 bytes／`d17b0602…720cb72`）執行 `scripts/restore-private-handoff.py`，exit 0：index、舊基底 ZIP、8 份補充 ZIP 逐件 SHA／bytes 相符；8,443 路徑、3,744 blobs、9 archives 逐檔核對並取出至 repo 外私人位置 `/home/user/kwmpf-private`（926 MB，不入 Git）。
4 份 Git bundles SHA／bytes 相符，`git bundle verify` 全 okay，fetch 入空白 bare repo 後 16 個保存 checkout HEAD 全部可達。同容器以固定 Bun 1.3.11（npm `@oven/bun-linux-x64`；預裝 1.3.14 被腳本拒絕）執行 `scripts/prepare-cloud-workspace.sh`，frozen install exit 0。
**首次嘗試失敗**：上一個 session 的 `R2_ENDPOINT` 是佔位值，腳本在任何請求前停止；使用者修正環境設定後重跑成功。
**Pointer（已驗證）**：其後單件 GET `independence-current.json`（1896 bytes／`45833234…85d5d861`）：指向 branch `docs/claude-handoff-20261001-safe` @ `2e71153`，其 `index` 欄 key／bytes／SHA 與上述固定 index 完全相同。pointer 指定的 final `manifest.json`（8439／`20921118…`）及文件包 `handoff.zip`（3398155／`857c864a…`）**未取回**：該下載被本環境自動權限審查拒絕，沒有改用其他方式。
**保存內容與 GitHub 比對（已驗證，只在私人區分析，沒有套用）**：4 份 bundles 共 24 個 commit 不在 GitHub 任何分支。8 個 patch 與 main 相同；15 個的檔案內容已在 main 歷史出現，或殘餘檔案在 main 已有更新版本（squash 前版本，已被 #354／#357／#358／#359／#360 取代）；`78e84da` 是刻意只留私人區的歷史保存 commit。
各 checkout 未提交項目展開後共 1,165 檔：26 個內容已在 main；11 個在其他 GitHub 分支；1,074 個不在 GitHub，全是 `work/` 暫存（`returns-refresh-2026-09-26` 851、`pr269-format` 201、本機 D1／SQLite seed 輸出 22）；4 個按設計排除（pyc、poppler.zip）；另 **50 個 tracked 檔案修改**不在 GitHub 任何位置——全部基於比 main 舊的 HEAD，且全部 50 個檔案 main 其後均已再修改，屬過時分支上的修改。**其後已逐檔核對**（[報告](reviews/2026-10-01-preserved-worktree-review.md)）：47 檔已被 main 取代；沒有程式碼／測試／workflow／資料需搬回；發現兩項 main 文件問題——P-01 `docs/deployment.md:46` 稱部署重跑 check／E2E，實際重用同 SHA CI 且 E2E 只在 PR；P-02 ADR-0001／v1 規格仍寫自動發布及每日預算排名。使用者批准後已開獨立純文件 PR [Kirkwongcn/KWMPF#361](https://github.com/Kirkwongcn/KWMPF/pull/361)（branch `claude/relaxed-goldberg-5ytvfk-docs-deploy-reality`，由 main `6a593db` 建立；ADR 0001 加實作狀態補記而非 superseding ADR）；未合併、未部署。依規則不批次套回。
**未核實／未執行**：網站 tests／build 本輪未重跑；沒有 R2 寫入、合併、部署或 Cloudflare 變更。私人還原只在本容器，容器回收即消失，需要時按同一指令重做。
詳見 [CLAUDE_RETURN](handoff/CLAUDE_RETURN.md) §D／§E 及 [LOCAL_INDEPENDENCE](LOCAL_INDEPENDENCE.md)。

## 最新：Claude Code 檢查完成，待使用者檢視（2026-10-01 17:35 香港）

Claude Code（Anthropic 雲端 Linux 容器，`/home/user/KWMPF`）由接手基線 `2e711533cd19a4c002b7d1b47f0cb80d548f947b` 建立 `claude/brave-cerf-17etdq`，只保存文件及非敏感 evidence。報告：[claude-review-2026-10-01](reviews/claude-review-2026-10-01.md)；回交：[CLAUDE_RETURN](handoff/CLAUDE_RETURN.md)。
**本次實跑**：Bun 1.3.11 frozen install、`bun run check` 通過（333／80／115）、最新 publication-seed 通過（37 合資格／258 過期）、E2E 66/66（Chromium 141 代替 rev 1200，已注明）。**未執行**：R2 還原（無 `R2_*` 認證）、官方網站／正式網站讀取（環境 egress 拒絕）、PDF 原文核對。
**最急**：一年等平台回報 2026-10-16（UTC）起全數過期；三年合資格 10-30 降至 14、11-30 降至 0，之後 production smoke 會令任何發布失敗（F-01）。CI publication-seed 對 code PR 使用 2026-08-13 舊 overlay（F-02）；OPS-02 已重現（F-03）。
沒有修改網站 code／資料、合併、部署、dispatch／批准 workflow、改 Cloudflare 或寫 R2。修復範圍待使用者確認後才回 Codex Cloud。

## 最新工作安排：Claude先檢查，再回Codex Cloud（2026-10-01）

使用者明確決定先讓Claude Code接手檢查；Codex Cloud環境／新client憑證及新雲端驗收任務的建立均延後，待Claude完成工作後再確認。沒有替Claude或Codex建立／發送新任務。
閱讀 [CLAUDE_REVIEW_BRIEF](CLAUDE_REVIEW_BRIEF.md)，檢查後使用 [回交模板](handoff/RETURN_TO_CODEX_TEMPLATE.md)；模板是待填文件，不能当成檢查已完成。

**已驗證起始狀態**：此分支`docs/claude-handoff-20261001-safe`／origin同名分支，HEAD `a928b8e383446e34034173de0770cc38a5b14d21`；本輪開始git status乾淨。本輪只有文件及非敏感儲存狀態修訂；最後SHA／push／R2文件包由外部新回執及`independence-current.json`指定。
2026-10-01 16:51重新核對main及Pages仍為下節基線；兩個Worker以immutable tag查Build triggers均空、Pages API無source；repo CI只PR/push main、網站deploy manual。外部hooks／environment reviewer／branch policy仍未核實。

**Claude頭三步**：clone接手branch並核對使用者最後SHA；讀CLAUDE/AGENTS/檢查委託/PROJECT_MAP並記錄自己的平台及工具；以獨立已批准只讀R2認證取回index與原件，按固定版本安裝、分項檢查。沒有認證可先公開repo檢查，原文核對列未核實。
**回交**：檢查報告、實跑指令與結果、exact branch/commit/PR、待辦及優先級、已驗證／推測／未核實、所有未同步檔案和私人證據key/hash。使用者檢視後才回到Codex Cloud並決定修復範圍。
網站新增／重構仍暫停；未批准不merge main、改Cloudflare／remote D1或部署。本次整理沒有執行網站tests/build，沒有聲稱Claude已登入／收到／執行。

以下是有日期的保存及網站歷史checkpoint；新工作順序以本節為準。

## 本機獨立接手跟進（2026-10-01 16:23；以本節為最新保存狀態）

詳細重建/來源/驗收讀 [LOCAL_INDEPENDENCE](LOCAL_INDEPENDENCE.md)。

**已驗證**：使用者已批准本輪R2上傳。8份補充ZIP及index共394,359,318 bytes已寫入私有`kwmpf-handoff`，9件逐件GET下載核對SHA/bytes；另從R2下載舊基底ZIP，以遠端副本核對8,443路徑／3,744去重blobs／9個archives；4份Git bundles從遠端副本取出，在新的空repo驗證self-contained與refs通過。
包含原Downloads ZIP/手冊、16個checkout的相關檔案、官方PDF/XML、未提交差異、Git refs/reflogs、403個skills檔案。沒有傳credentials；工具快取及套件從lockfile重建。

**Git狀態checkpoint**：repo `https://github.com/Kirkwongcn/KWMPF.git`；功能branch `docs/claude-handoff-20261001-safe`／`origin/docs/claude-handoff-20261001-safe`；重建工具commit `1236b7a0304b7fe555402324e5b3c1f18f968105`及準備文件commit `ec0fe46033462992cab8279394547a91a3bd0cf1`均已核對在GitHub，本輪開始status乾淨。此完成紀錄另commit/push；**最後exact commit／push／文件包讀回以外部完成回執及R2 `independence-current.json`指定manifest為準**，文檔不能引用自己的最終SHA。
來源checkout `C:/Users/user/Documents/Codex/2026-09-26/kwmpf/work/kwmpf-review-redesign`只供provenance；不是新client必需路徑。舊checkout dirty檔案及私有refs只保存在R2，不能批次套回active repo或公開推送。

**部署核實**：main `6a593dba460b905badbfca9e9eac85a16318309e`、正式Pages id `48675d4f-4815-4f87-bb8f-b1f3aa5df51d`／commit `3f655960c620b019f245886d709283c0e1b67590`未變。CI只PR/push main；網站deploy只manual workflow_dispatch。以Worker immutable tag（不是script name）重新查兩個Workers Builds triggers，均空；Pages API無source欄位。舊name lookup的空回應本身不足作證，已補正。外部hooks、environment reviewers/branch policy、classic branch protection仍未核實。本輪沒有網站合併或部署。

**未完成／未核實**：executor仍是Windows；Codex Cloud環境只填草稿，未建立/保存；獨立只讀client、雲端還原及依賴安裝未執行；NAS未設定；其他LLM實際取得未驗收。網站測試/build **未執行**。一次Windows核對工具首次讀index因預設cp950失敗，改明確UTF-8後完整R2副本核對通過；不當作網站測試結果。

**Claude/Codex Cloud頭三步**：1. clone此功能branch並核對完成回執exact SHA，讀CLAUDE→AGENTS→本頁→PROJECT_MAP/DECISIONS；2. 配置已獨立批准的只讀R2認證及固定Bun1.3.11工具，frozen install；3. 按LOCAL_INDEPENDENCE pinned index下載到新的私人保存區，逐檔及空repo bundles驗證，記錄真正雲端工具/commit/安裝回執。不得merge/deploy或套舊patch。

**批准狀態（保存checkpoint）**：本輪420MB put-attempt預算內R2補充及完成記錄已批准；最新工作順序已改為Claude先檢查，Codex Cloud建立／新認證／新任務延後，不再把上一個環境批准提問視作正在執行的工作。
下面14:47/15:47或更早紀錄保留歷史；新補充已保存/下載核對，取代「本輪未上傳/部分binary只在本機」狀態。R2成功不等於完全雲端驗收。

---

更新：2026-10-01 14:47（Asia/Hong_Kong；網站驗收基線保留 00:55 證據，時效 API 使用 UTC 日界）。
任務：暫停新增功能與重構，核實並安全保存網站／資料／工作差異及接手文件。
今次按使用者明確批准建立私有交接 bucket，並上傳／讀回清單內附件（上傳上限 15 MB）；不合併、不 dispatch／批准網站部署。入口共用規則 [AGENTS](../AGENTS.md)，Claude 入口 [CLAUDE](../CLAUDE.md)。

## 本輪雲端儲存跟進（2026-10-01；已上傳及讀回，NAS 尚未設置）

使用者要求先安排 GitHub／Cloudflare，再更新交接。本段是較新的儲存紀錄；下列網站開發、來源及測試保留原來證據日期，不假稱本輪重跑。

**已驗證（2026-10-01 14:47 香港時間）**：GitHub repo `https://github.com/Kirkwongcn/KWMPF.git`，本機
`C:/Users/user/Documents/Codex/2026-09-26/kwmpf/work/kwmpf-review-redesign`；功能 branch
`docs/claude-handoff-20261001-safe`／`origin/docs/claude-handoff-20261001-safe`，上傳起始 HEAD `0e3a38ebb952869f72abd7c4d2b0ae782828bfc6` 已 push，工作目錄乾淨。
main 仍為 `6a593dba460b905badbfca9e9eac85a16318309e`，正式 Pages id `48675d4f-4815-4f87-bb8f-b1f3aa5df51d`、程式 SHA `3f655960c620b019f245886d709283c0e1b67590` 未变。
两個 Worker Builds triggers 空白，兩個 Pages 詳情沒有 source 欄位；CI 只在 PR／push main，網站部署仍 manual。classic main protection 曾回 403，實際狀態仍未核實。

**已完成**：私有 `kwmpf-handoff`，Standard／APAC、r2.dev 關閉、沒有 custom domain，完整物件不自動到期；只有預設七日中止未完成 multipart upload。
使用者已分別批准建立及清單內私有資料上傳／下載核對。原先自動批准審查拒絕已經該次明確批准解決，沒有繞過。
已保存原始 ZIP、新版 ZIP、五份入口文件、manifest、讀回報告與 `current.json`；API 物件清單 10 件、8619851 bytes，逐件下載長度／SHA-256 全相符。
初次完整 tuple 的 manifest：`handoffs/2026-10-01/0e3a38ebb952869f72abd7c4d2b0ae782828bfc6/manifest.json`。
五份独立入口文件取 exact Git blob bytes；早期 ZIP 的 repo/ 是 Windows CRLF 匯出，clone Git commit 才是 canonical，不能拿 ZIP 字節取代原始來源 blob／disposition。

| 已核對的保存包 | bytes | SHA-256 |
| --- | ---: | --- |
| 原始 `original-handoff.zip`（`2c08f15...`） | 4270131 | `57534ae6bcdecc80b25a44845b1b09a45dbd1c2b5109d859f3b475514bf73c8f` |
| 初次新版 `handoff.zip`（`0e3a38e...`） | 4289401 | `80c1fc19c55309077b2717c034612edbfad6301fc8e5e031b596d37e34802b5a` |

新版 454 entries／435 文字檔有限敏感模式检查無匹配，CRC 與逐檔 hash 相符，32 份舊手冊原始內容全保留。不是完整 credential history／全部私人資料認證。
詳見 [CLOUD_STATUS](handoff/CLOUD_STATUS.json)、[storage declaration](../config/storage.json)、[雲端儲存手冊](CLOUD_STORAGE.md)。

**最終版本定位**：本節是初次成功讀回的有日期 checkpoint。把本輪完成文件另 commit／push、產生最終 ZIP，且全數讀回後才再次更新 `current.json`。
文件不能包含自己的最終 Git SHA 或 ZIP SHA；**交接使用者收到的 final commit、R2 `current.json` 及其指定 manifest，不能以本節初次 tuple 覆蓋最新版本**。
完整最終回執／本機可交予其他 LLM 的檔案：
`C:/Users/user/Documents/Codex/2026-09-26/kwmpf/outputs/cloud-storage-handoff-2026-10-01-final/HANDOFF_RECEIPT.json`；
最終 ZIP 同目錄 `KWMPF-Cloud-Handoff-2026-10-01-final.zip`。初始及中間版本保留原 SHA，不覆寫。

**未核實／尚未設置**：沒有新增 client token、公開 Worker／MCP、NAS、自動備份或其他項目的儲存。
另一個 LLM 仍需独立認證，Codex 的既有 OAuth 不會跟文件轉移。使用者提供 NAS ASUSTOR AS5402T／HDD／RAID 後 12 TB；不是本次登入核實，ADM／檔案系統／空閒容量／網絡仍未知。
Codex Cloud 環境由使用者報稱已設定；本次 executor 仍在 Windows 本機，沒有任務搬到雲端的證據。
原件 PDF／D1 SQL／SQLite／部分大型暫存仍依 inventory 或既有 production/staging R2 另取，沒有把本機約 1.78 GB 全搬上雲。
本輪只做文件、JSON、有限秘密檢查、ZIP／讀回 integrity；網站測試／build **未執行**。

## 保存邊界（本次實際狀態）

公開 GitHub 接手分支保存五份入口文件、README、文件索引、非敏感狀態摘要及雲端儲存設定宣告／手冊。
自動批准審查拒絕將整批 production evidence／歷史報告／本機 patch 公開推送，理由是可能含敏感內容，未有明確公開輸出批准。
因此本機原分支 `docs/claude-handoff-20261001` 的保存 commit `78e84da4a24e848fa278b129089f2728e33d8d4e` **未 push**；没有换工具繞過。
已安全保存的差異／手冊另在交接 ZIP 的 `private-preservation/`，已按批准存入私有 R2；未打包的原件另依 inventory 取得。Zip `repo/` 是公開分支的完整網站 snapshot，兩部分不可互相覆蓋。
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

**已核實 Cloudflare API**：兩 Pages project 無 source 欄位（不是明確 null）、`production_branch=main`；
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
- `kwmpf-handoff` 已按批准建立；私有交接包及入口文件上傳／讀回需明確資料傳送批准。新 LLM 需獨立授權，NAS稍後設定。
- 每一次合併正式分支／改Cloudflare／production deploy／restore仍須新批准；本次交接授權不涵蓋這些操作。

未聲稱已登入 Zo、Claude 已讀到文檔，或本次 Cloudflare 已部署。
