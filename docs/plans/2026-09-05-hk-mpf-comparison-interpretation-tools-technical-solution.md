# 香港強積金比較網站:計劃/基金比較與解讀工具技術方案

研究日期:2026-09-05
狀態:方案草案;承接 `2026-09-05-hk-mpf-comparison-interpretation-tools-scope.md` 嘅範圍定案,未開始實作
前置文件:`2026-08-08-hk-mpf-technical-solution.md`(整體架構)、`2026-08-08-hk-mpf-comparison-v1-implementation-spec.md`(v1實作規格)

## 建議方案概要

呢份文件唔重新設計整體架構,只描述「大/中/小」三層比較功能點樣加落現有 KWMPF 系統(Cloudflare Workers API + D1 + React 前端)。實測現有程式碼後,發現大部分底層基建已經存在,新增工作集中喺:(1) 新嘅衍生統計(比較組別平均值)、(2) 計劃層級聚合 API、(3) 規則式文字解讀模組、(4) 前端三個新/改頁面。

## 可直接複用嘅現有基建

- **DIS表現**:核心累積基金、65歲後基金本身已經以一般 `fund_class` 追蹤緊回報同風險,唔使開新資料源;只需要喺標準化資料層加一個明確標籤(`isDisComponent: "core_accumulation" | "age65_plus"`),按基金名稱**完全匹配**(唔做模糊比對,跟現有 `fact-sheet-allocation-pairing.ts` 原則)辨識,兩隻對唔中就整個計劃當「DIS表現官方未提供」。
- **自訂期間計算**:`packages/coverage/src/custom-ranking.ts` 已經有點對點累積回報(最少12個月、只計完整月份、缺月份唔插值)嘅邏輯,小層A解讀工具嘅自訂開始/結束月份直接複用呢個模組,唔重寫。
- **3年波幅**:`custom-ranking.ts` 嘅波幅計算已經用緊36個月做基礎,中層嘅風險指標及小層A嘅「波幅對比」因素都食呢一份現成計算。
- **比較組別**:`apps/api/src/comparison-group.ts` 已經係 Lipper 分類口徑,中層嘅分組直接沿用,唔另建分類邏輯。

## 新增/擴充資料設計

### 1. comparison_group_stats(新增衍生表,每個 publication snapshot 各一份)

喺 `publish` 階段計算並凍結每個比較組別嘅平均值:

| 欄位 | 用途 |
|---|---|
| snapshot_id | 對應 publication_snapshots |
| comparison_group | Lipper 分類(或平台分類前綴組) |
| avg_allocation | 組別平均資產配置(JSON,按資產類別) |
| avg_top10_concentration | 組別平均十大持倉集中度(%) |
| avg_volatility_3y | 組別平均3年波幅 |
| fund_count | 參與計算嘅基金數目(資料不足/待核實嘅基金唔計入平均) |

呢張表只喺 publish 階段由 comparison engine 計算一次,網站請求時直接讀,唔即場算,跟現有「網站唯讀存取已發布資料」原則一致。組別成員少於某個門檻(例如3隻基金)嘅平均值標示 `insufficient_sample`,唔畀解讀工具引用嚟做對比。

### 2. fund_class 標籤擴充

- `isDisComponent` 標籤(見上)。
- 中層新增 3年回報:延伸現有 `annualizedReturn1y/5y/10y` 結構加 `annualizedReturn3y`,計算方式跟 1/5/10 年一致(非custom-ranking果套點對點邏輯,用返平台/便覽已披露嘅年率化數值;冇官方3年年率化數值嘅基金顯示「官方未提供」,唔用月度序列反推)。

### 3. 計劃層級聚合(大層,新增)

新增一個 build 階段輸出(唔開新 D1 表,聚合喺 publish 時計算並存入 snapshot payload,同現有 `fund_class_versions` 做法一致):

- 受託人、基金選擇數目、FER範圍(沿用 SchemesPage 已有嘅 `managementFee` 結構)
- DIS表現:兩隻DIS基金各自嘅 1/3/5/10年回報(缺一隻就整個計劃嘅DIS表現顯示不完整,唔補算)
- 行政評分:**v2 預留欄位,v1唔輸出**(見下方「待定項」)

## 新增/擴充 API

- `GET /schemes/compare?ids=a,b,c,d`:回傳最多4個計劃嘅聚合資料(受託人、基金選擇數目、FER範圍、DIS表現)。超過4個回400。
- `GET /rankings?comparisonGroup=X&period=3`:擴充現有 `/rankings`,`period` 支援新增 `3`。
- `GET /fund-classes/:id/interpretation?startMonth=&endMonth=`:回傳解讀工具A嘅輸出——3個因素各自嘅數值(基金 vs 組別平均)同套版後嘅解讀文字。冇自訂月份時預設用近1年。

## 小層A:規則式文字解讀模組

用戶揀咗規則式範本(唔用AI,冇額外API成本),設計為純函數:輸入基金數值+組別平均數值,輸出固定句式嘅文字,例如:

- 資產配置差異:「呢隻基金嘅股票配置比同組別平均高/低 X 個百分點」(門檻內($≤2個百分點)顯示「與同組別平均相若」)
- 十大持倉集中度:「十大持倉佔比 X%,比同組別平均高/低/相若」
- 波幅對比:「3年波幅 X%,比同組別平均高/低/相若」

門檻值(例如「相若」嘅範圍)寫成設定檔,可日後按實際數據調整,跟現有異常門檻「配置化並保留變更紀錄」嘅慣例一致。呢個模組冇AI/LLM呼叫,唔產生額外查詢成本。

## 前端頁面/元件

- **SchemesPage 擴充**:加「揀計劃比較」checkbox(上限4個)+比較按鈕,跳轉新頁 `/schemes/compare`。
- **新頁面 SchemeComparePage**:表格逐項對比(詳細版)+ 雷達圖(受託人數量、FER、基金選擇數目、DIS回報標準化做0-100分視覺化,唔混合做單一總分)。
- **RankingsPage 擴充**:period 選項加「3年」。
- **FundClassPage 擴充**:加「解讀」分頁——期間選擇器(1/3/5年掣+自訂開始/結束月份,預設1年)+ 3項因素嘅文字解讀 + 對應圖表(長條圖或雷達圖顯示基金 vs 組別平均)。

## 待定項(v1唔做,留返之後)

- **行政評分**:保留喺「大」層,但降做v2。方法論未定——冇官方或恆常嘅強積金服務評分來源,需要另外決定評分維度(例如客戶查詢回應時間、電子結單、手機App)、資料蒐集方式及更新頻率,呢個屬於獨立一份研究/規格文件,唔喺呢份技術方案處理。
- **C(宣傳vs事實對照)**:已在範圍文件定為v2,需要新增文字擷取(factsheet投資策略描述+KFS/brochure賣點描述),擷取方法同解析規則要跟現有 `fact-sheet-allocation.ts` 一類「座標優先、唔靠模糊比對」原則另立規格。

## 實作前必須確認

1. `comparison_group_stats` 嘅樣本量門檻(幾多隻基金先算「足夠」出組別平均)。
2. DIS基金名稱嘅完全匹配清單要逐計劃人手核對一次(核心累積基金/65歲後基金喺唔同受託人可能有唔同中英文全名)。
3. 3年年率化回報嘅官方資料來源(邊份文件有披露,定係淨係得便覽)要先核實,唔可以假設全部計劃都有。
4. 規則式範本嘅門檻值(例如「相若」範圍)需要業務/內容審視,唔係純技術決定。

完成以上確認後,先可以拆 GitHub issue 落實作。
