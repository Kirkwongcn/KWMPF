# KWMPF 未完成工作及優先次序

核對基線：2026-11-12香港時間；main `11750936e88f697b54dca40d0c58afeac5ea3bac`。依據[獨立查核](reviews/2026-11-12-independent-status-audit.md)；以下是待辦，不代表已授權實作／合併／遠端操作。

## P1：下一輪先做

| ID | 工作／目前證據 | 具體下一步／完成條件 |
| --- | --- | --- |
| DATA-402 | [PR402](https://github.com/Kirkwongcn/KWMPF/pull/402)截至10月31，但report仍needs_review／publishable=false | 對799、908、1821三類別的7項費率逐一核對官方原文、日期、類別及精度；依repo政策處理精確source/report blob的審查/disposition，再做最新source＋適用overlay seed及三筆原文。另請使用者批准合併／發布 |
| DATA-400 | [PR400](https://github.com/Kirkwongcn/KWMPF/pull/400)已有MASS 14行9月資料，人工三筆未勾 | 與main2026-10-20候選做逐key差異，確認真實增量、沿用值及來源；重讀三筆原文及精確head CI。若先採用402的10月平台，9月一年交叉核對需保留對應9月snapshot，不可硬配新期；是否重建／取代舊PR待審查 |
| DATA-CONFLICT | [Issue396](https://github.com/Kirkwongcn/KWMPF/issues/396)仍open；ADR0016 reader隔離已合併，但workflow只由rejectedSources產生跟進檔 | 將officialConflicts／quarantinedRows獨立納入跟進與去重；候選沒有增量時亦保留衝突證據。用隔離fixture覆蓋全文件reject／部分隔離／無候選變動。待使用者批准code範圍；不放寬數字比較、不借第三方補位 |
| DATA-DISCOVERY | BOC-Prudential在400下載失敗，Sun Life Rainbow仍2026-06-30；三年年率化線上37行／313 stale | 查最新官方入口及可取得原件，保留URL／抓取時間／hash／各欄位日期；區分403／保護頁、source-behind、無披露及parser失敗。MASS改列待400審查，不能重複稱未取得。資料變更另獨立候選，逐基金驗收 |
| OPS-QUEUE | production backup #7 waiting／#8 pending；staging #17及source archive #11 waiting | 唯讀查清review／concurrency鎖／artifact到期；核對最後成功備份及是否仍可還原。列每個run的具體approve／cancel／rerun建議後等用戶批准；本輪不替gate放行。最後observed production backup success為10月25日#6，不把pending說成備份已成功 |

### 402的7項異常（候選報告，尚未逐筆原文重核）

| 基金類別 | 欄位 | 舊→新（保留報告原值） |
| --- | --- | --- |
| mpfa-cf-799 | managementFee | 0.9995 → 0.92 |
| mpfa-cf-799 | trusteeCustodianFee | 0.1695 → 0.14 |
| mpfa-cf-799 | investmentManagementFee | 0.4 → 0.35 |
| mpfa-cf-908 | managementFee | 0.86 → 0.85 |
| mpfa-cf-908 | investmentManagementFee | 0.61 → 0.6 |
| mpfa-cf-1821 | managementFee | 0.96 → 0.94 |
| mpfa-cf-1821 | investmentManagementFee | 0.19 → 0.17 |

來源是PR402 exact head的`data/sources/2026-11-10/refresh-report.json`；不是本輪已確認官方調費的結論。

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
- 10月20日70／280是當時publication-seed；現在37／313是UTC11月11日線上三年**年率化**排名，不是資料消失或三年累積被改寫的證據。
- main／Pages／Worker已對齊；沒有發現「399尚未部署」的缺口。下一次新資料發布仍需新批准。
- 現行ADR0010是一／五／十年及規模60日；三年90日；分類只用積金局（0011）。不要依10月1舊交接復原45日或Lipper分類。
