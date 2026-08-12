# China Life 及 Manulife 3 年回報來源核對

日期：2026-08-12

## 結論

China Life 的官方 2026 年第一季 Fund Performance Review 明確列出 1 年、3 年、5 年及 10 年回報，並提供 3 年年率化數值。實際解析樣本取得 6 個基金，6 個均能唯一配對現有 coverage。

Manulife RetireChoice 的官方 Fund Fact Sheet 列出 1 年、5 年、10 年及成立至今的年率化回報；同一文件沒有 3 年年率化欄位，只有 3 年風險標記及其他期間的累積／年率化資料。3 年累積回報不能在本流程自行年化代替官方 3 年年率化回報。

## 處理規則

- China Life 3 年年率化回報可作候選資料，須保留官方 PDF URL、報告截至日及基金身份。
- Manulife 3 年年率化回報標示為 `data_unavailable`，不納入 3 年排名。
- 不由 Manulife 3 年累積回報推算年率化回報。
- 只有與 coverage 基金 class 唯一配對的數值才可進入候選快照；未配對或歧義資料維持排除。

## 實際驗證

- China Life：6／6 解析，6／6 唯一配對，0 未配對，0 歧義。
- Manulife：官方文件可讀，但 3 年年率化欄位不存在，故不建立 parser 數值。

## 來源

- [China Life 2026 Q1 Fund Performance Review](https://www.chinalife.com.hk/sites/default/files/2026-05/1st%20Quarter%202026%20Fund%20Performance%20Review_0.pdf)
- [Manulife RetireChoice Fund Fact Sheet](https://www.manulife.com.hk/content/dam/insurance/hk/en/documents/products/mpf/retirechoice-scheme/fundfact-sheet.pdf)
