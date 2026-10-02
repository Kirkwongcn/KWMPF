# 富達三年回報欄位錯讀及 2026-10-02 受託人回報更新

評估日：2026-10-02（UTC）。本文件記錄本機實證；兩個分支均未合併、未部署。

## 1. 已驗證：正式網站兩個三年錯值

正式 snapshot `snapshot-mpfa-platform-2026-08-31-ad3a75b686b9`（Deploy production run #30）用
`2026-09-30-official-return-observations-candidate.json`，其中富達兩隻 DIS 基金的「三年」其實係一年欄：

| 基金 | 正式網站三年（07-31） | 原文一年 | 原文三年 |
| --- | ---: | ---: | ---: |
| Age 65 Plus Fund（`mpfa-cf-1552`） | 3.70% | 3.70% | 4.31% |
| Core Accumulation Fund（`mpfa-cf-1551`） | 12.36% | 12.36% | 10.91% |

原文來自私人保存區 2026-09-26 下載的受託人便覽文字（SHA `100abc8d…`、`5a2035ea…`）。兩隻都喺三年排名之內，
2026-10-29 後因過期自動退出排名，但詳情頁仍會顯示錯值，直至新快照發布。

**原因**：左欄投資目標「targets to invest 20%／60% of its NAV」同年率化表共用基線。舊 parser 喺
`pdftotext -layout` 文字由「Annualised Performance」起數第四個數字，`20%` 被當成第一格，整行左移一格。
積金局合併版 MT00288（2025-12-31）同樣錯讀，並把 Americas／European Equity 三年欄「-」錯當成立至今回報
（17.89%、10.14%）。其餘 21 隻三年值正確。

## 2. 修正（code 分支 `claude/relaxed-goldberg-5ytvfk-fidelity-3y-column`）

改用 `pdftotext -bbox` 逐詞座標：表頭（YTD … Since Launch）定七個欄位中心；標題至 Dollar Cost Averaging／
Calendar 之間、表格欄內的格組成行，第一行必須係基金本身（多行表標籤「Fund 基金」、單行表「年率化表現」），
七格各對正一個欄位，否則成份便覽報錯，唔會跌落參考組合／指數行。三年 N/A 記 `official-na`、「-」記
`official-dash`（連頁碼）入 `fundPeriodNotDisclosed`，唔借用其他欄。

核對：23 份受託人便覽（08-31）全部同獨立表格列檢查一致；MT00288 得 21 個值加兩個 `official-dash`；
`bun run check` 通過（coverage 336／API 80／Web 129）；`/code-review` 多輪，最後一輪零發現。

**未處理（全庫既有）**：數值以 number 儲存，`4.70%` 變 `4.7`（顯示層再格式化為 `4.70%`）；
`fundPeriodNotDisclosed` 未自動入 `returnUnavailable`，網站只顯示 `official-na`。

## 3. 新期別 discovery 及候選（data 分支 `claude/relaxed-goldberg-5ytvfk-returns-2026-10-02`）

| 受託人 | 結果 |
| --- | --- |
| 富達 | 23 個固定網址 2026-09-30 換版（Last-Modified 03:33 GMT），全部截至 2026-08-31 |
| 友邦 | 官網目錄最新 jul-2026（截至 07-31）；aug-2026 網址 404 |
| 海通 | 仍截至 2026-08-31，無更新 |
| 季度受託人 | 未重抓；Q3（09-30）便覽預計十月底後先出 |

候選 `data/coverage/2026-10-02-official-return-observations-candidate.json`：295 行，40 行換新（富達 23、
友邦 17），其餘逐字不變。友邦 China HK Dynamic Asset Allocation Fund 標題字距令抽取名稱冇空格，
唔做模糊配對，保留 05-31 舊行並記原因。友邦 2026-05 原件重抽 18 行與已發布值完全一致（回歸）。
要喺本環境抽友邦，需要安裝 `poppler-data`（Adobe-CNS1），否則中文標題抽唔到。

三年合資格：2026-10-02 54 行；10-30 起 37；11-30 起 0。11-30 前須有 9 月月度（富達、海通、友邦）或 Q3 便覽，
否則正式部署 smoke（三年排名非空）會令任何發布失敗。

## 4. 端到端（publication-seed）

`bash scripts/check-publication-seed.sh`：source `2026-09-26/mpf-fund-platform.json`
（`04b78cfc…`）、overlay `2026-10-02-…-candidate.json`（`bdd50875…`），通過，`rankingRows=54`、
`excludedStaleCount=241`。本機 API `/rankings?metric=return&period=3`：

| 基金 | API | 原文（渲染頁面） |
| --- | --- | --- |
| 富達 Age 65 Plus（`mpfa-cf-1552`） | 4.70%，2026-08-31 | H-C65P 第 2 頁：一年 3.86%、三年 4.70% |
| 富達 Hong Kong Equity（`mpfa-cf-273`） | 10.75%，2026-08-31 | H-CFHK 第 2 頁：三年 10.75% |
| 友邦 Greater China Equity（`mpfa-cf-102`） | 17.01%，2026-07-31 | jul-2026 第 20 頁：三年 17.01 |

另：富達 Core Accumulation API 12.06%，與原文表格列一致。
