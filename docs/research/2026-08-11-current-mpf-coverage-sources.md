# 香港現行強積金覆蓋清單：官方來源研究

日期：2026-08-11（香港時間）
範圍：現行可供選擇的註冊強積金計劃、成分基金及基金類別；不把已終止接受新供款的歷史基金納入公開排名。

## 結論

覆蓋清單不應由單一頁面決定。可重現而較穩妥的做法，是以積金局三組官方資料建立候選清單，再用受託人的最新 Key Scheme Information Document（KSID）、計劃說明書或基金名單核實：

1. **計劃及基金類別候選全集**：MPF Fund Platform 的 Fund Information Table。2026-06-30 版本顯示 382 隻成分基金；直接下載的 HTML 內有 451 個獨立 `cfid`，差額源於部分成分基金設有多個基金類別。[MPF Fund Platform — Fund Information Table](https://mfp.mpfa.org.hk/eng/mpp_list.jsp)
2. **計劃及成分基金法定身份**：積金局「Registered MPF Schemes and Constituent Funds」公共登記冊。總表及每個 `schId` 詳情頁列出計劃、受託人、成分基金、批准日期、KSID、基金概覽及年報；頁面於 2026-08-10 修訂。[MPFA — Registered MPF Schemes and Constituent Funds](https://www.mpfa.org.hk/en/info-centre/public-registers/registered-mpf-schemes)
3. **當前營運範圍及總數控制**：MPF Fund Platform 的「MPF Schemes by Asset Size」PDF。2026-06-30 檔案列出 24 個計劃、11 名現正管理這些計劃的受託人，並逐計劃列出成分基金數及基金類別數。[MPF Schemes by Asset Size](https://mfp.mpfa.org.hk/eng/mpp_download_asset_size.jsp)
4. **受託人身份全集**：積金局 Approved Trustees 登記冊；截至 2026-08-10。這是「獲核准受託人」全集，不等同「現時仍有可選計劃的受託人」集合。[MPFA — MPF Approved Trustees](https://www.mpfa.org.hk/en/info-centre/public-registers/mpf-approved-trustees)
5. **最終核實**：每個計劃最新 KSID／計劃說明書和受託人官方基金名單。公共登記冊本身警告資料及受託人文件均可能有上載時差，因此發生衝突時不能只信總表。[MPFA — Registered MPF Schemes and Constituent Funds](https://www.mpfa.org.hk/en/info-centre/public-registers/registered-mpf-schemes)

因此，第一版的 `current/selectable` 規則應是：公共登記冊仍列為註冊計劃、其詳情頁仍列出該成分基金，而且最新受託人文件仍把它列作可選基金；基金類別則由 Fund Platform 及最新費用／KSID 文件共同確認。任何一層不一致，標記 `pending_verification`，不加入排名。

## 可重現取得方法

### 1. MPF Fund Platform：基金類別候選清單

`GET https://mfp.mpfa.org.hk/eng/mpp_list.jsp` 返回伺服器產生的 HTML，不需要登入。應保存原始 HTML、HTTP 擷取時間及頁面顯示的 `Latest information as of`。解析每個基金列的：

- `cfid`（「More」按鈕屬性；屬性值周圍可能含換行及空白）
- 計劃名稱、基金顯示名稱（通常已包含 Class）、受託人簡稱
- 基金類型／類別、成立日、基金規模、風險、FER、回報及管理費
- 計劃文件連結內的 `schId`

每個基金類別詳情可用 `GET https://mfp.mpfa.org.hk/eng/cf_detail.jsp?cf_id=<cfid>` 重取。詳情頁明確分開受託人、計劃、成分基金及 Fund Class，也提供資料日期和計劃文件入口。[MPF Fund Platform — example fund-class detail](https://mfp.mpfa.org.hk/eng/cf_detail.jsp?cf_id=429)

重現檢查：

- 頁首成分基金數應為 **382**（2026-06-30 快照）。
- HTML 解析所得獨立 `cfid` 應為 **451**；不可把 382 誤當基金類別數。
- 逐計劃聚合的成分基金／基金類別數，應與「MPF Schemes by Asset Size」PDF 相符。
- `cfid` 是平台導航鍵，未見積金局承諾它是永久業務識別碼；資料庫應另建版本化內部 ID，並保存 `cfid` 作來源鍵。

### 2. MPFA 公共登記冊：計劃及成分基金核實

總頁 HTML 宣告資料端點 `/api/dataintegration/GetSchemesConstituentFundsJson`，但在本次非瀏覽器 HTTP 測試中該路徑轉往 404；不能把它當穩定公開 API。可重現流程應使用瀏覽器取得總表，或以總表產生的 `schId` 詳情 URL 逐頁封存；不要依賴未有公開契約的內部 JSON 路徑。

詳情頁格式為：

`https://www.mpfa.org.hk/en/info-centre/public-registers/registered-mpf-schemes/detail?schId=<SCH...>`

例如 Haitong 計劃頁同時列出受託人、成分基金和批准日；這類頁面是成分基金身份的主要核對來源。[MPFA — Haitong MPF Retirement Fund](https://www.mpfa.org.hk/en/info-centre/public-registers/registered-mpf-schemes/detail?schId=SCH000000000020)

每次擷取需保存：`schId`、中英文計劃名、計劃類型、財政年結日、註冊日、受託人、全部成分基金及批准日、各文件 URL、頁面修訂日。另須擷取「Movement ... during the last 12 months」，以偵測合併、終止和身份變動。[MPFA — Movement of Registered MPF Schemes](https://www.mpfa.org.hk/en/info-centre/public-registers/registered-mpf-schemes/movement-mpf-schemes)

### 3. 受託人最新文件：可供選擇狀態的最終核實

公共登記冊的每個計劃詳情頁已集中連結受託人提交的 KSID、基金概覽及年報，適合做一致入口；另外應核對受託人自己網站的當前基金頁。已驗證可直接使用的一手來源包括：

| 受託人／計劃群 | 官方核對入口 | 可核對內容 |
|---|---|---|
| AIA Company (Trustee) Limited | [AIA MPF fund list](https://www.aia.com.hk/en/products/mpf/list) | Prime Value Choice 當前基金、估值日、風險級別、fact sheet |
| Manulife Provident Funds Trust Company Limited | [Manulife MPF fund information](https://www.manulife.com.hk/en/corporations/products/mpf/fund-information.html) | Global Select 當前 29 隻成分基金及計劃文件 |
| Sun Life Trustee Company Limited | [Sun Life Rainbow fund prices and performance](https://www.sunlife.com.hk/en/investments/mpf-orso-fund-prices-performance/) | 當前 Rainbow 基金；亦明列三個舊計劃已於 2023 年併入 Rainbow |
| HSBC Provident Fund Trustee (Hong Kong) Limited | [HSBC MPF fund information](https://www.hsbc.com.hk/mpf/funds/) | HSBC 計劃的成分基金、價格及基金文件；Fidelity／Haitong 仍須用各自 KSID 核實 |
| Bank Consortium Trust Company Limited | [BCT fund information](https://www.bcthk.com/en/mpf-orso/fund-information/fund-performance/) | BCT 各計劃基金表現；涉及品牌／受託人轉移的計劃必須再核對最新 KSID |
| Bank of Communications Trustee Limited | [BCOM MPF constituent fund prices](https://www.bocomtrust.com.hk/BankCommSite/shtml/trust/en/2600850/2600851/2600852/2600941/2600943/list.shtml?channelId=2600850) | Joyful Retirement 當前基金及價格 |
| China Life Trustees Limited | [China Life MPF constituent fund prices](https://trustee.chinalife.com.hk/mpf/dailyPrices?request_locale=en) | Master Trust 當前基金名稱及每日價格 |
| BOCI-Prudential Trustee Limited、Bank of East Asia (Trustees) Limited、YF Life Trustees Limited、Standard Chartered Trustee (Hong Kong) Limited | [MPFA scheme repository](https://www.mpfa.org.hk/en/info-centre/public-registers/registered-mpf-schemes) | 以個別 `schId` 頁面的最新 KSID／基金概覽為固定入口；外部網站版面和 URL 較易改動 |

受託人網站的「每日基金價格」可證明基金仍在報價，但單憑仍有價格不能證明仍接受新供款；已封閉的歷史基金也可能繼續估值。最終可選狀態必須由最新 KSID／計劃說明書的「fund choices」及近期變動通知確認。

## 已發現的衝突及限制

1. **資料日期不同**：Fund Platform 及 asset-size PDF 截至 2026-06-30，公共登記冊截至 2026-08-10。前者適合建立帶數值的候選快照，後者較適合判定最新法定身份；不可把兩個日期混成同一快照。
2. **受託人／品牌轉移有時間差**：2026-06-30 asset-size PDF 已把 `BCT MPF Scheme Series 800` 列於 Bank Consortium Trust Company Limited，但部分被搜尋引擎封存的舊 Fund Platform 詳情仍顯示 `Principal MPF Scheme Series 800`／Principal trustee。應以最新公共登記冊、KSID 和當日抓取頁面解決，不沿用搜尋索引文字。[MPF Schemes by Asset Size](https://mfp.mpfa.org.hk/eng/mpp_download_asset_size.jsp) [MPF Fund Platform — older-labelled example](https://mfp.mpfa.org.hk/eng/cf_detail.jsp?cf_id=444)
3. **成分基金不等於基金類別**：asset-size PDF 明言，一隻成分基金可因帳戶類型或僱主規模提供不同 classes，並收取不同管理費。因此比較及費用資料的最小單位必須是基金類別；公共登記冊只足以核對成分基金層。[MPF Schemes by Asset Size](https://mfp.mpfa.org.hk/eng/mpp_download_asset_size.jsp)
4. **公共登記冊有官方承認的時差**：MPFA 說名單未必最即時，受託人文件亦可能在收取與刊登之間有延誤；故「三方一致才發布」是必要規則，不是額外保守假設。[MPFA — Registered MPF Schemes and Constituent Funds](https://www.mpfa.org.hk/en/info-centre/public-registers/registered-mpf-schemes)
5. **公開用途條款**：公共登記冊頁面稱其用途是讓公眾考慮參與計劃，並禁止用於該目的以外的用途。正式大量擷取及再發布前，應由項目負責人確認使用條款／取得 MPFA 書面許可；研究階段不應推定可任意再分發整份登記冊。[MPFA — Registered MPF Schemes and Constituent Funds](https://www.mpfa.org.hk/en/info-centre/public-registers/registered-mpf-schemes)
6. **HTML 並非公開 API 合約**：Fund Platform 可直接重取，但欄位靠表格位置、空白不規則的 `cfid` 和內部 `schId` 連結；解析器必須保存 fixture、以欄位標題比對，格式變動時安全失敗。

## 建議的覆蓋清單產物及驗收

候選清單每列至少包含：`trustee_source_name`、`scheme_source_name`、`sch_id`、`constituent_fund_source_name`、`fund_class_source_name`、`cf_id`、三層來源 URL／資料日期、`selectability_status`、`conflict_reason`。名稱只作顯示及核對，不作唯一鍵。

每日／每次全量重建依序：

1. 封存 Fund Information Table HTML，解析 382 隻成分基金／451 個基金類別候選。
2. 封存 asset-size PDF，核對 24 個計劃及逐計劃基金／class 數。
3. 封存 Approved Trustees 及 Registered Schemes 總表和 movement 頁。
4. 逐 `schId` 封存詳情與最新 KSID；逐 `cfid` 封存基金類別詳情。
5. 三方一致者標記 `verified` 並另設 `current: true`；任何缺漏、改名、移轉或終止訊號標記 `pending_verification`。
6. 發布前報告必須列出總數差異、新增／刪除、受託人或 `schId` 改變，以及所有未解衝突；不可自動以名稱模糊配對後發布。

上述數字是 2026-06-30 候選快照的驗收基線，不是永久常數。每次執行應以來源自身的資料日期產生新基線，並保留上一個已驗證版本以供差異比較。

## 本次覆蓋快照結果

2026-08-11 重取 Fund Platform 的 451 個 `cfid` 詳情頁全部成功，核對結果為 24 個計劃、382 隻成分基金、451 個基金類別及 11 名受託人，與官方 2026-06-30 總數基線一致。每個候選均保存獨立詳情 URL、基金類別名稱及資料截至日。

其後按4／4／3三批受託人逐項核對最新受託人基金入口／KSID及MPFA計劃文件。451個基金類別均取得三方一致證據，標示 `verified` 及 `current: true`；每項保留獨立平台詳情、受託人文件及正式計劃文件URL與資料日期。重建器仍以 fail-closed 規則處理日後缺漏或身份差異：轉為 `pending_verification`、列明衝突來源及日期，並排除排名。
