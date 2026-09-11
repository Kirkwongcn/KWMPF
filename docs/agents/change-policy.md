# 改動政策：收貨條件、PR 組成、覆核、部署來源

這份文件講「一個改動要點樣先算完成」。抽取規則、欄位語義去
`docs/agents/` 其餘幾份；這裡只講流程。

由 #210 到 #194 那一輪（PR #215–#266）的實際紀錄暴露了四個漏洞，每一節
對應其中一個，並寫明點解要咁做——唔想日後有人當成純粹官僚手續而繞過。

## 1. 收貨條件必須驗到端到端

**點解**：#242 出咗 `period=3` 嘅 API、#245 出咗 UI，兩張票都「完成」咗，但
正式網站排名係空嘅——發布 seed 冇套官方回報 overlay，要 #261 補；#261 又走漏
富達來源連結，再要 #263 補。三張票先做到一件事。根因係每張票嘅收貨條件
只驗到自己嗰一層（API 回 200、UI 有得揀），冇人驗過「發布之後個網站真係有數」。

**規則**：凡係會新增或改動**會出街嘅欄位、期間、排名或分組**嘅票，收貨條件
必須包含以下呢一條，唔可以用「API 回 200」代替：

> 用最新 `data/sources` 批次跑一次 `publication-seed`，指定端點回傳非空，
> 並抽三筆同官方原文對得上。

**做法**（本機，唔使部署）：

```bash
# 1. 搵出最新批次
snapshot="$(scripts/resolve-previous-snapshot.sh data/sources)"

# 2. 用同 production 一模一樣嗰條 seed 路徑（publication-seed 就係
#    build-staging-seed.ts）起一個本機 D1 並啟動 Worker
KWMPF_E2E_SOURCE="$PWD/$snapshot" scripts/e2e-serve-api.sh

# 3. 另開一個 shell，打真嗰個端點
curl -s 'http://127.0.0.1:8799/rankings?metric=return&period=3' | jq '.items | length'
```

第三步唔可以只睇 HTTP 200：要睇**行數非零**，再由 `data/sources` 嘅原文
（或者對應嗰份便覽 PDF）抽三筆逐個數字對。對唔到就唔算收貨。

改到費用、風險、配置、持倉、過期狀態嘅票同樣適用，只係端點唔同。

## 2. 資料檔同 code 分開

**點解**：#215 +34,534 行、#226 +4,344、#251 +4,146。絕大部分係 JSON 快照，
但同 code 改動撈埋喺同一個 diff，實際上冇人（包括 agent）review 得到 code 嗰部分。

**規則**：`data/` 之下嘅新增或重建檔案，同 `packages/`、`apps/` 嘅 code 改動
**分開 commit**；超過一千行資料就分開兩個 PR（先入資料、後入 code，或者相反，
睇邊個係前提）。成本近乎零，但令 code 嗰個 diff 重新變成讀得完。

例外：改對照表規則同時重建對照表，兩者必須同一個 PR 先證明到規則改咗之後
個表變成點——嗰陣仍然要分開兩個 commit。

## 3. 高危路徑要覆核憑證

**點解**：抽查 PR #266／#265／#262／#258／#251，全部 `reviews=0, comments=0`，
自己 merge。CI 擋得住 typecheck／test／build／e2e，但呢個專案最大嘅風險係
**靜默改寫官方數字**（成套抽取規則都喺度防呢樣），而呢類錯測試綠燈一樣過。
一個人嘅 repo 冇得靠第二個人批准，所以改為要求留低憑證。

**規則**：改到 `scripts/high-risk-paths.txt` 列出嘅路徑（同
`.github/CODEOWNERS` 同一組），PR 描述必須勾齊：

```
- [x] high-risk: code-review
- [x] high-risk: publication-seed
```

- `code-review`：跑過 repo 內嘅 `/code-review`，並把結果（或者「零發現」）
  貼上 PR。
- `publication-seed`：跑過第 1 節嗰條端到端核對，並貼出對過嗰三筆數字。

CI 嘅 `high-risk-review` job 會檢查（`scripts/check-high-risk-review.sh`）。
佢只檢查有冇勾，唔檢查有冇做——勾咗但冇做，責任在勾嘅人。純 UI／文件 PR
一條都唔使勾，唔加摩擦。

新增高危路徑時，`scripts/high-risk-paths.txt` 同 `.github/CODEOWNERS`
兩邊一齊改。

## 4. 部署來源批次唔可以寫死

**點解**：`deploy-production.yml` 嘅 `source_snapshot` 預設值一路停喺
`2026-08-13/mpf-fund-platform.json`，但最新批次已經係 `2026-08-29`。手動
dispatch 撳落去唔改，就會把舊數據發上正式網站。`deploy-staging.yml` 更加
直接寫死同一個日期。2026-09-10 一次 failure 加一次 cancelled，正正係呢類手滑。

**規則**：

- `deploy-production.yml` 嘅 `source_snapshot` **冇預設值**，必須人手填。
  填完之後有一步同 `scripts/resolve-previous-snapshot.sh` 解出嚟嘅最新批次
  比對，唔同就直接失敗；真係要回滾就撳 `allow_older_snapshot`，會喺日誌
  留低一個 warning。
- `deploy-staging.yml` 唔再接受日期參數，一律用解出嚟嗰個最新批次，
  連 R2 歸檔路徑都由批次目錄同 `sourceDataAsOf` 砌返出嚟。
- 工作流程入面唔可以再出現寫死嘅 `data/sources/<日期>/`。
  例外只有 `scripts/e2e-serve-api.sh` 嘅預設值——e2e 斷言綁住特定一批數字，
  換批次要連測試一齊改，所以要明示（用 `KWMPF_E2E_SOURCE` 覆寫）。

## 5. 分支衛生

**點解**：`origin` 一度有 75 條 heads，其中六十幾條係已經 squash-merge 咗、
git 睇唔出已合併嘅殘骸（`feat/amtd-fund-fact-sheet-parser-clean` 嗰類），
搞到搵分支同睇歷史都要人手過濾。

**規則**：

- merge PR 一律 `gh pr merge --squash --delete-branch`。
  stacked PR 記得先把下一層 retarget 去 `main` 再刪底層分支，
  否則 GitHub 會連埋下一個 PR 一齊閂。
- 臨時工作目錄一律 `.tmp-` 開頭（`.gitignore` 已經涵蓋）。
- 定期清：`gh pr list --state merged --json headRefName` 拎返已合併嘅
  head ref，再對照 `git branch -r` 刪走。

## 6. 端到端測試

`bun run e2e` 會用 `scripts/e2e-serve-api.sh` 把已發布快照載入本機 D1，啟動本機
Worker 及 `vite preview`，再以 Playwright 在桌面及手機兩個 project 跑跨頁流程。
首次執行前需安裝瀏覽器：
`cd apps/e2e && node node_modules/@playwright/test/cli.js install chromium`。
E2E 不屬於 `bun run check`，在 CI 由獨立 job 執行。
