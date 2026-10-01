# KWMPF

香港強積金計劃及基金比較網站。開始工作前先閱讀 `CONTEXT.md`、相關 ADR，以及
canonical implementation spec（`docs/specs/2026-08-08-hk-mpf-comparison-v1-implementation-spec.md`）。

本檔是路由索引及跨工具長期共用規則，細項在 `docs/agents/`。
本檔曾因 31 KB 被截斷而漏傳紅線；共用規則文件超過 10 KB 就拆分。

## 不可繞過的紅線

呢七條凌駕一切效率考慮。做唔到就報錯或者標示「官方未提供」，唔好估。

1. **唔可以靜默改寫官方數字。** 固定小數位、補 0、四捨五入、正規化標籤，
   全部係改寫。披露寫 `1.205%` 就係 `1.205%`。
2. **官方寫 `n.a.` 唔等於 0。** 一律走 `unavailableFields`，唔可以用另一個
   欄位（風險級別、基金種類）補位。
3. **抽唔到就明講，唔出局部資料。** 一張表有一行對唔上，整塊當官方未提供，
   並記低原因同代號（`unavailableKinds`）。
4. **配對唔做模糊比對。** 只做大小寫／引號／破折號正規化加契約聲明嘅前綴。
   同名兩個就報錯，唔可以隨便揀一個。
5. **唔可以拿另一隻基金嘅披露頂上。** 一個基金類別對多過一份披露要報錯。
6. **編輯判斷要標明。** 三桶資產歸類、比較組別都係編輯層，payload 寫
   `official: false`，顯示時要講明「非官方分類」。
7. **每個來源保留自己嘅截至日期。** 便覽比平台落後四至八個月，唔可以沿用
   平台嘅 `dataAsOf`，唔可以攞最舊嗰個冚全份。

## 主題索引

| 主題                                                        | 讀邊份                                   |
| ----------------------------------------------------------- | ---------------------------------------- |
| 改動流程、PR、覆核、部署、分支、E2E                         | `docs/agents/change-policy.md`           |
| 便覽連結、PDF 抽取、版面原語、覆蓋報告、缺口分類            | `docs/agents/fact-sheet-extraction.md`   |
| 便覽來源政策：受託人官網優先、來源檔結構                    | `docs/agents/fact-sheet-sources.md`      |
| 逐個受託人嘅實戰紀錄：反爬蟲、連結陷阱、換版缺口            | `docs/agents/fact-sheet-source-notes.md` |
| 三桶資產映射、比較組別平均                                  | `docs/agents/editorial-mapping.md`       |
| 官方平台欄位：DIS、規模、成立日期、年度回報、風險指標、費用 | `docs/agents/platform-fields.md`         |
| 過期政策（財政年結日）                                      | `docs/agents/freshness-policy.md`        |
| 非官方參考數據（Lipper 分類、對照表）                       | `docs/agents/reference-datasets.md`      |
| GitHub issues 用法、收貨條件、`needs-info` 處理             | `docs/agents/issue-tracker.md`           |
| Triage labels                                               | `docs/agents/triage-labels.md`           |
| Domain docs、ubiquitous language                            | `docs/agents/domain.md`                  |
| 部署步驟                                                    | `docs/deployment.md`                     |

## 已接受的決策（ADR）

規矩答「點做」，ADR 答「點解咁揀、否決過咩、幾時重審」。改到以下任何一項嘅
前提，要先更新對應 ADR，唔好靜靜哋喺規矩度改。

| ADR                                                         | 決策                                       |
| ----------------------------------------------------------- | ------------------------------------------ |
| `docs/adr/0001-github-cloudflare-deployment.md`             | GitHub + Cloudflare 部署架構               |
| `docs/adr/0002-publication-scoped-edge-caching.md`          | 以發布快照為界的邊緣快取                   |
| `docs/adr/0003-trustee-first-fact-sheet-sources.md`         | 便覽內容抓受託人官網、配對用積金局登記冊   |
| `docs/adr/0004-overlaid-text-layer-by-draw-order.md`        | 疊印文字層靠落筆次序分層，唔靠座標         |
| `docs/adr/0005-editorial-asset-class-buckets.md`            | 第一版只做股票／債券／現金及其他三桶       |
| `docs/adr/0006-fund-overview-freshness-by-fiscal-period.md` | 基金概覽過期按財政年結日及法定發布期限計算 |

## 跨工具共用工作規則

本檔供各協作者共用；`CLAUDE.md` 匯入本檔。即時狀態讀 `docs/HANDOFF.md`；技術及來源路徑讀
`docs/PROJECT_MAP.md`；已確定的決定讀 `docs/DECISIONS.md`。舊交接、計劃及 ADR
內的進度或自動發布構想屬歷史資料；不構成執行權限。

### 正式環境及保存工作

- **未經使用者對該次操作批准，不得合併正式分支或觸發正式部署。** 不得自行
  dispatch／批准正式環境 gate、改 Cloudflare 設定、執行 remote D1／R2 mutation、
  移動正式網域或復原正式資料庫。過往發布的批准不是新一次操作的批准。
- 最終網站設計及網域接入里程碑先通知使用者，未批准不處理正式發布。
- 在功能分支工作；先核實 branch、HEAD、遠端、git status 及 push 觸發條件。
  detached HEAD／正式分支應先建立獨立功能分支；不得把交接文件直接推入 `main`。
- push 前檢查 GitHub workflow 與 Cloudflare Git／Workers Builds 接入，不能只憑
  分支名稱判斷安全。不確定正式部署是否會觸發，就停止 push 並記錄原因。
- code、來源資料、交接／驗收文件分開 commit；大型資料 PR 與 code PR 分開。
  PR 必須留可重現佐證；遵守 `docs/agents/change-policy.md`。`/code-review` 不可用
  時不可假稱跑過；等效佐證須取得使用者對該次例外的批准。
- 不得以較舊工作目錄覆蓋最新分支。先記錄差異及是否已由後來的 PR 取代；
  交接 ZIP 保存區的 patch 是保留證據，不能直接批次套用。
- 不提交 secrets、`.env*`、`.dev.vars`、API key、token、憑證、signed download URL、
  私人資料、remote D1 匯出、本機 SQLite、依賴、build 輸出及大型暫存原件。
  文件只列環境變數名稱；不要把值寫入日誌、PR、交接或畫面。
- 雲端交接依 `config/storage.json` 及 `docs/CLOUD_STORAGE.md`；設定宣告不是權限或
  已部署證據。GitHub 保存 code／公開文件；私有附件只進已批准的私有儲存。
  每個接手客戶端獨立授權；完整版本上傳／讀回核對後才更新 current pointer。
  不把儲存成功當成網站發布、NAS 備份成功或另一個 LLM 已讀到資料。

### 主要程式及核實過的指令

目錄／前提／實跑結果讀 [開發指令](docs/agents/development-commands.md) 及 HANDOFF。
主要程式是 `apps/web`、`apps/api`、`packages/coverage`、`apps/e2e`；資料及自動化在 `data`、`scripts`、`.github/workflows`。
使用 package.json 指定 Bun 與 lockfile：`bun install --frozen-lockfile`。
檢查 `bun run typecheck`／`bun run test`／`bun run check`；build 是 `bun run build`（Worker dry-run）；E2E 另跑 `bun run e2e`。
publication seed 用 `bash scripts/check-publication-seed.sh`，按改動政策核對官方原文。
指令定義已核實；實際執行結果必須另外記錄，不得為交接擅自升級依賴或全庫格式化。

### 編碼及交接維護

- 保留官方原值精度、N/A、各欄位自己的日期、嚴格類別配對及非官方分類標示。
  年率化與累積回報不互換；欠缺時序不畫虛構走勢；配置不完整不能補到 100%。
- 沿用已確定的 header、品牌風格、簡潔／深入模式及既有可及性；新增 UI 文案的
  事實陳述要有來源。來源抽取及會出街的欄位須依改動政策做端到端核對。
- 每次交接更新 `docs/HANDOFF.md`：實際 branch／commit／push、完成及待辦、
  實跑結果、未同步檔案、第一批接手步驟。用「已驗證／推測／未核實」區分證據。
- 架構、頁面、來源、workflow、變數名稱或發佈路徑改變時更新 `PROJECT_MAP.md`；
  只有已確定的重要決定才追加 `DECISIONS.md`（日期、原因及佐證）。
- 共用規則只放本檔案；每日狀態不放這裡。保留歷史文件，透過
  `docs/handoff/DOCUMENT_INDEX.md` 指明時效及新文件優先順序，避免覆蓋證據。

### 可攜接手

- 接手重建依GitHub exact commit、私有R2 manifest及lockfile；不把舊本機絕對路徑、OAuth、node_modules或聊天記憶當先決條件。
- 實際保存及雲端取回狀態讀`docs/LOCAL_INDEPENDENCE.md`與HANDOFF；完整archive核對及新環境還原/依賴準備分別記錄，未完成不能聲稱已脫離本機。
- 歷史Git bundles/dirty檔案/skills放私人保存區；不批次覆蓋active repo、不推歷史私有refs，不擴大新client權限。
