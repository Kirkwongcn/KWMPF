# 2026-10-12 宏利環球精選三年回報：每版兩隻基金、下載 403

評估日：2026-10-12（UTC）。

## 發現

- **下載**：受託人便覽 `quarterly-fund-fact-sheet.pdf`（Last-Modified 2026-08-25，截至 2026-06-30）
  對 curl_cffi `chrome124`、`chrome131`、`chrome133a`、`chrome136` 指紋一律 403，`chrome150` 先得。
- **parser**：便覽第 2 至 16 頁每版兩個表，舊 parser 每版只讀第一個（29 隻得 12 隻），而且靠
  「Fund Performance 2」之後數第八個數字。正式網站嗰 12 隻數值正確（重讀一致）。

## 修正

- `scripts/fetch-trustee-fact-sheets.py`：先用 `chrome124`；回 403 就換 `chrome150` 再試一次，
  換指紋唔計入重試次數；`chrome150` 都 403 就照報失敗。指紋名寫死，配合
  `requirements-source-archive.txt` 鎖定嘅 curl_cffi 0.16.2。
- `packages/coverage/src/manulife-global-select-parser.ts`：改用 `pdftotext -bbox`。表頭定 11 個回報欄
  （累積七欄、年率化四欄）加 5 個曆年欄；基金行由「基金表現」起，到下一個標籤（指數基金嘅指數行，
  或者平均成本法）止，平均成本法行必須喺本表之內；每欄一格，唯一例外係「不適用▲」「N/A▲」中英
  對照；基金標題要喺上一個表頭同今個表頭之間；年率化三年要同累積三年對得上（相差 ≤ 0.05，
  只作讀錯欄核對，唔輸出換算值）；一版「Fund Performance」標籤數目同認到嘅表頭數目唔同、
  截至日混合，整份報錯。
- `/code-review medium` 10 項發現，修 8 項；未改 2 項：截至日混合照舊報錯（實測全份都係
  2026-06-30，混合日期正正係要攔住嘅情況）；測試未覆蓋「-」唔適用路徑（今期冇基金三年寫「-」）。

## 資料

候選 `data/coverage/2026-10-12-official-return-observations-candidate.json` 新增 17 行，報告
`manulifeGlobalSelectRefresh` 一節有來源 manifest。已發布 12 行重讀一致；其餘 487 行逐字不變。
29 個數值全部通過年率化／累積核對，並逐個對 `pdftotext -layout` 原文（核心累積、退休收益、利息、
保守、穩健基金數字跨行，逐張表人手對）。

全部截至 2026-06-30，已過 90 日時限，只更新基金頁。`check-publication-seed.sh`：`rankingRows` 68 不變、
`excludedStaleCount` 263 → 280。本機 API 抽三筆：

| 基金 | API 三年 | 截至 | 原文（累積三年 → 年率化三年） |
| --- | ---: | --- | --- |
| 核心累積（`mpfa-cf-1485`） | 11.82 | 2026-06-30 | 39.81 → 11.82 |
| 亞太股票（`mpfa-cf-370`） | 22.17 | 2026-06-30 | 82.32 → 22.17 |
| 退休收益（`mpfa-cf-1719`） | 3.04 | 2026-06-30 | 9.40 → 3.04 |
