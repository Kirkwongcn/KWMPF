# 友邦及萬通三年年率化回報到期覆核

2026-11-12 香港時間。正式站基線為 #54（183da56a4e095fba1f4e637613c03c0cf7d3354e），三年年率化排名 79 筆、過期排除 271 筆。今次核對當中 34 筆截至八月底的合資格回報。[逐項原印值、截至日期、頁碼、官方網址、SHA-256 及擷取時間](2026-11-12-aia-mass-34.csv)

|計劃|已核對的基金類別|可核實的最新表現日|九月／十月年率化新值|
|---|---:|---|---:|
|友邦強積金優選計劃|20|2026-08-31|0|
|萬全強制性公積金計劃（MASS）|14|2026-08-31|0|

友邦中英文目錄最新列至八月；九月和十月的五條常見檔名路徑均回應 404。已按八月報告各基金頁首及三年年率化欄核對，獨立讀取的 20 筆原印值與正式排名吻合。積金局副本的表現日為五月底。[友邦目錄](https://www.aia.com.hk/zh-hk/products/useful-tools-and-information/knowledge-and-insight/mpf-fund-performance-review) · [積金局友邦副本](https://www.mpfa.org.hk/assets/FF/MT00172.pdf)

萬通逐隻基金英文版的三年年率化欄及原印精度已核對，14 份相應中文版本亦均標八月三十一日；十月刊發的便覽仍可披露八月底的數據。積金局合併版為六月底。每月基金表現報告採用三年累積回報，與本輪欄位分開處理。[萬通保證基金便覽](https://app2.yflife.com/MPFWeb/pdf/fact_sheet/GUAF_E.pdf) · [積金局萬通副本](https://www.mpfa.org.hk/assets/FF/MT00350.pdf)

全部 15 份英文原件的 SHA-256 與 #404 核對版本相同。各頁原印值、表現日、網址與正式 API 一致，無需改動發布候選。未取得可供實測的九月或十月年率化便覽。若 11 月 30 日仍使用八月底數據，這 34 筆將超過 90 日門檻。

## 每日流程

原有每日流程會抓萬通月報及其他三年累積來源，並無擷取這 34 筆年率化便覽。實際的舊排程 [run #32](https://github.com/Kirkwongcn/KWMPF/actions/runs/43007953535) 執行成功。排程定於 03:17 UTC（香港 11:17），實際開始時間由 GitHub 排隊情況決定。

[PR #406](https://github.com/Kirkwongcn/KWMPF/pull/406) 在同一每日排程接入唯讀檢查。友邦從官方目錄找最新檔案，萬通重抓 14 個已覆核的固定英文網址。比對基準為 main 上最新的回報候選。每次保留逐基金日期、數值、狀態及 PDF 指紋；有新數字、同日修訂、來源回退、額外友邦基金或解析失敗時保留相關已下載原件。GitHub Actions 的 annualized-factsheet-review artifact 保留 90 日。新版本會在執行摘要及報告列出，供接手者核對頁碼及精度、製作資料 PR。這個檢查本身沒有發布寫入權限。

本機實測 34/34，更新、同日修訂、較舊來源、擷取失敗均為零。換年排序、九／十月新期、同日修訂、未來及無效日期、缺列或重複身分、合併便覽增加其他基金，均有測試。四項針對性測試及 coverage typecheck 通過。本機重建正式發布 seed，451 個基金類別、350 筆年率化及 374 筆累積觀察值，34 筆的數字及日期與逐項清單一致。

## GitHub 及正式站回執

[PR CI](https://github.com/Kirkwongcn/KWMPF/actions/runs/43187520553) 通過 verify、high-risk-review、Playwright 及 publication seed。[main CI #924](https://github.com/Kirkwongcn/KWMPF/actions/runs/43187830373) 通過。合併後手動觸發與每日排程相同的[唯讀檢查 #1](https://github.com/Kirkwongcn/KWMPF/actions/runs/43187861506)，從 GitHub 下載 artifact 13928688090，比對 34 筆日期、數值、狀態及 15 份 PDF 的 SHA-256，全數與本機相同，0 新期、0 同日修訂、0 來源回退、0 失敗。尚未觀察到排程自然觸發後讀到真正九／十月新版。

[正式部署 #55](https://github.com/Kirkwongcn/KWMPF/actions/runs/43188033815) 成功。Worker /health 回傳 c296c42a173ef03bbde99a3df6db3810fcf30724；三年排名快照為 snapshot-mpfa-platform-2026-10-31-c296c42a173e。部署前後全部 79 行逐欄及次序相同，271 筆過期排除，另重算所有組內名次吻合。
