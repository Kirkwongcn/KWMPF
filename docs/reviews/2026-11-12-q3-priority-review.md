# 第三季便覽及友邦回報日期覆核

2026-11-12 香港時間。發布前對照正式 Worker 版本 5a83c329c94dd2d9b0f07e3af4c72f154517433b、十月平台名冊及當時完整三年排名。基線為 79 隻入榜、271 筆過期。

## 171 筆逐項配對

|受託人|計劃及基金類別數|可核實的三年年率化欄|本次恢復入榜|
|---|---|---|---:|
|銀聯信託|BCT Pro 26、Industry 12、Simple 10、Smart 14、Series 800 22、AMTD 16|全部 2026-06-30|0|
|東亞|集成 17、享惠 11、行業 12|全部 2026-06-30|0|
|中銀保誠|簡易 17、我的強積金 14|全部 2026-06-30|0|

重新下載並以 SHA-256 核對實際解析的 PDF。按正式抽取入口讀取 171 筆，按計劃、基金及類別全部唯一配對，沒有解析失敗。155 筆與公開候選的日期及數值一致。AMTD 的 16 筆由候選的 2025-12-31 更新至可查原件的 2026-06-30，兩個日期均超過 90 日門檻；本輪只記錄這批較新的過期證據。候選數據維持原版本。[逐項數值、日期、原件及指紋](2026-11-12-q3-priority-171.csv) · [來源請求、時間及結果](2026-11-12-q3-source-checks.csv)

- 銀聯五個計劃的固定下載網址、直達 PDF 及積金局副本均已核對。AMTD 積金局副本為六月，另查到的計劃推廣機構 PDF 為 2025 年十二月。銀聯另有策略計劃的九月底便覽；該計劃沒有列入這 100 筆，不能跨計劃套用。[積金局 AMTD 原件](https://www.mpfa.org.hk/assets/FF/MT00539.pdf) · [銀聯策略計劃](https://www.bcthk.com/content/dam/bcthk-sites/documents/publications/images/IV_Fact_Sheet.pdf)
- 東亞三個計劃的官方季度便覽目錄最新列為 2026 Q2。三條按上期命名推算的 Q3 路徑均回應 404。逐頁查看 9 月 30 日另一份基金表現概要，其 40 隻基金的表頭列年初至今及過去一年累積回報。九月份投資摘要亦不能提供本輪所需的三年年率化欄。[便覽目錄](https://www.hkbea.com/html/en/bea-mpf-fund-performance.html) · [九月表現概要](https://www.hkbea.com/pdf/Monthly%20Investment%20Summary/FPO_en_202609.pdf) · [九月投資摘要](https://www.hkbea.com/pdf/Monthly%20Investment%20Summary/MIS_202609.pdf)
- 中銀保誠兩個官方目錄最新列為 2026 Q2，第三季條目屬 2025 年。[簡易強積金](https://www.bocpt.com/homepage/en/easy-choice-mpf/easy-choice-mpf-download-corner/fund-fact-sheet/) · [我的強積金](https://www.bocpt.com/homepage/en/my-choice-mpf/my-choice-mpf-download-corner/fund-fact-sheet/)
- 其餘 100 筆涵蓋宏利 29、永明 29、滙豐信託 18、交銀 14、中國人壽 10。重抓相關 13 個已知來源，12 個 PDF 與上輪 SHA-256 相同，另一條候選連結回應 404。這部分屬來源變更檢查。未能由已查入口核實合資格數字，不能據此斷言各受託人所有渠道均沒有第三季資料。

## 友邦解析及發布驗證

[PR #405](https://github.com/Kirkwongcn/KWMPF/pull/405) 將年率化回報日期綁定各基金頁首的計劃標題；缺少表現日期便報錯。兩個新增測試涵蓋跨頁日期不同及只有持倉日期。重跑八月官方原件，20 隻基金全部回傳 2026-08-31，原印回報與上輪逐頁證據吻合。持倉原文為 2026-07-31。原 PDF 第 7、8、9 頁的三年回報分別為 12.35%、4.89%、18.91%，本機 publication seed 逐基金核對全部 20 隻通過，451 個基金類別、350 筆三年年率化、374 筆三年累積。[友邦官方原件](https://www.aia.com.hk/content/dam/hk-wise/pdf/form-library/form-and-guides/employer/forms/aia-mpf-prime-value-choice-fund-performance-review-aug-2026.pdf)

Windows 首次測試中，富達舊測試對 CRLF fixture 的逐行文字替換沒有命中。以 Git 的 LF 版本再執行 Vitest，解析器套件 46/46 通過；測試後還原本機 fixture。獨立覆核亦重現缺少頁首日期時的錯誤。無需改動富達解析器或資料。

[PR CI](https://github.com/Kirkwongcn/KWMPF/actions/runs/43185269695) 通過 verify、high-risk-review、Playwright 及實際本機 Worker publication-seed。[main CI #922](https://github.com/Kirkwongcn/KWMPF/actions/runs/43185617078) 通過。[正式部署 #54](https://github.com/Kirkwongcn/KWMPF/actions/runs/43185740474) 成功。正式 /health 讀回 183da56a4e095fba1f4e637613c03c0cf7d3354e。正式排名回傳 snapshot-mpfa-platform-2026-10-31-183da56a4e09。與部署前全部 79 筆逐欄及次序相同，亦逐筆重算組內名次吻合，仍排除 271 筆。新增合資格 0 筆、名次變動 0 筆。
