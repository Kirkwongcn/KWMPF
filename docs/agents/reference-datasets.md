# 參考數據集

使用者提供、非官方來源的參考資料。官方平台數據見 `platform-fields.md`，
便覽數據見 `fact-sheet-extraction.md`。

## Reference datasets

`data/reference/` 存放使用者提供、非官方來源的參考資料，原始檔留在 `data/sources/`。
目前有 Lipper 香港退休基金分類（`lipper-hk-pension-categories.json`，見 #194）、
由它產生的基金對照表（`fund-class-category-map.json`），以及便覽配置標籤到
股票／債券／現金及其他的編輯對照表（`allocation-label-map.json`，見 #211）。對照表由
`bun --filter @kwmpf/coverage category-map <平台快照路徑>` 重建，會一併輸出與舊版的差異報告；
未能配對的基金會報錯，不可靜默回退到平台 `fundType`。
這些數據屬非官方來源，顯示時須標明出處及期別，不可與官方平台數據混為一談。
對照表在 `publication-seed` 時寫入每筆快照 payload 的 `lipperCategory`，網站的比較組別由
`apps/api/src/comparison-group.ts` 統一決定；計劃不在 Lipper 來源內的基金以「平台分類：」前綴自成一組。
MPF Navigator 檔案的 Sheet1（風險取向配置比重）不在範圍內，不要入庫或引用。
