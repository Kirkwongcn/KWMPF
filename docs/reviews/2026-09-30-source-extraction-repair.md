# 永明及東亞來源抽取修復紀錄

最新狀態（2026-09-30）：PR #358／#359 已合併，main 3f65596 已由 production run #28 成功發布；私有原件、D1 備份及 release tuple 讀回、正式 API 與桌面／手機畫面已核對。詳見 [本次實際發布記錄](2026-09-30-production-repair-release.md)。以下較早的待辦／未發布敘述保留作歷史紀錄；三年 258 過期／156 未取得及其他 P1／P2 仍須跟進。


評估日：2026-09-30（UTC）。程式修復與大量資料重建分開 PR；本文件記錄本機實證，不代表正式網站已更新。

## 1. 修復範圍

- 永明按頁面、第一落筆文字層、基金及性能表內類別定位，保留五個期間欄位，包括 N/A。圖例不是類別身分；Income 分派歷史續頁不當成回報頁。第二個疊印層的性能標題早於基金名稱，亦作為區塊終點。不完整、重複或不唯一的表格停止整份產出。
- 東亞專用解析器逐頁讀上下兩隻基金，各自綁定年率化表，排除累積、參考組合及儲蓄利率。Industry／Master Trust／Value 分別取得 12／17／11 筆，共 40 筆；原來遺漏的 23 筆已補讀。
- 東亞配置只讀左側完整詳細圓環圖，排除上方獨立摘要條及右側回報／持倉表。每個標註須有名稱及數值；總和須在 100±0.5% 內，不能只輸出讀到的部分。官方註腳 10 明示 rounding 後總和未必恰好 100；沒有調整原值到 100。
- 40 隻東亞基金全部取得完整配置，總和 99.9–100.2%，各有 10 項持倉；配置標籤沒有混入年份、百分比、This Fund／Reference Portfolio。
- 官方 N/A 另記原因、自己的截至日期、URL、SHA-256、PDF 頁數及 unavailableFields；詳情原值表及圖表空值顯示「官方未提供（N/A）」。未知缺項仍為「未取得」。以後已有真正數值時，不能用舊 N/A 蓋過它。
- 高危路徑與 CODEOWNERS 同步補上所有 `*fund-fact-sheet-parser.ts` 及 `parse-fact-sheets.ts`。

## 2. 舊永明六筆逐項原文核對

全部截至 2026-06-30，均已過 90 日。PDF 頁數是實際頁數，並非頁腳印號。

| 基金／類別 | 舊三年候選 | 原文三年年率化 | PDF 頁 |
| --- | ---: | ---: | ---: |
| Conservative Fund／Class B（507） | 12% | 2.84% | 5 |
| Hong Kong Dollar Bond Fund／Class B（505） | 4.4% | 3.68% | 6 |
| RMB and HKD Fund／Class B（911） | 16.9% | 2.99% | 7 |
| Global Bond Fund／Class B（810） | 16.9% | 1.58% | 8 |
| Global Low Carbon Index Fund（2065） | 24.53% | 16.90% | 14 |
| Income Fund（2239） | 3.23% | N/A | 9 |

Income 便覽的一年 3.23% 原文未改寫；平台另有截至 2026-08-31 的一年 2.58%，本機發布保留較新平台值，沒有用舊季度值蓋過它。US & Hong Kong Equity Fund 亦明示三年 N/A（第 19 頁）。永明 31 個平台類別 reconciliation 為 29 個三年數值、2 個官方 N/A，沒有漏讀或模糊配對。

## 3. 配置原文抽查及分類限制

實際 PDF 渲染抽查包括：

1. Industry Hong Kong／Greater China 股票基金：完整行業圖；Consumption Related 原文 `16.0` 本身沒有百分號，按該圖比例單位讀取，沒有估算。
2. Master Trust Japan／Hong Kong 股票基金：Japan Cash 原文為 5.8%；XML 的 `5 .8%` 只在東亞獨立數字標註內重新接合，沒有合併兩個不同標註。
3. Value Growth／Balanced 基金：完整混合資產圖；Growth 股票分項 18.5%、42.5%、12.0%，債券 13.9%，現金及其他 13.1%；三年 14.73%。Balanced 三年 11.00%。
4. Industry 第 2 頁：Growth 三年 12.86%、Balanced 三年 9.33%，上下區塊分開；Growth 的 Global Equities 為 44.0%。

以上是選定原文抽查，不是聲稱 69 個回報或全部百分比曾人工逐字驗證。全批另完成精確身分配對、欄位及總和檢查。

配置對照表新增 14 個實際標籤鍵、移除 7 個舊錯讀／不再出現的鍵，0 個既有鍵改類別。40 隻東亞基金中，20 隻產出 `official:false` 三桶編輯分類；20 隻為 `not-asset-class`，仍保留完整官方圖表／原值。不強行把行業、地區或貨幣圖當成股票／債券配置。

東亞 allocation／holdings 沒有另行明示的 field scope，沒有把文件日期或平台 8 月日期冒充其獨立欄位日期。

## 4. 候選及缺口變化

平台：`data/sources/2026-09-26/mpf-fund-platform.json`，截至 2026-08-31，451 類別。

| 指標 | 修正前 | 本機修正候選 |
| --- | ---: | ---: |
| 三年觀察候選 | 249 | 295 |
| 可排名 | 37 | 37 |
| 日期過期 | 212 | 258 |
| 未取得數值 | 202 | 156 |

新增 47 筆、修正 5 筆錯值、移除 1 筆錯誤三年觀察；其餘 226 筆回報保留，沒有因本輪獲全數準確度認證。6 月 30 日至評估日相隔 92 日，補讀改善抽取覆蓋，不能增加新鮮排名。

156 筆沒有三年數值中，成立日期顯示 6 筆未滿三年、150 筆已滿三年；年期只作診斷，不能代替官方非披露證據。兩筆官方 N/A 仍計入沒有數值的缺口。一年／五年／十年 eligible 為 447／427／358，missing 4／24／93，stale 均 0，與修正前相同。

## 5. 原件與來源版本

四份官方 PDF 已重新下載及保留原始 bytes，截至均為 2026-06-30。下載完成時間以新下載檔案的 UTC 寫入完成時間記錄，與候選產生時間分開。

| 原件 | SHA-256 | bytes |
| --- | --- | ---: |
| Sun Life | `76b62bf6a5d80afb51c44997db8744d985c829ef1a613b9f4c6290243174b293` | 7206638 |
| BEA Industry | `598833c402d1a047832cb9a324fbaadde6546362c30bda6b5187026a3b9f4308` | 1022475 |
| BEA Master Trust | `0e3b5b731bccf242c8517684568702265a8fb5d56d82e53ca5463420406e6473` | 904260 |
| BEA Value | `90f1c4d143d8dde176e530f893c65f4068d9f42c03a40f21174e23bcc85db649` | 751497 |

Master Trust 相同 URL 的舊 SHA 是 `7ea4bbfab38cc00f3aacabadfab25bcbe9bbe565348cbd73f98dff0edb72e6e8`。舊 manifest／候選保留，新檔另立版本。本輪沒有讀寫 R2；下一次受保護發布前仍須歸檔新版本並讀回核對，不能把舊 R2 原件聲稱為本次 bytes。

新披露批次保留非東亞配置／持倉，僅重建東亞 40 隻並為永明兩筆已核實 N/A 加入追溯欄位；不是全受託人便覽都重新抽取。

## 6. 本機驗證及收貨證據

- 實際 `parse-fact-sheets` CLI 對四個 SHA 已核對的 PDF：69 returns、2 fundPeriodNotDisclosed、0 failures、0 unsupported；非 hidden XML 流程與原件 probe 一致。
- 既有 coverage 333、Web 115、API 80 個測試通過；四個 workspace typecheck 通過。僅延伸既有 assertion 與真實 fixture，沒有新增測試案例。
- Web production build／API dry-run bundle 已驗證，沒有部署遠端。
- 首輪 E2E 因自訂快照名稱不符既有格式而 64 pass／2 fail；調整隔離名稱後通過。加入官方 N/A 顯示後的最後完整流程為 66 pass（34.9 秒）／0 skipped／0 flaky。桌面及 390px 手機已目視核對回報表的 N/A、日期及原文頁數。
- Windows 根目錄 format check 因 61 個既有 CRLF 檔案停下。Linux CI #803 找到檢查查詢不支援的 `exact` 選項，修正後 #804 的完整 `bun run check`、E2E 及 publication-seed 通過。資料 PR #359 的 #805 發現既有 allocation-map 檢查固定讀取舊批次；現改為讀對照表自己宣告的 source，既有 333 項本機檢查通過，更新後 CI 待確認。
- 正式 seed 路徑在隔離 D1：451 類別、295 overlay、32 比較組、56 DIS 元件、24 計劃完整；API 三年排名 37 筆、excludedStaleCount 258，與 data-quality 一致。
- 三筆原文／API 核對：Sun Life Conservative Class B（507）2.84%；BEA Industry Balanced（212）9.33%；BEA Value Growth（1040）14.73%，均為 6 月 30 日披露且過期。另核對 Income（2239）沒有三年數值，一年仍為 8 月平台 2.58%，帶官方 N/A 日期與原件頁數。
- 全部 40 隻東亞 detail／interpretation API 已核對配置、總和、十大持倉及三桶可用／不可用狀態。
- 本機快照 ID 帶平台、候選、披露、對照表內容 fingerprint，避免同一 ID 改資料而讀到舊快取；沒有更改 production cache policy。
- 人工 diff 覆核了頁面／文字層邊界、類別、N/A 保位、日期、精確配對、完整配置、三桶限制及來源版本。`/code-review` 不可用，本 PR 等效接受仍待確認，不沿用其他 PR 的個別批准。

## 7. 後續與發布邊界

1. 程式及資料 PR 分開，保存最新 head／CI／憑證；必要檢查通過且本次等效覆核獲接受後，按已有授權自行合併。
2. 發布前重算 UTC 當日時效；保存新原件版本、SHA、解析輸出、候選及不可用證據；核對 source-review／disposition，不由測試通過清除來源異常。
3. 每次重建從 `fundPeriodNotDisclosed` 精確配對同一基金披露，附 unavailableFields 及自己的來源；不能為其餘 154 筆未知缺口填 N/A。
4. 150 筆已滿三年的數值缺口及 258 筆 stale，按 [逐計劃解決手冊](2026-09-30-three-year-gap-resolution.md) 找更新來源；季度源仍舊則維持過期。三年累積回報比較另設口徑，不進年率化排名。
5. #355／#356 只有程式與修正資料都合併後才記 repository 修復完成；正式發布及原品牌新版設計另按里程碑確認。目前沒有 production D1／R2／Worker／Pages 操作。

本機修復預覽：`http://127.0.0.1:5181/`，與舊候選的 5180 分開。原 header／風格、多種圖表及來源表保留，本輪補充官方 N/A 狀態。


## 8. 最新 24 計劃跟進表及 PR 狀態

| 計劃 | 總數 | 可排名 | 過期 | 未取得 | 下一步 |
| --- | ---: | ---: | ---: | ---: | --- |
| AIA MPF - Prime Value Choice | 21 | 0 | 18 | 3 | 逐基金／類別及期間 reconciliation；記錄下載、解析或未披露證據 |
| AMTD MPF Scheme | 16 | 0 | 16 | 0 | 核查較新官方原件、hash、實際日期及取得限制 |
| BCOM Joyful Retirement MPF Scheme | 14 | 0 | 7 | 7 | 逐基金／類別及期間 reconciliation；記錄下載、解析或未披露證據 |
| BCT (MPF) Industry Choice | 12 | 0 | 12 | 0 | 核查較新官方原件、hash、實際日期及取得限制 |
| BCT (MPF) Pro Choice | 26 | 0 | 26 | 0 | 核查較新官方原件、hash、實際日期及取得限制 |
| BCT MPF - Simple Plan | 10 | 0 | 10 | 0 | 核查較新官方原件、hash、實際日期及取得限制 |
| BCT MPF - Smart Plan | 14 | 0 | 14 | 0 | 核查較新官方原件、hash、實際日期及取得限制 |
| BCT MPF Scheme Series 800 | 28 | 0 | 22 | 6 | 逐基金／類別及期間 reconciliation；記錄下載、解析或未披露證據 |
| BCT Strategic MPF Scheme | 26 | 0 | 0 | 26 | 已檢便覽沒有三年欄；找獨立官方來源，未知不填 N/A |
| BEA (MPF) Industry Scheme | 12 | 0 | 12 | 0 | 抽取已補齊；找新季度原件，自己的日期重新評估 |
| BEA (MPF) Master Trust Scheme | 17 | 0 | 17 | 0 | 抽取已補齊；找新季度原件，自己的日期重新評估 |
| BEA (MPF) Value Scheme | 11 | 0 | 11 | 0 | 抽取已補齊；找新季度原件，自己的日期重新評估 |
| BOC-Prudential Easy-Choice Mandatory Provident Fund Scheme | 17 | 0 | 3 | 14 | 逐基金／類別及期間 reconciliation；記錄下載、解析或未披露證據 |
| China Life MPF Master Trust Scheme | 10 | 0 | 6 | 4 | 逐基金／類別及期間 reconciliation；記錄下載、解析或未披露證據 |
| Fidelity Retirement Master Trust | 23 | 23 | 0 | 0 | 監察官方更新及 90 日到期；數量不代替準確度 |
| Haitong MPF Retirement Fund | 14 | 14 | 0 | 0 | 監察官方更新及 90 日到期；數量不代替準確度 |
| Hang Seng Mandatory Provident Fund - SuperTrust Plus | 20 | 0 | 9 | 11 | 查年率化／類別；月度累積回報另設同口徑 |
| HSBC Mandatory Provident Fund - SuperTrust Plus | 20 | 0 | 9 | 11 | 查年率化／類別；月度累積回報另設同口徑 |
| Manulife Global Select (MPF) Scheme | 29 | 0 | 12 | 17 | 逐基金官方代碼／類別核對；累積與年率化分開 |
| Manulife RetireChoice (MPF) Scheme | 39 | 0 | 0 | 39 | 已檢便覽沒有三年欄；找獨立官方來源，未知不填 N/A |
| MASS Mandatory Provident Fund Scheme | 14 | 0 | 14 | 0 | 核查較新官方原件、hash、實際日期及取得限制 |
| My Choice Mandatory Provident Fund Scheme | 17 | 0 | 3 | 14 | 逐基金／類別及期間 reconciliation；記錄下載、解析或未披露證據 |
| SHKP MPF Employer Sponsored Scheme | 10 | 0 | 8 | 2 | 逐基金／類別及期間 reconciliation；記錄下載、解析或未披露證據 |
| Sun Life Rainbow MPF Scheme | 31 | 0 | 29 | 2 | 29 值及 2 官方 N/A；找新季度原件並保存版本 |

合計 451＝37 可排名＋258 過期＋156 未取得。表中下一步是待辦，沒有把待查來源寫成已取得。成立年期不足的 6 筆須保留獨立原因；只有原文明確的 2 筆使用官方 N/A。

- 程式修復：[PR #358](https://github.com/Kirkwongcn/KWMPF/pull/358)，target main。
- 7 個資料檔案：[PR #359](https://github.com/Kirkwongcn/KWMPF/pull/359)，依賴 #358；先分開覆核，合併前重新核對 main 差異。
- 預設最新 disclosures／map 產生的 seed 與本機讀回驗證版本逐位元相同，SQL SHA-256：`936a6f38263219dab4c3fdc67121fdc7ccc0f9faa64d5cf37a8f8d528c6725c6`。
- 使用者於 2026-09-30 在本次等效覆核、合併請求後回覆「批准合法及發佈」，按上下文作批准合併及發布，接受 #358／#359 已完成的人工覆核作等效憑證；沒有聲稱不可用的 `/code-review` 曾執行。必要 gate 全通過後依序合併並發布，保存原件版本、備份、release tuple 與公開驗證。

## 9. 合併及發布批准紀錄

- 修復程式 `b9be566` 的 CI #806、修復資料 `1fe43a2` 的 CI #807，完整 verify、E2E 及 publication-seed 通過；先前 high-risk-review 僅因本次等效接受尚未記錄而失敗。
- 本次批准涵蓋兩個 PR 合併及本次正式發布里程碑；部署沿用受保護 production workflow，在 mutation 前完整備份 production D1、保存 private R2 並讀回驗證，然後 publication seed／migration、Worker／Pages 及 smoke checks。
- 發布前仍須保留新原件版本並核對 SHA；平台來源使用已接受且對應 exact source／report 的 review-disposition，不由批准清除來源異常。R2 保留原本不自動到期的決定。
- 發布完成才記錄 production snapshot、備份 ID、Worker／Pages deployment ID 及正式站抽查；目前本段是批准及操作次序，不是完成發布的證明。
