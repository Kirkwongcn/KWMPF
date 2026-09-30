# KWMPF 全流程審視與網站改版跟進手冊

審查日期：2026-09-30（資料時效按 UTC 日界評估）。

基線：`main fef19f9a543783af6e3e21b4b11dfce3dddeb38e`；正式站資料截至 2026-08-31。
本輪分支：`codex/kwmpf-review-redesign-20260930`。本輪尚未正式部署。

## 1. 判斷及使用者已確認的方向

現有 React / Vite、Hono Worker、D1、私有 R2 架構，具備正式資料比較網站的基本發布及復原能力。仍未達到可以宣稱「完整、持續更新的專業研究平台」的程度：三年回報時效缺口、受託人新文件發現、正式效能／可用性監察，以及連續時間序列仍需跟進。檢查通過不能替代逐份來源覆核，也不等於 WCAG 或金融資料認證。

使用者確認一般成員與深入研究同等重要，採用**簡潔首頁，加深入分析模式**。比較組平均最少三隻；±2 百分點解讀門檻保持試用，待驗證。季度三年回報最長 90 日，其餘回報按既有 45 日政策。這些是網站採用的時效規則。

## 2. 現時資料時效

最新平台批次：`data/sources/2026-09-26/mpf-fund-platform.json`，抓取時間 2026-09-26T05:07:28.559Z，官方截至日期 2026-08-31。共有 451 個基金類別、24 個計劃、11 個受託人。抓取日期不會取代官方截至日期。

本機使用與 production 相同的 `build-staging-seed.ts` 路徑，套用現有 249 筆 trustee return observations，再查詢新 API。2026-09-30 的分母均為 451：

| 年率化期間 | 符合網站時效 | 過期 | 官方未提供 | 未核實 |
| --- | ---: | ---: | ---: | ---: |
| 1 年 | 447 | 0 | 4 | 0 |
| 3 年 | 37 | 212 | 202 | 0 |
| 5 年 | 427 | 0 | 24 | 0 |
| 10 年 | 358 | 0 | 93 | 0 |

三年資料日期介乎 2025-12-31 至 2026-08-31；其餘表列期間為 2026-08-31。三年排名實際回傳 37 筆，`excludedStaleCount=212`。不能沿用早前發布時的 209 筆排名數量，亦不能靠重抓舊 PDF、修改抓取時間或放寬門檻令舊數據變新。

新增 `/data-quality` 及離線 `scripts/audit-source-freshness.mjs`。前者評估已發布 payload；後者只作候選資料衛生報告，**不授權發布**。未知基金、重複觀察、重複基金 ID 及不支援期間會報錯；未來與不存在的日期會標示失效。

### 法定披露與網站門檻

積金局資料披露頁列出便覽的最低刊發頻率及財政期後發布期限，不能將所有便覽概括成同一 45／90 日期限。本輪修正詳情頁把網站門檻稱為「官方披露寬限期」的文字。[積金局資料披露](https://www.mpfa.org.hk/mpf-investment/investment-regulations-and-disclosure/disclosure-of-information)。

## 3. 來源搜尋與更新流程

建議執行順序：官方登記冊確認計劃身分 → 受託人官網目錄找最新期別 → 下載並封存原件／雜湊 → 按基金／類別及期間嚴格配對 → 抽取及異常檢查 → 人工核對 → 候選 PR → publication seed → 受保護發布 → 公開 API／頁面核實。

現時每週平台 refresh 與 trustee manifest 並非完整的新期別發現流程。58 份 PDF 下載成功，只能證明指定 URL 可讀，不能證明指定 URL 已是最新。

例子：現有 trustee manifest 指向 AIA 2026 年 5 月便覽；2026-09-30 官網目錄已列出 2026 年 6 月。應先建立新候選及驗證內容；6 月的日期亦可能已超出 90 日，所以換檔不等於三年數據合資格。[AIA 官網便覽目錄](https://www.aia.com.hk/en/products/useful-tools-and-information/knowledge-and-insight/mpf-fund-performance-review)。

對來源搜尋的收貨標準：

- 每個受託人記錄官方目錄 URL、發現時間、最新可見期別、選取 URL、HTTP／解析結果及退回原因。
- 比較期別及文件雜湊，不憑 URL 檔名或下載成功判斷新舊。
- 451／403／不可下載與「官方未提供該數字」分開記錄；不繞過存取限制。
- 新期別有一塊披露抽取不完整，該塊 fail closed，保留原因；不以另一基金補位。
- 新來源資料超過一千行時，與本輪 code PR 分開，遵守既有改動政策。

## 4. 準確度及原文抽查

本輪三筆端到端核對如下。兩筆東亞回報仍顯示原值，但因期別過舊不參與排名：

| 基金 ID | 官方三年年率化 | 官方截至 | 本機結果 |
| --- | ---: | --- | --- |
| mpfa-cf-1039：BEA MPF Conservative Fund | 2.63% | 2026-06-30 | 2.63%，92 日，stale |
| mpfa-cf-1040：BEA Growth Fund | 14.73% | 2026-06-30 | 14.73%，92 日，stale |
| mpfa-cf-1420：Fidelity SaveEasy 2050 Fund | 12.34% | 2026-07-31 | 12.34%，61 日，verified |

東亞 PDF 原件第 2、6 頁已在本機渲染並視覺核對；期別亦對照官方原件。富達核對官方 PDF 的文字內容及日期；本次直接下載受來源存取限制，未取得新的本機 binary，不能宣稱完成富達原件位元組重驗。[東亞官方 PDF](https://www.hkbea.com/pdf/fund-fact-sheet/2026/mpf-vs-2026-2nd.pdf)，[富達官方 PDF](https://www.fidelityinternational.com/legal/documents/HK-zh_en/hffs.HK-zh_en.HK.H-CS50.pdf)。

整批候選、嚴格配對及既有解析測試另有報告；上述三筆只是本輪 publication-seed 抽查，不表示本輪逐字核對了 451 個基金類別的全部欄位。

保留的紅線：官方原值精度、`n.a.` 不當零、每個來源自己的日期、基金類別身分嚴格配對、非官方分類明示、缺失不估算。原數值不固定小數位；衍生 FER 中位數才採最多五位小數並標示本站統計。

## 5. 本輪已落實的改動

| 範圍 | 改動 | 收貨證據 |
| --- | --- | --- |
| 首頁與導覽 | 搜尋及實際資料可用度先行；簡潔／深入選擇保留於 URL 和本機 | 同一 snapshot 檢查、桌面及手機流程 |
| 中文搜尋 | 明示常用名稱別名，NFKC 正規化，多詞可跨名稱／計劃／受託人匹配 | 滙豐、富達、保守基金等測試；官方名稱不改寫 |
| 完整結果 | 預設按官方名稱排序；50 筆分頁、總數、返回／前進、可選指標排序 | 滙豐 77 筆，兩頁 50／27；不重複首頁結果 |
| 基金比較 | 1 至 4 個類別，跨頁選取，逐期原值／日期／來源／過期標示 | 同 snapshot 防護及跨頁 E2E |
| 排名 | 同組圖表／完整表格切換，保留期間及組別；深入模式 CSV | 圖表與原值共用數據；CSV 保留負數及 1.205 精度，防止名稱公式注入 |
| 計劃比較 | 移除合成標準分雷達；基金數與 FER 用實際單位；DIS 逐筆披露 | 每類別各期間原值、日期、來源、時效及基金詳情連結 |
| 基金詳情 | 三年回報自己的日期、年率化與曆年圖分開、配置及持倉實際比例 | 缺失不畫零、不造每日走勢、不把局部配置補成 100% |
| 資料狀態／方法 | 新頁交代分母、時效、非官方分類、資料缺口 | `/data-status`、`/methodology` |
| 快取 | ETag 綁定 URL、query、資料版本、release 與 UTC 日；先驗 route 再答 304 | 不同期間／頁碼／版本不同 validator；400／404 不被 matching hash 掩蓋 |
| 顯示及手機 | 單層內容面板、表格可橫向捲動及鍵盤操作、44px 控制項、來源可讀 | 桌面 1440×1000／手機 390×844 分段截圖；320px 流程 |
| 可發現性 | 有效 robots.txt、llms.txt；移除不用的舊 hero 圖 preload | 本機 Lighthouse；不等於已驗證搜尋引擎收錄 |

圖形是由實際 API 數據產生的原生圖表。沒有新增 AI 圖像，也沒有將不完整數據包裝成趨勢。

## 6. 測試及設計覆核紀錄

- 本機 API：80／80；Web：115／115；coverage：333／333；候選時效工具：4／4。
- 桌面／手機 E2E：66／66，0 skipped，0 flaky；以本機正式打包版本及最新批次隔離 D1 執行。
- Web／API／coverage TypeScript 檢查通過；Web production build 及 Worker dry-run bundle 通過。
- 本機手機首頁及深入排名頁 Lighthouse：accessibility、best-practices、SEO、agentic-browsing 均 100；首頁 55／排名 56 passed、0 failed。這不是全站／WCAG 認證。
- 本機首頁 trace：LCP 84ms，CLS 0，沒有 CPU／網絡節流；無 CrUX。不能與正式環境的不同路由／網絡直接比較，也不能推斷 field INP。
- Impeccable 原獨立 finish review 提出五項有限修正：DIS 追溯、網站門檻措辭、圖表切換、巢狀面板、glyph arrows；最終 verdict 為 `ship`，五項均 resolved。這個 verdict 只涵蓋列出的修正，不是 engine／catalogue quality ceiling 的全站認證。
- 最終視覺證據：本機 task `outputs/redesign-final/`；首次過長截圖及未載入完成的截圖已棄作驗收證據。
- Skill engine、hooks、seed catalogue 未執行／未下載；採已讀直接文件及 code-led fallback，不能聲稱 engine gate／detector 已通過。
- Windows 本機沒有完整執行根目錄 `bun run check` 的 Bash suite；現有未改 shell 套件由 GitHub CI 再檢查。根目錄預設 format check 在既有 CRLF checkout 顯示警告；`--end-of-line auto` 可分辨環境差異，沒有為消除警告重寫原件或 disposition bytes。實際本機各項與 CI 結果分開記錄。

## 7. 專業架構的未完成項目

| ID／優先序 | 尚欠／影響 | 下一步及收貨條件 |
| --- | --- | --- |
| DATA-01／P1 | 三年回報大部分過期或未提供，限制研究覆蓋 | 逐受託人尋找更新期別；候選來源核對、獨立資料 PR、seed 抽查；合資格數只按真實日期增加 |
| DATA-02／P1 | 靜態 manifest 未保證最新；每週平台抓取不等於 trustee 更新 | 建立目錄發現 adapter、期別與 SHA 比較、退回／異常報告；先做 AIA、BEA、Fidelity 的 golden cases |
| OPS-01／P1 | 缺乏已核實的正式可用性／失效來源警報及每日時效報告 | 定義監察端點、告警條件、可用度／延遲 SLO、連續失敗及時效漂移；確認通知管道後才啟用 |
| OPS-02／P1 | 發布期間，cache middleware 讀的 snapshot 與 route 另讀的 publication 可在切換時不同 | API 在單一請求固定 snapshot；並行發布測試 body/header/cache 一致；多基金比較沿用同 snapshot 防護 |
| OPS-04／P1 | 2026-09-30 main branch API 所列 required check 只有 verify；E2E／high-risk-review 仍靠合併程序遵守 | 核實全部 rulesets 與管理員實際權限；將必要 PR checks 納入保護設定並驗證失敗時不能合併。本輪不繞過任一必要檢查 |
| DATA-03／P2 | canonical 每日 active／七日停辦判定尚未完全自動化 | 官方名冊每日差異及七日狀態 fixtures；不能只把每週 current flag 當日查核 |
| DATA-04／P2 | FER 披露的歷史財政期未全面結構化 | 新增 FER own reporting period，與平台快照日期分開；不能把平台日當 FER 財政期 |
| API-01／P2 | `/search` 仍讀取整批 JSON 再篩選，451 類別現可運行 | 先量度 P95／payload／D1 用量；規模或延遲達標前再決定索引／FTS，而不是無證據重寫 |
| API-02／P2 | 大型 index.ts、payload type cast、跨 app 搜尋 helper 匯入 | 拆路由／共享純 helper；加入 payload runtime contract；以同一 fixtures 保證不變更資料語義 |
| WEB-01／P2 | CSR metadata 不代表各基金已被搜尋引擎充分收錄 | route-specific title/description、canonical、sitemap 及適當 prerender；驗證 HTTP status 與實際收錄 |
| PERF-01／P2 | 本機 lab 結果無法代表香港手機用戶 field CWV | staging／正式香港路徑、受控節流、多次 trace、實際 INP／LCP／CLS；先核實監察與私隱方式 |
| A11Y-01／P2 | 自動及鍵盤檢查不覆蓋全部輔助技術 | 讀屏、放大、長名稱、色覺及更多手機真機抽查；記錄缺陷和重現步驟 |
| CI-01／P2 | 高危路徑清單未覆蓋所有出街資料轉換 helper | 審查 data-quality/search/cache 的風險，與 CODEOWNERS 同步更新；本輪仍主動提供人工覆核與 seed 證據 |
| OPS-03／P2 | R2 沒有自動到期（使用者已選擇保留），仍需容量成本觀察 | 保留既有政策；訂容量、備份大小及成本 review，不自行刪物件 |
| PRODUCT-01／P3 | 沒有每日單位價格／連續時間序列，不能自訂日期回測 | 先核實官方來源、權利、頻率及覆蓋，再作獨立產品決策；目前 UI 明示限制 |
| PRODUCT-02／P3 | ±2pp 解讀試用門檻尚未驗證 | 人工標註案例、樣本覆核及穩健性報告；使用者已決定保持試用 |

P1 是下一輪必須優先處理的可靠性／資料可用度工作；不是聲稱本輪已全部修復。

## 8. GitHub Actions 使用量與發布

套用 `github-actions-efficiency` 的審查：目前 PR 跑 verify／E2E／高危憑證，main push 只跑 verify；有 lockfile-keyed Bun cache、concurrency 取消舊 CI、workflow/docs scope 分流。本輪不新增重複 refresh／deploy 工作，也不移走必要 gate。

發布前須記錄：PR head、CI 結果、seed 來源與 overlay、三筆核對、最終設計 verdict、發布 tuple、備份／復原點、正式 summary／排名及每期時效數量。每到新的 UTC 日或來源變更，重新計算數量，不能直接引用本手冊的 37 筆作永久門檻。

`/code-review` 指定工具在本環境不可用。使用者於 2026-09-30 明確接受 PR #354 的人工 diff 審查作等效證據；PR 記錄日期、搜尋、快取、原值及來源追溯覆核，並沒有聲稱不可用命令曾執行。依使用者既有授權，必要憑證及 CI 齊備後可自行合併；最終新設計公開發布仍按 AGENTS 里程碑要求確認。

PR：[#354](https://github.com/Kirkwongcn/KWMPF/pull/354)。首輪 CI #798 的 Linux `bun run check` 通過。CI 固定的較舊批次會走空排名分支，該分支仍有三處 E2E locator 尋找舊「官方披露寬限期」文案，造成 10 failed／56 passed；已同步為實際介面的「網站時效門檻」，保留空結果及過期原因斷言，沒有降低日期政策或略過測試。完整最新 CI 結果以 PR checks 為準。

## 9. 日後跟進清單

1. 打開本手冊及 `DESIGN.md`，確認當前 head、正式 release 和資料截至。
2. 重新取 `/data-quality`／三年 `/rankings`，記錄 UTC 評估日與數量。
3. 按 DATA-01／02 的受託人清單找新期別；原件、候選、解析及發布分段驗收。
4. 每項工作填 ID、狀態、實際證據、PR、CI、公開驗證及未解限制。
5. 新介面沿用 DESIGN tokens、數字與來源規則；新增圖表先確認資料支持甚麼，不支持甚麼。
6. 合併與正式部署分開記錄；正式發布完成後才把本手冊的「尚未部署」改為實際 release。
