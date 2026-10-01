# Claude Code → Codex 回交（填寫版，2026-10-01）

依 [RETURN_TO_CODEX_TEMPLATE](RETURN_TO_CODEX_TEMPLATE.md)。詳細證據讀 [Claude 檢查報告](../reviews/claude-review-2026-10-01.md)。
本輪只做檢查、重現及方案；**沒有網站修復、資料候選修改、合併、部署、workflow dispatch／批准、Cloudflare／R2 寫入**。

## A. 執行與版本

| 項目 | 結果／證據 |
| --- | --- |
| 更新時間／時區 | 2026-10-01 17:35 Asia/Hong_Kong（UTC 09:35） |
| 執行平台／實際工作目錄 | Claude Code on the web，Anthropic 管理的 Linux 雲端容器；`/home/user/KWMPF`。不是 Zo、不是 Windows、不是 Codex Cloud |
| Repository URL | https://github.com/Kirkwongcn/KWMPF.git |
| 收到的接手branch／exact SHA | `docs/claude-handoff-20261001-safe` @ `2e711533cd19a4c002b7d1b47f0cb80d548f947b`（遠端與基線一致，無較新工作） |
| 檢查／報告branch | `claude/brave-cerf-17etdq`（由 `2e71153` 建立） |
| 最後完整commit SHA | 由使用者收到的最終回覆／`git rev-parse origin/claude/brave-cerf-17etdq` 確認；本文件不自引 |
| GitHub遠端ref／SHA／核對時間 | push 後核對，見最終回覆 |
| 已commit且已push | `docs/reviews/claude-review-2026-10-01.md`、`docs/handoff/CLAUDE_RETURN.md`、`docs/reviews/evidence/claude-2026-10-01/`（fresh.ts、ops02-repro.ts、ui-audit.mjs、ui-audit-summary.json）、`docs/HANDOFF.md`、`docs/handoff/DOCUMENT_INDEX.md` |
| 已commit未push | 沒有（以最終回覆為準） |
| modified／staged／untracked／ignored待交付 | repo 內沒有；`bun run check` 產生的 `scripts/__pycache__/` 已刪除。只在本環境的 logs／截圖見 §E |
| PR URL／狀態／CI exact SHA | 沒有建立 PR；功能分支 push 不觸發 CI（`ci.yml` 只響應 PR 及 push main） |
| 使用的工具／skills／固定版本 | Bun 1.3.11（npm `@oven/bun-linux-x64@1.3.11`）、Node 22.22.0、Python 3.11.15、Git 2.43.0、Playwright 1.57.0＋Chromium 141.0.7390.37（rev 1194 對應 1200）、poppler、jq。impeccable／github-actions-efficiency／web-perf 等 skill **本環境沒有**，未執行；以人手 review＋腳本代替 |

## B. 本輪實際完成

- 核對接手版本、遠端分支差異、open PR（0）、最近 workflow runs（只讀 GitHub API）。
- 固定版本 frozen install、`bun run check`（全部通過）、publication-seed（最新 source＋overlay 通過，37／258）、E2E 66/66（瀏覽器版本差異已注明）。
- 以 repo 函數及候選重新計算時效與 24 計劃三年缺口；三筆基金 27 欄位 platform／overlay→API 比對。
- 搜尋 47 個邊界／中文案例；OPS-02 以真 app＋假 D1 確定性重現；14 routes × 2 裝置 lab 可及性檢查及截圖。
- 撰寫報告與方案。**沒有**任何網站修改或發布。

## C. 發現、風險及下一步（摘要；完整表見報告 §3）

| ID／優先級 | 狀態 | 問題／影響 | 重現／評估日 | 檔案行號 | 建議／收貨條件 | 需使用者決定 |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 P0 | 已驗證 | 1／5／10 年回報 10-16 起過期；三年合資格 37→14（10-30）→0（11-30），之後正式 deploy smoke 必失敗 | `fresh.ts`，UTC 2026-10-01 | `freshness.ts:31-56`、`deploy-production.yml:267` | 10-16 前新平台批次發布；10-30 前三年新期別 | 發布時程；smoke「三年 >0」語義 |
| F-02 P1 | 已驗證 | CI publication-seed 對 code PR 回落到 2026-08-13 舊 overlay，與 production 不一致 | 空 env → 23/188；最新 → 37/258 | `ci.yml:180`、`e2e-serve-api.sh:9` | 共用最新 candidate 解析＋測試 | 否（可直接排入修復） |
| F-03 P1 | 已驗證（code） | middleware 與 route 各讀 current publication，header／ETag／cache key 與 body 可屬不同 snapshot；回滾時 cache 可送錯 body | `ops02-repro.ts` | `caching.ts:99-150`、`index.ts` 各 route | 單一 bound snapshot＋並行測試 | 高危路徑覆核 |
| F-04 P1 | 已驗證 | 「三筆原文核對」只核 JSON URL／日期／標籤，不核數值或 PDF | 讀腳本 | `check-publication-seed.sh:72-127` | 真正原文抽值腳本 | 否 |
| F-05 P1 | 已驗證 | 中文搜尋大量 0 結果（東亞、恒生、中銀、海通、股票、債券、香港…） | 本機 API | `search.ts:2-16` | 中文名稱來源＋別名＋測試 | 中文名稱來源選擇 |
| F-06 P2 | 已驗證 | 比較頁把官方 N/A 顯示為缺資料；過期值顯示「未取得」 | 讀 code | `FundComparePage.tsx:109-142` | 新狀態＋測試 | 否 |
| F-07 P2 | 已驗證機制／未核實原文 | `Number()` 去掉官方尾 0（如 0.90→0.9） | 讀 code | `platform-parser.ts` | 保存原字串或明文接受 | 是 |
| F-08 P2 | 已驗證 | UTC 評估時間點在 middleware／route 不一致 | 讀 code | `caching.ts:100`、`index.ts:1019` | 單一 evaluatedAt | 否 |
| F-09 P2 | 已驗證／推測 | 搜尋每次讀 ~2 MB 全部 payload；無正式 P95 | 本機 42–59 ms | `index.ts:262-277` | 先量度再索引 | 否 |
| F-10 P2 | 已驗證 | 沒有排程監察／時效告警 | workflow 清單 | `.github/workflows/` | 每日只讀 probe | 通知管道 |
| F-11 P2 | 已驗證 | Archive source R2 run 自 09-29 `waiting`，每週新增待批 run；備份排程延遲 6 小時 | GitHub API | `archive-source-snapshot-r2.yml` | 觸發／批准政策 | 是（不由 Claude 批准） |
| F-12 P3 | 已驗證 | 無 sitemap／canonical、soft 404、preconnect 寫死正式 API | Playwright／讀 code | `index.html:6-10`、`_redirects:17` | SEO 小修 | 否 |
| F-13 P3 | 已驗證 | 雜項（seed log 標籤、pycache、桌面滑動提示、頁碼邊界、staging snapshotId） | 見報告 | 見報告 | 小修 | 否 |
| F-14 P1 | 未核實 | 三年新期別 discovery 未能連線官方網站 | egress 403 | – | 允許官方網域後逐受託人記錄 | 環境網絡設定 |
| F-15 P1 | 未核實 | 正式網站健康、Cloudflare 設定、environment reviewers／branch protection | egress 封鎖 | – | 有權限只讀核對 | 是 |

歷史 37／258／156 是 2026-09-30 基線；本次以 UTC 2026-10-01、candidate `2026-09-30-…`、本機 seed 重新計算，結果同為 37／258／156（不是正式 API 數字）。

## D. 真正跑過的指令

| 指令 | HEAD／來源／overlay／UTC評估日 | exit code | 通過／失敗／未開始／未執行 | 原因／限制 | 證據位置／SHA |
| --- | --- | --- | --- | --- | --- |
| 工具／frozen install（`scripts/prepare-cloud-workspace.sh`） | `2e71153` | 0 | 通過 | – | scratch `install.log` `a5ebd16d…` |
| R2 index／archive／逐檔／bundles（2026-10-01 補做，見下方補充） | `24c19a9`；固定 index `d17b0602…`；UTC 12:41 | 0 | 通過：8,443 路徑／3,744 blobs／9 archives；4 bundles verify okay，16 個 checkout HEAD 可達 | 首次因 `R2_ENDPOINT` 佔位值在請求前停止；修正環境後重跑 | 容器 `restore.log` `7f22f8b6…`、`RESTORATION_RECEIPT.json` `78d634c4…` |
| `bun run check` | `2e71153` | 0 | 通過（333＋80＋115 tests；build dry-run） | – | scratch `check.log` `c3e567ce…` |
| E2E 第一次 | 最新 source／overlay；09:2xZ | 1 | 未開始 | 缺 Chromium rev 1200 | `e2e-latest.log` `59502a26…` |
| E2E 第二次 | `2026-09-26` source＋`2026-09-30` overlay；09:23Z | 0 | 通過 66/66 | Chromium 141 代替 143 | `e2e-latest2.log` `69057e22…` |
| 最新 publication seed | 同上；09:21Z | 0 | 通過（37／258；3 筆 provenance） | 只核 JSON，不是 PDF 原文（F-04） | `seed.log` `56a87716…` |
| CI 模擬 publication seed（空 overlay） | 同 source；舊 08-13 overlay | 0 | 通過（23／188）＝證明 F-02 | – | `seed-ci-empty-overlay.log` `1b7a2ba7…` |
| 三筆原文核對 | – | – | 未執行 | 無 PDF／官方網站存取 | – |
| 其他只讀／UI／效能量測 | 本機 lab | 0 | 完成 lab 檢查；無 field CWV／讀屏／真機 | 工具與網絡限制 | `docs/reviews/evidence/claude-2026-10-01/` |

## E. 可攜證據及未同步項目

| 類型 | GitHub path或private R2 object key | bytes／SHA-256 | 實際取得／讀回 | 未同步原因及安全傳遞方式 |
| --- | --- | --- | --- | --- |
| 檢查報告／回交文件 | `docs/reviews/claude-review-2026-10-01.md`、本文件、`docs/reviews/evidence/claude-2026-10-01/*` | 見 Git blob | 已 commit／push（見最終回覆） | – |
| 新PDF／HTML／截圖／私人logs | session scratch：logs、`shots/*.png`（28）、`api-state/`、`web-dist/` | 見報告 §2 | 只在本容器 | 不含秘密；如需保存，使用者批准後上傳私人 R2，或在新環境按報告指令重跑 |
| 原R2 preservation index／archives | `independence/2026-10-01/snapshot-20261001-153225/preservation-index.json` 及同 prefix `local-preservation-01..08.zip`、`handoffs/2026-10-01/a5b5658…/handoff.zip` | index 2976331／`d17b0602…720cb72`；其餘見 index | **已取得並逐件核對**（2026-10-01 UTC 12:41） | 還原於容器 `/home/user/kwmpf-private`（926 MB），私人內容不入 Git；容器回收即消失，需要時以同一固定 index 重做 |

## F. 批准／未核實／回到Codex Cloud

- 使用者已批准的操作及範圍：本輪只讀檢查、隔離安裝／測試、在安全功能分支保存非敏感報告。沒有其他新批准。
- 尚待決定：修復範圍及次序（報告 §5）；F-01 發布時程與 smoke 語義；F-07 原字串政策；F-10 通知管道；F-11 waiting run 處理；是否提供官方網域網絡存取以補做 F-14／F-15／原文核對（R2 認證已提供，還原已完成；token 權限範圍未核實）。
- GitHub／Cloudflare部署觸發：已讀全部 13 個 workflow，push 功能分支不觸發任何 workflow；Cloudflare Builds／Pages Git 連結本次未核實。
- 是否完全靠 GitHub/R2 重建：GitHub 部分是（code、依賴、測試均由 clone＋lockfile 重建）；R2 部分已於 2026-10-01 補做：固定 index 取回、逐件／逐檔／bundles 核對及同容器 frozen install 通過；`independence-current.json` 已讀並與固定 index 相符；pointer 指定的 final manifest／文件包未取回（自動權限審查拒絕）；保存 commits／未提交檔案已與 GitHub 比對（見 HANDOFF 最新節），餘 50 個過時 tracked 修改未逐檔語義核對。
- Codex 頭三步：(1) 核對 `claude/brave-cerf-17etdq` 最終 SHA／diff 只含文件與 evidence；(2) 讀報告 §3／§5，優先處理 F-01 時程（10-16）及 F-02；(3) 在使用者確認範圍後，在可連官方網域且有只讀 R2 的環境補做 F-14／原文核對。
