# 官方平台欄位：DIS、規模、回報、風險、費用

由積金局基金平台詳情頁抽出嘅欄位同顯示規則。過期政策見
`freshness-policy.md`；便覽嗰邊嘅欄位見 `fact-sheet-extraction.md`。

## DIS constituent funds

預設投資策略由「核心累積基金」同「65歲後基金」兩隻獨立成分基金組成。
`isDisComponent` 只對 `constituentFundName` 做完全匹配（大小寫、引號、破折號
正規化），寫入 `core_accumulation` / `age65_plus`。唔用 `fundClassName`
（嗰欄係 Class A／n.a.），亦唔做包含或前綴比對。

已知全名寫在 `packages/coverage/src/dis-component.ts`。新名稱要人手加進名單；
官方 `fundType` 寫明 DIS 但名稱不在名單內，發布會報錯，不可用基金種類補位。
一個計劃缺任何一隻就整項 DIS 表現標示官方未提供（#241），唔估算。
呢個標籤唔影響排名。

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
