# 過期政策：基金概覽按財政年結日計算

決策背景見 `docs/adr/0006-fund-overview-freshness-by-fiscal-period.md`。

## Fund overview freshness policy

規格第 97 行要求持倉、資產配置、風險及 FER 按每個計劃嘅財政年結日及適用嘅基金概覽發布
期限計算過期（#192）。`platform-parser.ts` 抽 `Financial Period End Date`（平台淨係列月日，
例如 `30 Nov`，唔帶年份，存做 `financialPeriodEndDate: "11-30"`），冇呢個欄位或官方寫
`n.a.` 就走 `unavailableFields`，不可假設。

查證見 `docs/research/2026-09-10-fund-fact-sheet-publication-deadline.md`：《強積金投資基金
披露守則》D3.1–D3.4 要求受託人每個財政期發兩份基金便覽——「截至財政期終結日」嗰份連同
週年權益報表喺終結後三個月內發出，「截至終結後六個月」嗰份喺該匯報日起兩個月內分發。
`data-freshness.ts` 嘅 `fundOverviewGraceDaysFor()` 揀返資料截至日之前最近一份便覽嘅匯報日
（財政期終結日或終結後六個月，二揀一），套用對應嘅法定期限（3 個月或 2 個月）加規格寫嘅
30 日寬限，摺埋做逐個基金類別自己嘅寬限日數；冇財政年結日就退回保守嘅 45 日
（`FUND_OVERVIEW_FALLBACK_GRACE_DAYS`）。呢個取代咗 PR #188 嗰個同月度週期睇齊嘅 45 日
權宜值——兩個計劃財政年結日唔同，喺同一日就會有唔同嘅過期狀態。

寬限日數喺 `build-staging-seed.ts` 逐個基金類別計好，寫入 `provenance.freshnessPolicy.
fundOverviewGraceDays`（連同 `fundOverviewPolicyVersion`），發布之後凍結；規則常數本身
之後改變只影響新批次，不會回溯改寫已發布快照嘅寬限日數。`apps/api` 嘅 `/rankings?metric=
fee|risk` 逐個基金類別讀自己嗰份 `freshnessPolicy`，唔可以淨係攞第一隻基金嘅政策代表全部
（呢個曾經係 bug，已經喺 #192 一併修正並釘測試）。
