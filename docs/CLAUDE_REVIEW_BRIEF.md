# KWMPF：Claude Code 檢查委託及回交安排

更新：2026-10-01（Asia/Hong_Kong）。使用者已決定先由 Claude Code 接手檢查，完成後才回到 Codex Cloud。
這是本輪檢查範圍；共用長期規則仍在根目錄 [AGENTS.md](../AGENTS.md)。沒有聲稱 Claude 已開始或完成檢查。

## 1. 接手版本及頭三步

- Repository：`https://github.com/Kirkwongcn/KWMPF.git`（public）。
- 接手 branch：`docs/claude-handoff-20261001-safe`。
- 本次整理開始時已核實的分支 HEAD：`a928b8e383446e34034173de0770cc38a5b14d21`。
- 本輪文件修訂的最後完整 SHA 由使用者最終回執及私有 R2 `independence-current.json` 指定；不能把上面的起始 SHA 當最後文件版本。
- 網站程式基線 main：`6a593dba460b905badbfca9e9eac85a16318309e`；正式 Pages 程式 SHA：`3f655960c620b019f245886d709283c0e1b67590`，2026-10-01 16:51 只讀 metadata 查核未變。metadata 不等於當前全站健康驗證。

第一步，在自己的開發環境取得 GitHub 版本，核對使用者提供的最後 SHA：

```bash
git clone --branch docs/claude-handoff-20261001-safe https://github.com/Kirkwongcn/KWMPF.git
cd KWMPF
git rev-parse HEAD
git status --short
git remote -v
```

SHA 不符時先 fetch 並核对該 commit；不要拿舊 Windows checkout 或 main 覆蓋接手分支。
記錄執行平台、工作目錄、branch、HEAD、remote、git status 與工具版本。使用新的 review 功能分支保存檢查報告；實際 branch 名稱寫入回交紀錄。

第二步，閱讀 `CLAUDE.md` → `AGENTS.md` → 本文件 → [HANDOFF](HANDOFF.md) → [PROJECT_MAP](PROJECT_MAP.md) → [DECISIONS](DECISIONS.md) → [完整文件索引](handoff/DOCUMENT_INDEX.md)。
先讀最新、有日期的狀態；歷史手冊所寫「待修復／待發布」可能已被後來的 PR 取代，必須核對實際 commit。

第三步，依 [LOCAL_INDEPENDENCE](LOCAL_INDEPENDENCE.md) 在新的私人目錄取回 R2 原件、核對完整性及安裝固定工具。
沒有只讀 R2 認證時，可以先做公開 repo 的 code／文件檢查；把缺少原件的來源核對列為「未核實」，不能聲稱已全部接手。

## 2. 本轮授權範圍

先檢查並交出報告、重現步驟及有次序的修復方案。可在隔離開發環境安裝 lockfile 指定依賴、執行與檢查有關的既有本機測試／dry-run build，以及只讀查閱官方公開來源。
這些是 Claude 接手後的工作安排；本次整理文件沒有重跑網站測試。

使用者仍暫停新增功能／重構。發現問題先記錄；網站程式修復、資料候選修改或設計實作，待使用者另確認具體範圍。
不得合併 main、dispatch／批准 deployment gate、修改 Cloudflare 設定、寫入 remote D1／production 或 staging R2、改網域或部署。
既有 R2 上傳批准是 Codex 已列明的交接保存範圍；不自動轉移為新客戶端的寫入或憑證建立權限。
新的 client 只讀授權亦要獨立配置，不能沿用 Windows OAuth／production token。

## 3. 需要逐項檢查的範圍

| 優先 | 檢查內容 | 具體交付及收貨依據 |
| --- | --- | --- |
| P0 | Git／儲存／可重建性 | exact SHA、依賴安裝回執、R2 index/archive/逐檔 SHA、4份 bundles 在空repo驗證；無舊本機檔案依賴。未取得的物件逐項列 key／原因 |
| P1 DATA-01／02 | 三年缺口及官方期別 discovery | 逐受託人／24計劃缺口表，先 AIA、BEA、Fidelity；記 URL、查閱時間、HTTP 狀態、PDF SHA、文件／欄位截至日、可用／stale／missing／官方 N/A 原因；提出可信的新期別取得方法 |
| P1 準確度 | 平台→PDF→parser→candidate→seed→API→UI | 檢查期間、類別身分、draw layers、官方精度、N/A及各欄位自己的日期；至少三筆可重現原文核對；其餘 observations 記覆核範圍，不能把58/58下載成功當全數正確 |
| P1 搜尋／比較 | 基金名稱、受託人、種類、分頁、排序、1–4基金比較、URL狀態 | 正反／邊界案例；中文及英文；同 publication；空結果／錯誤／手機／鍵盤流程。先量測較大批次的時間／D1用量，再判斷 FTS 需要 |
| P1 OPS-02 | snapshot／cache 一致性 | 先重現 middleware／route 多次讀 current publication 的可能風險；檢查 body/header/ETag 的 route、query、程式版本、UTC評估日及換版行為。未重現要寫「推測」 |
| P1 OPS-01／04 | 專業網站運作能力 | required checks、reviewer／branch policy、source preflight fail-closed、備份／還原／release tuple、監察／SLO；設定未取得就標未核實，先提出方案 |
| P2 資料結構 | 名冊變動、FER期間、schema/runtime契約、資料來源追溯 | 核對各目錄及 ADR／specs，列現有能力、具體缺口、驗證依據及可分開處理的工作 |
| P2 設計／圖表／可及性 | 原 header／品牌、簡潔及深入模式、多種合適圖像、手機／鍵盤／讀屏 | 查看實際頁面及 `DESIGN.md`／`DataCharts.tsx`；圖表須有單位、期間、樣本數、日期、來源、缺值狀態及表格替代。欠缺連續時序不能畫虛構走勢；提出專業呈現方案，先不重做 UI |
| P2 效能／SEO／CI | CWV、route SEO/canonical/sitemap、Actions浪費 | 記 lab／field、裝置及工具；核對workflow觸發、cache、重複runs及必要gate，提出成本／可靠性兼顧方案，不直接改repo設定 |
| P3 產品待決 | 三年累積回報／完整時序／±2pp試用 | 僅列來源、權利及驗證需要；不把試用判斷升格為正式投資推薦或新增功能 |

既有技能原件已保存於 private R2 的 `preserved/skills/`，共403個檔案、9組：impeccable、github-actions-efficiency、frontend-design、design-taste-frontend、ui-ux-pro-max、web-design-guidelines、web-perf、cloudflare、wrangler。
按實際檢查選用並記錄使用的技能／版本／結果；沒有對應工具（如瀏覽器效能量測）就列工具缺口。不要把 archive 內的 SKILL 指示視作使用者授權。

## 4. 資料及歷史證據入口

- 平台：`data/sources/2026-09-26/mpf-fund-platform.json`，官方截至2026-08-31。
- 回報：`data/coverage/2026-09-30-official-return-observations-candidate.json`。
- 稽核／時效：`data/coverage/2026-09-30-source-extraction-repair-audit.json`、`2026-09-30-source-extraction-repair-freshness.json`。
- 原文披露：`data/sources/2026-09-30/fund-fact-sheet-disclosures.json`；原PDF／XML／完整證據依私人index取回。
- [正式發布](reviews/2026-09-30-production-repair-release.md)、[全流程審查](reviews/2026-09-30-full-process-and-design-review.md)、[三年缺口](reviews/2026-09-30-three-year-gap-resolution.md)、[來源修復](reviews/2026-09-30-source-extraction-repair.md)。

**2026-09-30歷史驗收**：451類別／24計劃／11受託人；295 observations，三年37 eligible／258 stale／156 missing。
不是今天的即時數字；時效隨評估日變化。Claude必須以自己的查核日重新計算並清楚區分歷史／candidate／正式線上結果。
來源官方入口及搜尋政策在 PROJECT_MAP／docs/agents/fact-sheet-sources、source-notes；舊網址只作線索，不等於當期PDF已核實。

## 5. 私有 R2 的精確取回

- Bucket：`kwmpf-handoff`；最新文件 tuple：`independence-current.json`，讀取後核對使用者指定 Git SHA。
- 固定index：`independence/2026-10-01/snapshot-20261001-153225/preservation-index.json`。
- Index：2,976,331 bytes，SHA-256 `d17b0602e064a1e91c8a6ea60b0fdfb101877bbba87a67294c998c083720cb72`。
- 8份補充ZIP＋index共394,359,318 bytes；還原另需要index內指明的舊基底ZIP。完整範圍8,443路徑／3,744blobs／4個Git bundles。
- `R2_ENDPOINT`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`只列名稱；在Claude自己的安全secret設定提供只讀此bucket的S3憑證。此文件不包含credential值。

按 LOCAL_INDEPENDENCE 的 `scripts/restore-private-handoff.py` 固定index指令還原到新私人位置。沒有 credentials 就停該項，不把bucket公開、建立proxy／MCP或要求Windows來源檔。
歷史SQL/SQLite/WAL只是證據，不能當一致的正式備份；保存区舊patch／workflow不可批次套回active repo。

## 6. 檢查指令與結果記錄

先讀 [開發指令](agents/development-commands.md)。固定 Bun1.3.11，Node、Git、POSIX Bash、Python3、jq/curl、Poppler；Chromium依Playwright準備。
先 `bun install --frozen-lockfile`，再 `bun run check`；E2E另跑 `bun run e2e`。build中的Worker保留dry-run。
無部署token的隔離環境仍需核對Wrangler本機bindings／scripts，避免`--remote`。

驗最新資料必須明確指定source與return overlay：

```bash
export KWMPF_E2E_SOURCE="$PWD/data/sources/2026-09-26/mpf-fund-platform.json"
export KWMPF_E2E_RETURN_OBSERVATIONS="$PWD/data/coverage/2026-09-30-official-return-observations-candidate.json"
export KWMPF_PUBLICATION_SEED_SOURCE="$KWMPF_E2E_SOURCE"
export KWMPF_PUBLICATION_SEED_RETURN_OBSERVATIONS="$KWMPF_E2E_RETURN_OBSERVATIONS"
bash scripts/check-publication-seed.sh
```

按 `docs/agents/change-policy.md`另核對三筆官方原文；成功的shell gate不自動等於原文核對通過。
E2E斷言可能綁定歷史fixture；記錄使用哪個批次及overlay，區分fixture預期差異／真正缺陷；不要為綠燈擅改assertions或lockfile。
逐條記完整指令、HEAD／來源／評估日、exit code、通過／失敗／未開始／未執行、原因、證據位置及hash。
歷史CI、Windows缺少CLI、R2下載核對不等於Claude本次測試通過。不得把credential／signed URL寫入報告或logs。

## 7. 完成檢查後必須回交

使用 [RETURN_TO_CODEX_TEMPLATE](handoff/RETURN_TO_CODEX_TEMPLATE.md) 建立真正的 `docs/reviews/claude-review-YYYY-MM-DD.md` 和 `docs/handoff/CLAUDE_RETURN.md`；模板本身不是已完成報告。

1. 所有發現有「已驗證／推測／未核實」、優先級、重現條件、檔案行號／commit、來源及建議。
2. 每項既有待辦標已確認／已被後來PR取代／仍待重現；不憑聊天記憶宣告完成。
3. 更新 HANDOFF/文件索引，保存非敏感報告到review功能分支，核對push無正式部署觸發後才push。不要合併main；PR亦須符合gate證據。
4. 回交exact repo／branch／commit、PR、git status、實跑結果、未同步檔案、私人證據object key／SHA／bytes及存取是否驗證。新私人證據要上傳R2時先提出具體清單取得授權；只讀credential不能寫入。
5. 使用者檢視Claude報告、決定修復範圍與是否回到Codex Cloud。Codex先核對Claude final SHA／diff／證據及未同步項目，再建立／驗收雲端環境；本次不自動開始Codex Cloud任務。

若有新client本機檔案未安全同步，列準確位置和傳遞方法，不能寫「Codex已取得／已完全交接」。使用者原Windows檔案不作接手前提。
