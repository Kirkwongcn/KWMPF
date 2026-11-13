# KWMPF 未完成工作及優先次序

核對基線：2026-11-12香港時間；main `c296c42a173ef03bbde99a3df6db3810fcf30724`。依據[獨立查核](reviews/2026-11-12-independent-status-audit.md)；以下是待辦，不代表已授權實作／合併／遠端操作。

## P1：下一輪先做

| ID | 工作／目前證據 | 具體下一步／完成條件 |
| --- | --- | --- |
| DATA-409 | [正式資料、Pages 及 release manifest 驗收完成](reviews/2026-11-13-pr409.md) | 此次發布已結案，日常自動寫入關閉。 |
| DATA-402 | 七項官方費率及四個上限全部核實；精確檔案的 disposition 已通過發布前檢查 | 發布狀態及驗收記錄見 [#402 跟進](reviews/2026-11-12-pr402.md) |
| DATA-400 | 已核對、測試及合併，14 筆更新，0 筆新增 | 已完成 #52 發布，14 筆公開詳情及完整排名已核對，見 [逐項記錄](reviews/2026-11-12-pr400.md) |
| DATA-CONFLICT | [Issue396](https://github.com/Kirkwongcn/KWMPF/issues/396)仍open；ADR0016 reader隔離已合併，但workflow只由rejectedSources產生跟進檔 | 將officialConflicts／quarantinedRows獨立納入跟進與去重；候選沒有增量時亦保留衝突證據。用隔離fixture覆蓋全文件reject／部分隔離／無候選變動。待使用者批准code範圍；不放寬數字比較、不借第三方補位 |
| DATA-DISCOVERY | 11 月 14 日[全部 271 筆及來源](reviews/2026-11-14-annualized-271.md)已逐項配對，0 筆恢復。 | 跟進優先三家新季度便覽及固定連結指紋，核對 AMTD 16 筆歷史資料；[中國人壽日期修正及測試](reviews/2026-11-14-china-life-date-fix.md)已完成，待整合功能分支。另追蹤友邦、萬通 34 筆八月資料（11 月 30 日起超過 90 日）。 |
| DATA-AUG-EXPIRY | #406 已把 34 筆年率化原件接入每日排程。首個 main 手動 run 已完整核對，最新仍為八月底。 | 讀取每日 run 摘要及 annualized-factsheet-review artifact。有新版就核對原件與資料 PR；若仍無新版，11 月 30 日起這 34 筆須按現行 90 日規則排除。[來源及操作](reviews/2026-11-12-aia-mass-expiry.md) |
| OPS-QUEUE | 正式備份 #7 與 #8 已放行、成功並釋放共用鎖。舊記錄的 staging #17、原件封存 #11 狀態待重驗 | 查明原件是否已歸檔及 artifact 到期日，再處理 staging 排隊 |

## P2：在上述資料／操作風險後跟進

| ID | 工作 | 完成條件／限制 |
| --- | --- | --- |
| DATA-METHOD | 積金局與宏利5／10年計法未有已核實回覆 | 先整理窗口／按月結息／捨入及序列的查詢；對外發送需授權。取得可引用回覆後再決定需否新ADR；不猜哪個官方數字更正確 |
| OPS-401 | [Issue401](https://github.com/Kirkwongcn/KWMPF/issues/401)是10月27保護頁失敗；後續兩次refresh成功 | 確認重試／限速／失敗artifact及issue關閉條件；保留失敗案例，不能用改expected counts掩蓋保護頁。是否已有後續修復需code／run佐證 |
| OPS-OBS | 正式監察、時效漂移、source failure及SLO；完整release rollback | 先盤點現有監察、通知接收者、演練／回復證據及費用，再提出設定方案；本輪未量測SLO、未做restore，不改retention |
| OPS-SNAPSHOT | request內publication一致性與cache／UTC日界 | 重新覆核最新main後重現跨publication切換；舊9月review只是線索。當前health／summary相同snapshot不證明所有race已不存在 |
| ACCESS-HANDOFF | 10月1私人R2交接保存、其他client／Codex Cloud／NAS現況未重驗 | 盤點各自已授權存取、最新manifest及缺漏；接手以最新Git SHA為準。新認證／R2寫入／雲端建立另待批准，不把舊pointer當本輪已更新 |

## P3：須重新審視後才排實作

搜尋P95／D1用量、FTS需要、route SEO/canonical/sitemap、手機field CWV、讀屏／放大／真機、圖表單位／來源／表格替代、Actions重複runs及artifact/caches成本，皆先量測／盤點。保留目前header與品牌；本輪沒有對UI或效能重新完整驗收。
三年累積已由ADR0014實作，第三方Lipper由0015明示、0016抑制衝突補位；不再把「要否新增三年累積」當未決。完整連續時序、任意期間回測與試用門檻驗證另作產品決定。

## 不應重做或誤報的事情

- #397隔離reader及#399宏利28行更新已合併且正式版本一致；不重開同一修復。
- 10月20日70／280是當時publication-seed；37／313是#51發布前UTC11月11日線上三年**年率化**排名，不是資料消失或三年累積被改寫的證據。
- main／Pages／Worker已對齊；沒有發現「399尚未部署」的缺口。下一次新資料發布仍需新批准。
- 現行ADR0010是一／五／十年及規模60日；三年90日；分類只用積金局（0011）。不要依10月1舊交接復原45日或Lipper分類。
