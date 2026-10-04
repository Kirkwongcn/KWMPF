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

## 基金特色的同類位置

`GET /fund-classes/:id/features`（`apps/api/src/fund-features.ts`）計基金喺同一積金局基金類型入面，
規模、成立年期、波幅、管理費排喺邊（ADR 0012 第 6 點）。即場按當前快照計，唔入 seed。

- 只用同一快照、已核實、未過期的官方值；過期規則同排名一樣（規模用月度寬限期，波幅及管理費用
  基金概覽寬限期，成立日期不設過期）。本基金過期照交原值同截至日期，但唔排位。
- 方向固定：規模由大到細、成立由早到遲（按日數，唔按整年，避免同年並列）、波幅及管理費由低到高。
  同值同名次；四分位按並列一組的中間位置計（唔係最好名次，避免大量並列時全部當首四分之一），
  按同類隻數分，少過 4 隻唔分位。平台及來源兩邊都要已核實先入同類（同排名一樣），待核實的
  基金網站講「待核實」，唔講成未取得。
- 網站只講位置（「同類 N 隻中第 k 大」、四格位置），唔講好壞、唔合成總分、唔用推銷字眼；
  中位數及成立年期標「本站計算」；管理費排最後（費用置後）。
