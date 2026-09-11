# 編輯式資產類別映射與比較組別平均

便覽原文點樣變成跨計劃可比嘅三桶，以及每個比較組別嘅平均值。
決策背景見 `docs/adr/0005-editorial-asset-class-buckets.md`。

## Editorial asset-class mapping

第一版只把便覽配置映射到三個資產類別桶：股票／債券／現金及其他（#211 選 A）。
地區與行業暫緩。映射是編輯判斷，不是官方分類。

對照表在 `data/reference/allocation-label-map.json`，鍵是正規化後的標籤
（插入中英空格、摺疊空白、去掉字母編號及註腳），值是 `equity` / `bond` /
`cash_and_other` / `not_asset_class`。重建：

`bun --filter @kwmpf/coverage allocation-label-map <fund-fact-sheet-disclosures.json>`

會對照舊表輸出 `added` / `removed` / `recategorized`。已有對照表再出現差異就以
非零狀態結束，未覆核不得發布。未出現在表內、又不是抽取垃圾的標籤會報錯，
不可靜默丟進「其他」。

套用規則：

- 一張表的每一行都映射到三桶，合計絕對值在 80 至 120 之間，先可以出三桶。
- 資產 × 地區（「香港股票」）可加總。
- 純地區、純行業、評級、貨幣，或同一張表混了這些，走
  `mappedAllocation.unavailable`，原因 `not-asset-class`。網站措辭是
  「此維度官方未以資產類別披露」，不可把行業或地區百分比當成股票比例。
- 圖表式披露沿用便覽的 `unavailableKinds`，不為它們發明數字。
- 市場評論、回報列、標準差、標籤裏已有 `%` 的黏行，不當成配置列。若被略過的行
  仍帶股票／債券／現金字眼，整張表都不可用，以免留下殘缺比例。
- 原文表仍在 `factSheetDisclosure`。三桶寫在 payload 的 `mappedAllocation`，
  `official: false`，顯示時必須標明「編輯歸類，非官方分類」。

## Comparison group stats

`publication-seed` 會按 Lipper 比較組別（`apps/api/src/comparison-group.ts` 同一口徑）
計算每個組別的平均值，寫入 `comparison_group_stats`，每個快照凍結一份。網站只讀
`GET /comparison-group-stats`，唔即場重算。

- 資產配置平均來自 `mappedAllocation` 三桶；未以資產類別披露的基金不計入。
- 十大持倉集中度是便覽十大持倉百分比的合計；任何一筆冇披露比重就不計入該基金。
- 三年波幅用官方平台的 `fundRiskIndicator`（年度化標準差），不另行由月度序列反推。
- 待核實／資料不足的基金不計入。組別少於 3 隻已核實基金會標示 `insufficientSample`，
  三項平均都為空。某一指標少於 3 隻有數值，只清空該項平均。
- 每個有已核實基金的比較組別都有一列。不可為了湊樣本而把行業或地區百分比當成股票。
