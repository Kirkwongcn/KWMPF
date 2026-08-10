# 香港強積金比較網站：資料來源及資料字典研究

研究日期：2026-08-08

## 研究結論

第一版應以積金局的 **MPF Fund Platform** 作為主要標準化資料來源，並以積金局的註冊計劃及成分基金公共登記冊、計劃文件庫及受託人最新文件作交叉核對。MPF Fund Platform 已提供基金資訊表、表現圖表及並列比較功能，涵蓋基金表現、費用、基金風險指標、基金規模及成立日期等欄位。[^1]

積金局的註冊計劃登記冊提供計劃、計劃類型、登記日期、計劃資料文件、基金簡介及年度報告的索引，但頁面本身提醒資料可能存在處理及更新時間差，因此不能把登記冊視為唯一的即時來源。[^2]

## 建議來源層級

### 第一層：主要結構化來源

- **MPF Fund Platform Fund Information Table**：基金名稱、基金類別、計劃、受託人、成立日期、基金規模、回報、FER、風險指標及費用欄位。平台目前以基金類別、計劃及受託人提供篩選和排序。[^3]
- **MPF Fund Platform Constituent Fund detail**：每隻基金的完整欄位、資料截至日期、費用拆分、風險、回報、基金規模及持續成本示例。[^4]
- **MPF Fund Platform glossary**：統一基金類別、基金類別單位、年化回報、累積回報、基金開支比率、基金風險指標及費用的定義。[^5]

### 第二層：官方文件核對來源

- **MPFA Registered Schemes and Constituent Funds register**：核對現行註冊計劃、計劃類型、登記日期及計劃文件連結；登記冊列明其資料可能不是最新完整版本。[^2]
- **MPFA Disclosure of Information / Fee Table**：核對計劃層級及基金層級的加入費、年度費、供款費、買入／賣出差價、管理費、保證費、其他開支及底層基金費用。[^6]
- **受託人最新 Fund Fact Sheet、MPF Scheme Brochure 及 Fee Table**：用於處理平台更新延遲、資料異常及文件中較新或更細緻的解釋。

### 第三層：可靠第三方補充來源

第三方資料只可補充官方資料未覆蓋的欄位，不能覆寫官方回報、費用或風險資料。每個第三方欄位需要保存供應商、原始網址、擷取時間、計算定義及與官方定義的差異。

## 第一版資料字典

### 計劃（Scheme）

| 欄位 | 定義／用途 | 來源優先級 |
|---|---|---|
| scheme_id | 內部穩定識別碼 | 系統產生，需保留來源對應 |
| scheme_name | 計劃正式名稱 | MPFA 登記冊、MPF Fund Platform |
| scheme_type | 計劃類型 | MPFA 登記冊 |
| trustee_name | 核准受託人名稱 | MPFA 登記冊、MPF Fund Platform |
| registration_date | 計劃登記日期 | MPFA 登記冊 |
| financial_year_end | 計劃財政年度結算日 | MPFA 計劃資料 |
| document_links | 計劃簡介、基金簡介、年度報告等文件連結 | MPFA 登記冊及受託人 |
| active_status | 是否屬第一版現行可供選擇範圍 | 需由登記狀態及最新文件核對 |

### 成分基金及基金類別單位（Constituent Fund / Fund Class）

平台把同一成分基金的不同基金類別分開展示，實際上視為獨立投資基金；因此第一版的比較單位應是 **fund_class**，而不是只用 constituent fund 名稱去重。[^5]

| 欄位 | 定義／用途 | 來源優先級 |
|---|---|---|
| fund_class_id | 基金類別單位的穩定識別碼 | MPF Fund Platform，需保存歷史對應 |
| constituent_fund_name | 成分基金名稱 | MPF Fund Platform、基金簡介 |
| fund_class_name | 基金類別單位名稱／標識 | MPF Fund Platform、受託人文件 |
| scheme_id | 所屬強積金計劃 | MPF Fund Platform、MPFA 登記冊 |
| trustee_name | 所屬受託人 | MPF Fund Platform、MPFA 登記冊 |
| fund_type | 六大基金類型 | 基金簡介及 MPF Fund Platform |
| fund_category | 基金類型下的細分類別 | MPF Fund Platform |
| investment_objective | 投資目標及政策摘要 | Fund Fact Sheet／Scheme Brochure |
| asset_allocation | 資產類別比例及範圍 | Fund Fact Sheet／受託人文件 |
| geographic_allocation | 地區分布 | Fund Fact Sheet／受託人文件 |
| sector_allocation | 行業分布 | Fund Fact Sheet／受託人文件 |
| top_holdings | 主要持倉 | Fund Fact Sheet／受託人文件 |
| launch_date | 基金類別首次提供給成員投資的日期 | MPF Fund Platform glossary |
| fund_size_hkd_m | 基金資產淨值，單位為港幣百萬元 | MPF Fund Platform |
| fund_currency | 基金計價貨幣 | 基金文件；目前核對的核准成分基金以港幣計價 |
| dis_flag | 是否為預設投資策略基金 | MPF Fund Platform fund category |

### 回報及風險

| 欄位 | 定義／限制 | 來源優先級 |
|---|---|---|
| annualized_return_1y/5y/10y | 指定期間的複合年化回報，不是簡單平均 | MPF Fund Platform glossary |
| cumulative_return_1y/5y/10y | 起點至終點的累積回報 | MPF Fund Platform glossary |
| calendar_year_return | 各曆年回報 | MPF Fund Platform |
| return_net_of_fees | 回報是否已扣除費用 | 平台註明回報數據為扣除費用後；需保存確認旗標 |
| fund_risk_indicator | 根據過去三年每月回報計算的年化標準差 | MPF Fund Platform glossary、MPFA circular |
| risk_class | 按基金風險指標劃分的七級標準化風險類別 | MPF Fund Platform glossary |
| data_as_of | 數值所代表的資料截至日期 | 每筆資料必填 |
| data_available | 是否有足夠歷史資料 | 由來源明確狀態及最低期間規則決定 |

基金風險指標是三年每月回報的年化標準差；風險類別為七級標準化分級，不能與個別受託人的其他風險評級混用。[^7] 平台亦說明，回報少於一年時不能提供年化回報，少於六個月時不能提供累積回報；風險指標少於三年歷史時可為 n.a.。[^8]

### 費用

| 欄位 | 定義／注意事項 | 來源優先級 |
|---|---|---|
| management_fee | 管理費，可包含受託人、保管人、行政、投資管理人及計劃提供者等部分 | MPFA glossary／Fee Table |
| fee_breakdown | 行政／eMPF／受託人／保管人、會員服務、投資管理等拆分 | MPF Fund Platform、Fee Table |
| latest_fer | 最近一期基金開支比率 | Fund Fact Sheet／MPF Fund Platform |
| guarantee_charge | 保證費 | Fee Table |
| other_expenses | 其他開支，不能假設為零 | Fee Table |
| joining_fee | 加入費 | Fee Table |
| annual_fee | 年費 | Fee Table |
| contribution_charge | 供款費 | Fee Table |
| bid_spread / offer_spread | 贖回／認購單位時的差價 | Fee Table |
| withdrawal_charge | 提取費 | Fee Table |
| fee_effective_date | 費用適用日期 | Fee Table／受託人文件 |
| fee_is_historical | 是否為上一財政期的歷史數據 | MPF Fund Platform glossary |

基金開支比率是以基金規模為基礎的歷史期間比率，主要反映上一財政期的基金開支，不能直接當作當前費率；比較頁應分開顯示 FER 與當前披露的管理費及費用拆分。[^5]

## 已確認資料規則

1. 以 fund class 作為最小比較單位，保留其 constituent fund 和 scheme 關係。
2. 所有回報、風險及費用數值必須帶 data_as_of、source_url、source_type、retrieved_at 及 verification_status。
3. 平台頁面及官方文件並行取得；平台頁面用於日常收集及更新，官方文件作最終核對依據。
4. 現行可供選擇狀態須由 MPFA 平台、受託人最新基金名單及官方文件交叉核對；未能一致確認的基金標記「待核實」，暫不納入排名。
5. 平台資料與受託人最新文件不一致時，不自動覆寫；標記衝突、保留兩者及要求人工核對。
6. 沒有足夠歷史資料時顯示「資料不足」，不以零、估算值或跨類別替代值參與排名。
7. 回報比較預設只在相同 fund_type／fund_category 內進行；跨類別比較必須明確標示為不同投資目標的比較。
8. 持倉及資產配置優先比較同一截至日期及分類；不足時可容許小幅日期差異，但須標示「非完全可比」。
9. 每日更新是擷取及驗證流程的目標，不代表所有官方欄位每日都有新資料。
10. FER、當前管理費、其他費用及 OCI 在詳細頁分開展示；簡化頁只顯示主要費用，並連結至完整拆分及資料日期。
11. 第三方資料不得改寫官方來源的定義；如使用第三方計算值，必須獨立標示計算方法。

## 已確認的四項決定

1. 平台頁面及官方文件並行取得，以官方文件作最終核對依據。
2. 現行基金須由平台、受託人名單及官方文件交叉確認；未確認者不納入排名。
3. 持倉及資產配置以同日同分類為首選，不足時標示非完全可比。
4. 詳細頁完整拆分 FER、當前管理費、其他費用及 OCI；簡化頁只展示主要費用。

## Sources

[^1]: https://mfp.mpfa.org.hk/mobile/eng/mpp_faq.jsp
[^2]: https://www.mpfa.org.hk/en/info-centre/public-registers/registered-mpf-schemes
[^3]: https://mfp.mpfa.org.hk/eng/mpp_list.jsp
[^4]: https://mfp.mpfa.org.hk/mobile/eng/cf_detail.jsp?cf_id=429
[^5]: https://mfp.mpfa.org.hk/eng/mpp_glossary.jsp
[^6]: https://www.mpfa.org.hk/en/mpf-investment/investment-regulations-and-disclosure/disclosure-of-information
[^7]: https://mfp.mpfa.org.hk/mobile/eng/mpp_glossary.jsp
[^8]: https://mfp.mpfa.org.hk/mobile/eng/mpp_faq.jsp
