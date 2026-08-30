# KWMPF

香港強積金計劃及基金比較網站。開始工作前先閱讀 `CONTEXT.md`、相關 ADR，以及 canonical implementation spec。

## Agent skills

### Issue tracker

工作項目以 GitHub Issues 管理。詳見 `docs/agents/issue-tracker.md`。

### Triage labels

採用五個預設 triage labels。詳見 `docs/agents/triage-labels.md`。

### Domain docs

本專案採用 single-context：根目錄 `CONTEXT.md` 配合 `docs/adr/`。詳見 `docs/agents/domain.md`。

## Reference datasets

`data/reference/` 存放使用者提供、非官方來源的參考資料，原始檔留在 `data/sources/`。
目前有 Lipper 香港退休基金分類（`lipper-hk-pension-categories.json`，見 #194）
及由它產生的基金對照表（`fund-class-category-map.json`）。對照表由
`bun --filter @kwmpf/coverage category-map <平台快照路徑>` 重建，會一併輸出與舊版的差異報告；
未能配對的基金會報錯，不可靜默回退到平台 `fundType`。
這些數據屬非官方來源，顯示時須標明出處及期別，不可與官方平台數據混為一談。
對照表在 `publication-seed` 時寫入每筆快照 payload 的 `lipperCategory`，網站的比較組別由
`apps/api/src/comparison-group.ts` 統一決定；計劃不在 Lipper 來源內的基金以「平台分類：」前綴自成一組。
MPF Navigator 檔案的 Sheet1（風險取向配置比重）不在範圍內，不要入庫或引用。

## Official scheme fact sheets

積金局的「基金便覽」按計劃發布，連結抄錄自〈註冊強積金計劃及成分基金〉登記冊，存放於
`data/sources/<YYYY-MM-DD>/fund-fact-sheet-links.json`。`packages/coverage/src/fact-sheet-lookup.ts`
只認 `YYYY-MM-DD` 目錄，取最新一個帶有該檔案的批次，並在 `publication-seed` 時把
`schemeFactSheet`（連結、抄錄日期、登記冊網址）寫入每筆快照 payload。
快照內有計劃在連結檔中找不到就會報錯，不可靜默略過。
檔案編號的前綴代表計劃類型（`MT` 集成信託、`IS` 行業、`ES` 僱主營辦），不可由編號推算。
更新做法：開新的日期目錄，由登記冊重新抄錄全部計劃，再重跑 seed。

## Fact sheet allocation and top holdings

便覽的「配置」及「十大持倉」由 `packages/coverage/src/fact-sheet-allocation.ts` 抽取，
24 個計劃各自一份契約寫在 `fact-sheet-allocation-contracts.ts`。抽取靠座標：便覽是多欄
雙語版面，`pdftotext -layout` 會把相鄰欄位併成同一行，所以一律行 `pdftohtml -xml`
（`pdf-xml.ts`）。契約只描述「去邊度攞」，不描述「點樣改寫」——維度標題、標籤及證券名稱
一律原文照錄，不做正規化或跨計劃映射（跨計劃比較是另一張票 #211）。

五條不可繞過的規則：

- **有數值、冇名稱就整塊當官方未提供**。宏利環球精選有部分證券名稱畫成向量而非文字，
  靜默丟走這些行會令名單短一截、排名整體移位，等於改寫官方披露。走 `unavailableFields`，
  並把原因（連同落單那幾行的原文）寫入 `unavailableReasons`。
- **抽唔到成表就明講**。`BlockSelector.unextractable` 用嚟聲明「版面上有呢一塊，但抽唔到」，
  例如宏利環球精選的條形圖標籤是向量、我的強積金的圓餅圖標註共用基線又有數值離群。
  設咗就一律走 `unavailableFields`，唔會出局部資料。
- **接駁文字唔可以加多咗空格**。同一行的文字段落用水平空隙決定要唔要空格（`joinItems`：
  中銀保誠把 `8.4%` 拆成 `8` `.` `4` `%` 四段緊貼的文字）；跨行的中文標籤兩邊都係中文時
  唔加空格，中英對照之間就要加。
- **配對唔做模糊比對**。`fact-sheet-allocation-pairing.ts` 只做大小寫、彎引號、破折號
  正規化，加上契約聲明的 `platformNamePrefix`（平台寫「BCT (Pro) …」，便覽冇呢個前綴）。
  同名兩個區段就報唔配對，唔可以隨便揀一個。一隻成分基金的多個基金類別共用同一份披露。
- **疊印就唔好猜**。永明那份便覽的文字層把另一隻基金的同一張表疊印在同一個位置，
  只差兩至七 pt，有幾行兩份的百分比左界完全一樣。`rejectOverlaidRows` 一見到同一行
  喺數值欄有多過一個數值就整塊當抽唔到，唔會靠座標猜邊個數值屬邊隻基金。

版面原語，唔好夾硬用錯：一般表格逐行讀；`rowGap` 把換行拆散的一列併返（宏利自在人生、
富達的數值垂直置中排在兩段名稱之間，容差要細過列距）；`callouts` 分組圖表標註，預設按
中心 x（中銀保誠、交銀的幾個扇形百分比會落在同一條基線上），`overlap` 則按水平範圍相交
（MASS 的標註在餅左邊靠右對齊、右邊靠左對齊，中心對唔上），兩者都以百分比作結；
`labelColumnGap` 把換行的中英對照標籤逐欄併返（新地）。

欄界四個原語：`band` 明確劃死；`leftSlack` 收窄自動欄界的左邊容差（富達左欄評論的
斷字連字符會漏入）；`columnWidth` 收窄右邊（自動欄界只識數到下一個更右的標題，
右邊係註腳時推唔到）；`headingFontSize` 排除附錄用細字縮印的同一批表（富達用 4 級字）。

有幾個計劃逐隻基金披露唔同維度（富達、BCT Simple／Smart），`heading` 要認齊全部維度標題，
`headingLabel` 逐個對照中文名，唔可以夾硬當成同一個維度。

覆蓋報告：`bun run coverage:fact-sheet-allocation-report --platform <平台快照> --links
<fund-fact-sheet-links.json> --fact-sheets <PDF 目錄> --output <report.json>`。報告逐個計劃
列出已配對數、未配對清單及原因、以及配對到但官方未披露的原因。2026-08-30 以積金局便覽庫
的 24 份 PDF 跑：382 隻成分基金中 377 隻配對到，309 隻有配置、335 隻有十大持倉。
餘下缺口主要是圖表式披露：宏利環球精選的配置畫成條形圖、永明畫成圓環圖、
我的強積金的圓餅圖標註共用基線，全部走 `unavailableFields` 並寫明原因。

## Fund size, launch date and calendar year returns

官方平台詳情頁另有 `Fund size (HKD Million)`（連自己的截至日期）、`Launch Date`、
`Calendar year return: YYYY` 及 `Annualized Return / Cumulative Return (Since Launch)`。
`platform-parser.ts` 把它們抽為 `fundSizeHkdMillion` / `fundSizeAsOf` / `launchDate` /
`calendarYearReturns` / `sinceLaunchReturn`，再由 `build-publication-input.ts` 帶入 payload。
基金規模的截至日期與回報的截至日期各自保留（payload 的 `fundSizeAsOf` 與 `returnsAsOf`），
兩者不同時基金詳情頁會標示「並非完全可比」。基金規模沿用月度寬限期，API 以 `fundSizeFreshness`
另行計算；成立日期是靜態事實，不設過期。年度回報是曆年累積回報，顯示時不可與年率化數字混為一談，
官方寫 `n.a.` 的年度走 `unavailableFields`，不可當成 0。

## Fund risk indicator

官方平台詳情頁的 `Fund Risk Indicator` 是年度化標準差，`platform-parser.ts` 抽為
`fundRiskIndicator`（451 頁全部有此欄位，435 隻有數值、16 隻 `n.a.`）。
`/rankings?metric=risk` 用它做波幅排序（`sortDirection: ascending`、兩位小數、單位 `%`），
不用 `riskClass`——風險級別只有 1 至 7 級，是同一指標的分級摘要，451 隻基金擠在 7 個值裡
會大量並列。風險級別仍然保留作 `/search?riskClass=` 的篩選條件，兩者不可互換。

它不是收費：抽取走 `percentField` 而非 `rateField`，沒有 `Up to` 上限語義，對不上百分比格式
就報錯，不會退回 `feeDisclosures`。官方寫 `n.a.` 的走 `unavailableFields`，不當成 0，
亦不會用風險級別補位，該基金不參與波幅排名。指標每月隨市況變動屬正常，所以**不要**把它加入
`candidate-anomalies.ts` 的 `feeFields`，否則每次更新都會觸發無意義的人手核對。

## Fee breakdown

官方平台詳情頁披露一整組費用組成部分，`platform-parser.ts` 全部抽入 `fundOverview`：
經常性費率（`managementFee`、`trusteeCustodianFee`、`empfPlatformFee`、`memberServicingFee`、
`investmentManagementFee`、`guaranteeCharge`）、一次性及交易收費（`joiningFee`、`annualFee`、
`contributionCharge`、`bidSpread`、`offerSpread`、`withdrawalCharge`）及三個期別的持續成本說明
（`oci1yHkd` / `oci3yHkd` / `oci5yHkd`）。

三條規則不可繞過：

- 原文帶 `Up to` 的是收費上限，不是實際費率。欄位名會列入 `feeCaps`，顯示時必須標明「上限」。
- 不是單一費率的披露（例如按成員人數分級的年費）原文照錄到 `feeDisclosures`，不可砌成數字。
  官方用 `<br>` 逐行列明階梯及註腳，抽文字時必須把分行還原成換行（`platform-parser.ts` 的
  `collapseLines`），否則 `HKD3,000` 接 `15 to 29` 會黏成 `HKD3,00015 to 29`，等於改寫原文。
  基金詳情頁的文字披露用 `.fee-disclosures` 的 `white-space: pre-line` 保留分行。
- 官方寫 `n.a.` 的走 `unavailableFields`，不可當成 0；平台確實寫 `0%` 的才是 0。

費率的小數位數由披露本身決定（`1.205%`、`0.575%`），顯示時不可固定成兩位小數，否則會把官方數字改寫。
新增費用欄位時要一併加入 `candidate-anomalies.ts` 的 `feeFields` 並升 `version`，令費率改變觸發人手核對。

## End-to-end tests

`bun run e2e` 會用 `scripts/e2e-serve-api.sh` 把已發布快照載入本機 D1，啟動本機 Worker 及 `vite preview`，再以 Playwright 在桌面及手機兩個 project 跑跨頁流程。首次執行前需安裝瀏覽器：`cd apps/e2e && node node_modules/@playwright/test/cli.js install chromium`。E2E 不屬於 `bun run check`，在 CI 由獨立 job 執行。

## Canonical specification

第一版實作以 `docs/specs/2026-08-08-hk-mpf-comparison-v1-implementation-spec.md` 為準。較早的計劃和研究文件只作決策來源及背景。

## User milestone preference

當工作進入最終網站設計及網域接入階段，先通知使用者；未獲確認前不處理正式網域或最終公開發布。
