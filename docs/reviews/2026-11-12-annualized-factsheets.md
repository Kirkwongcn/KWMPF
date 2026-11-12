# 三年年率化回報覆核 · 2026-11-12

以 10 月 31 日的積金局基金名冊配對發布 #52 的正式排名。350 個基金類別已有三年年率化觀察值，其中 37 個入榜、313 個超過 90 日。名冊另有 101 個類別沒有三年年率化觀察值，並不在本輪 313 筆的分母內。

[逐項清單](2026-11-12-annualized-inventory.csv) 列出全部 313 個基金類別、受託人、原來日期、數值及來源。42 筆已核實項目另列便覽頁碼、新日期、照錄的小數精度與網址。[來源覆核 JSON](../../data/coverage/2026-11-12-annualized-factsheet-review.json) 保存原件 SHA-256、64 次來源檢查及解析限制。

| 受託人 | 原過期 | 已補 | 餘下 |
|---|---:|---:|---:|
| Bank Consortium Trust |100|0|100|
| Bank of East Asia (Trustees) |40|0|40|
| BOCI-Prudential |31|0|31|
| Manulife Provident Funds Trust |29|0|29|
| Sun Life Trustee |29|0|29|
| AIA Company (Trustee) |20|20|0|
| HSBC Provident Fund Trustee (Hong Kong) |18|0|18|
| Bank of Communications Trustee |14|0|14|
| YF Life Trustees（MASS）|14|14|0|
| China Life Trustees |10|0|10|
| Standard Chartered Trustee (Hong Kong)（新地計劃）|8|8|0|
| **合計** |**313**|**42**|**271**|

## 核對依據

- 依積金局名冊與受託人官方連結核查。記錄的 64 次檢查有 58 次成功下載、6 次失敗。成功下載也可能是舊期、文件沒有可解析日期，或只含其他回報口徑。餘下 271 筆表示在已查原件中未核實合資格的新數值；不能推斷受託人從未發布更新。
- 友邦 20 筆採用 8 月 31 日便覽每隻基金的表頭及三年年率化欄。7 月 31 日屬十大持倉日期。通用解析器會選到持倉日期，這批已逐頁核對。下一輪應加入雙日期 fixture，修正通用解析器。
- 萬通 MASS 14 筆採用各基金 8 月 31 日便覽的年率化欄。#400 的 9 月三年累積回報使用不同口徑。新地 8 筆採用 9 月 30 日季報的年率化欄。
- 其餘優先尋找銀聯信託 100、東亞 40、中銀保誠 31 筆的第三季正式便覽；合共 171 筆。對下載失敗、已下載但未解析及確屬舊期的文件分別追蹤。取得新原件後核對基金類別、報告日期、年率化欄及原印小數位。
- 三年回報沿用 90 日門檻。若沒有更新，8 月 31 日一批由 11 月 30 日起超過 90 日；9 月 30 日一批由 12 月 30 日起超過 90 日。

## 測試及發布

本機用正式 10 月快照與候選產生資料庫，核對 SQLite 完整性、外鍵、42 筆數值／日期／來源；年率化觀察值仍為 350，三年累積觀察值仍為 374。[PR #404](https://github.com/Kirkwongcn/KWMPF/pull/404) 的 [CI](https://github.com/Kirkwongcn/KWMPF/actions/runs/43182668077) 通過 verify、high-risk-review 及 E2E。合併版本為 5a83c329c94dd2d9b0f07e3af4c72f154517433b。[main CI #920](https://github.com/Kirkwongcn/KWMPF/actions/runs/43183044981) 通過，push 規則略過重複的 E2E 及 high-risk-review。

[正式部署 #53](https://github.com/Kirkwongcn/KWMPF/actions/runs/43183236016) 成功。正式 /health 的完整 SHA 與合併版本一致。從 /rankings?period=3&metric=return 讀回完整排名，核對基金 ID 集合、42 筆原文數值／日期／來源以及所有組內名次。37 → 79 個基金類別入榜，18 → 21 個比較組有合資格資料。原有 37 筆逐欄比對，21 隻名次相同，2 隻跌一位、9 隻跌兩位、4 隻跌三位、1 隻跌五位；全部原有回報、日期及來源相同。[完整發布前後名次](2026-11-12-annualized-ranking.csv)。
