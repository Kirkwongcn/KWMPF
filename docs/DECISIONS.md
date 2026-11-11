# 已確認決定索引

基線：main11750936e88f697b54dca40d0c58afeac5ea3bac，2026-11-12查核。只索引已接受ADR及本次使用者要求，不補寫未知批准。進度讀[HANDOFF](HANDOFF.md)。

| 已記錄日期 | 決定／原因及來源 |
| --- | --- |
| 2026-10-02 | [ADR0010](adr/0010-monthly-return-freshness-60-days.md)：一年／五年／十年及規模60日，避免正常公布延遲形成空窗；三年仍90日。舊45日交接不作現行規則 |
| 2026-10-04 | [ADR0011](adr/0011-mpfa-fund-type-only-classification.md)：比較分類只用積金局基金類型；不沿用Lipper/編輯分類 |
| 2026-10-05 | [ADR0014](adr/0014-official-three-year-cumulative-returns.md)：官方三年累積獨立欄位、own date/printed、不換算、不混入年率化排名；資料不足不造時序 |
| 依ADR原文 | [ADR0012](adr/0012-official-narrative-text-fields.md)、[0013](adr/0013-chart-read-allocations.md)：官方文字原文及圖表印出數字的讀取規則；不以本索引猜批准日期 |
| 依ADR原文 | [ADR0015](adr/0015-third-party-lipper-three-year-cumulative.md)：受託人沒有提供時的Lipper三年累積補位，標明第三方；不是比較分類 |
| 2026-10-20批准（ADR日期10月17） | [ADR0016](adr/0016-official-source-conflict-quarantine.md)／#397：同日且一年核對通過的長年期官方衝突只隔離該行，保留雙方原值、原文、日期與來源；該行不出新三年值，也不由第三方補位；結構性／一年失敗仍整份reject |
| 2026-11-12 | 使用者要求獨立核實main、#399、#396及正式版本並更新交接；**未批准不得合併或部署**。本次文件查核不授權Cloudflare設定、D1/R2 mutation、gate批准或其他workflow操作 |

官方長年期計法、誰的數字更準、監察SLO／通知、下一批資料合併與發布均未在本輪定案。Vault已發布知識的批准也不構成原專案本輪操作批准。
