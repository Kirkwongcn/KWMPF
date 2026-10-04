# 基金分類與比較組別平均

決策背景見 `docs/adr/0011-mpfa-fund-type-only-classification.md`。

## 只用積金局基金類型

- 比較組別＝積金局中文基金類型原文（`packages/coverage/src/mpfa-fund-type.ts`）。英文鍵逐字等於平台快照 `fundType`；不做正規化、模糊配對或自行翻譯。
- `publication-seed` 用 `assertMpfaFundTypes` 斷言每隻基金的 `fundType` 都在官方清單內；新類型出現時發布停下，先核對積金局平台中英文列表頁，再更新對照表及 ADR。
- API（`apps/api/src/comparison-group.ts`）回傳 `comparisonGroup`（中文類型）、`comparisonGroupSource: "mpfa"` 及 `comparisonGroupFamily`（六個基金類別之一）。清單以外的類型回傳「積金局未提供基金類型」，不入任何組別、不參與排名。
- 受託人自述的 `fundTypeDescriptor` 只作參考顯示。網站不設 Lipper、三桶或任何編輯分類。

## Comparison group stats

`publication-seed` 按積金局基金類型計算每個組別的平均值，寫入 `comparison_group_stats`，每個快照凍結一份。網站只讀 `GET /comparison-group-stats`（按積金局類型次序輸出），唔即場重算。

- 十大持倉集中度是便覽十大持倉百分比的合計；任何一筆冇披露比重就不計入該基金。
- 三年波幅用官方平台的 `fundRiskIndicator`（年度化標準差），不另行由月度序列反推。
- 待核實／資料不足的基金不計入。組別少於 3 隻已核實基金會標示 `insufficientSample`，平均為空。某一指標少於 3 隻有數值，只清空該項平均。
- 平均值由本站按官方原值計算，顯示時標明「本站計算」。不設資產配置平均。
