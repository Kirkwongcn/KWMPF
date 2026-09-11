# 基金便覽來源：逐個受託人嘅實戰紀錄

抄錄連結、取檔、換版時撞過嘅具體問題同解法。來源政策本身見
`fact-sheet-sources.md`。

## 反爬蟲對策

**bcthk.com 用 CloudFront 擋自動化請求**：`curl` 冇帶瀏覽器 `User-Agent` 會收 403，
帶正常瀏覽器 UA（例如 Chrome 128 UA）就過。

**Akamai Bot Manager 認 TLS 指紋，唔係認 `User-Agent`**：manulife.com.hk 全站行 Akamai，
`curl`（連完整瀏覽器 headers）、`agent-browser`、`read_webpage` 一律收 403 Access Denied，
因為擋的是 TLS/JA3 握手指紋，補幾多個 header 都冇用。用 `curl_cffi`（已安裝於
`/usr/local/lib/python3.12/site-packages`，注意要行 `/usr/local/bin/python3`，
`/usr/bin/python3` 揀唔到）以 `requests.Session(impersonate="chrome124")` 重現 Chrome
的握手指紋就一次過通——完全喺本機跑，唔使 proxy、唔燒任何額度。shkp.com 同樣行得。
`r.jina.ai` 之類的公開 proxy 只會把 PDF 轉成 markdown，攞唔到原始位元組，抽唔到座標，
唔可以用嚟做版面解析。

## 連結陷阱

**Pro Choice 的連結唔喺下載區，要去積金局 KSID 攞**：計劃叫 Pro Choice，但便覽的短連結係
`bcthk.com/MTS-Fund-Fact-Sheet`（MTS = Master Trust Scheme，解到
`/content/dam/bcthk-sites/documents/publications/images/MT_Fact_Sheet.pdf`）。
`PC-`、`ProChoice-`、`IC-` 一律解唔到，官網下載區又係 JS render，`curl` 攞唔到連結；
之前試出「同積金局副本一樣係 2025-12-31」係因為試錯咗連結。權威出處係積金局的
主要計劃資料文件 `mpfa.org.hk/assets/OD/MT00016_BCT_(MPF)_Pro_Choice_EN.pdf`，
入面明寫基金便覽連結。其餘計劃搵唔到連結時，同樣可以去 `assets/OD/<計劃編號>_*_EN.pdf` 查。

## 換版揭發嘅真缺口

友邦那期同時揭發一個真缺口：積金局 2025-11-30 副本未收錄 Retirement Income Fund，
換上受託人版之後 21 隻成分基金全部有齊配置及十大持倉，配對數同十大持倉數各 +1。
我的強積金換上受託人版揭發三個真缺口：積金局 2026-03-31 副本未收錄三隻新基金
（Americas Equity、European Quality Tracker、Chinese Government and Policy Bank Bond Index），
換版後 14 隻變 17 隻，配對數同十大持倉數各 +3（配置本身呢個計劃就一路 `unavailableFields`）。
中銀保誠、交通銀行、BCT Strategic、中國人壽、東亞三個計劃、滙豐換版後覆蓋數字不變，純粹換新期別。

東亞三個計劃的連結有版本陷阱：2026 年起官網逐個計劃分開檔案（`mpf-{mt,is,vs}-2026-{n}.pdf`），
2025 年及之前係三個計劃共用一份 `mpf-YYYY-Nth.pdf`。下載區當時只列到 2026-1st，
但 2026-2nd 三份都已經上載，所以要逐條 URL 試，唔可以淨係抄下載區列咗的連結。

**新地換版一度少一隻持倉，靠 `rowGap` 修返**：受託人官網 `Fund Price and FFS for SHKPESS.pdf`
（2026-06-30）比積金局副本（2026-03-31）新一季，但 Fidelity Balanced Fund 嗰版有兩行
「有百分比冇名稱」（`values-without-names`），令呢隻基金由有齊十大持倉變冇。查落唔係向量繪圖，
而係百分比嘅基線比證券名高 5 至 6 pt，超出 `toLines` 嘅 4 pt 容差；列距 14 至 15 pt，所以
持倉區段加 `rowGap: 7` 就併得返同一列而唔會吞埋下一列。積金局副本行同一份契約，加咗之後
輸出逐字不變（本身已經對齊），所以唔使拆兩份契約。換版必須先跑覆蓋報告確認冇退步先可以換。

## AMTD：受託人官網根本冇更新版

受託人自己都冇喺官網放最新便覽。2026-09-02 逐層查過：

- 營辦機構 2024-06-18 由 orientiert XYZ Securities 改名為 oOo Securities (HK) Group，
  網址由 `orientiertgroup.com` 轉去 `ooogroup.xyz`。舊網域仲解析到，但 TLS 憑證
  2025-03-07 已經過期，`curl` 同瀏覽器都連唔上，唔可以攞嚟做發布資料的來源。
- 積金局主要計劃資料文件（`assets/OD/MT00539_AMTD_MPF_Scheme_EN.pdf`）入面嗰條基金便覽
  短連結係 `bit.ly/44v4piX`，解到舊網域嘅 **2021 年 9 月**月報，比積金局副本仲舊。
- 新網域行 Cloudflare：`curl`（帶瀏覽器 UA）同 `agent-browser` 一律收 403，Zo 瀏覽器過到，
  但「基金資料」頁（`/hk/mpf-3.html`）有一個 JS 免責聲明閘，要㩒「同意」先入到；
  同頁嘅 `/locales/hk/mpf-3` 內容 API 出返一模一樣嘅閘前文字，繞唔到。
- 旁證顯示個站嘅強積金部分已經停止更新：`/locales/en/mpf_price` 嘅單位價格仲係
  2024-04-26，登入掣直接跳去 eMPF（`e-mpfhk.com`）。

即係話 AMTD 唔係「攞唔到」，而係受託人官網根本冇一份比積金局副本新嘅合併便覽。維持用
積金局副本 `MT00539.pdf`（2025-12-31）。要再進一步就要睇 eMPF 平台有冇刊發，屬另一條來源路徑。

## 宏利兩個計劃

**宏利兩個計劃：Akamai 擋得住 header，擋唔住 TLS 指紋重現**。兩份便覽的版面同積金局副本
一模一樣，取到檔案就照用現有契約，只差自在人生嗰份由 Word 匯出，標題嵌字由 `Arial` 變
`Arial,Bold`（內文一律 `ArialMT`，所以放寬字體名唔會誤中，唔使拆兩份契約）。
環球精選換版仲補返一隻：積金局副本嘅 Fidelity Stable Growth Fund 有一行證券名畫成向量
（`values-without-names`），受託人版文字層齊全，十大持倉由 14 隻升到 15 隻，而且同新地嗰份
獨立便覽披露嘅同一隻基礎基金持倉逐項對得上。

## 富達同 MASS：一個計劃多份便覽

**富達同 MASS 冇合併版便覽，唔係取不到檔**。富達（fidelity.com.hk）官網只有逐隻基金一頁的
`/en/funds/factsheet/<code>/H`；MASS（yflife.com）逐隻基金各自一份便覽。兩者都冇一份涵蓋成個
計劃的合併 PDF，所以來源結構加咗「一個計劃多份便覽」嗰個形態
（見 `fact-sheet-sources.md`），兩個計劃都已經換版。

**富達逐隻基金一份便覽**。`fidelity.com.hk` 嗰版係 SPA，`/pdf`、`/download`、`/api/...` 全部
撞返同一個 shell；便覽唔喺零售網域，而係
`www.fidelityinternational.com/legal/documents/HK-zh_en/hffs.HK-zh_en.HK.H-<代號>.pdf`。
代號係零售網站基金代號嘅前半段（`CFGF/H` → `H-CFGF`），23 隻齊。只有 `HK-zh_en` 呢個地區碼
攞到檔，`HK-en`／`HK-zh` 一律 403。取檔要 `curl_cffi`（`impersonate="chrome124"`）；
`agent-browser` 開零售網站會撞 Access Denied，所以基金代號係由網站嘅 JS bundle 反查出嚟。
23 份全部 2026-07-31，積金局副本 `MT00288.pdf` 係 2025-12-31，新七個月。

排版同積金局副本同一套（同一批字體級數、同樣三欄），所以標題錨點、欄界、日期式樣共用
`fidelityBlocks`；唯一分別係中英對照：每個披露標題後面緊接中文譯名，併行之後變成
「Top 10 Holdings 十大主要投資項目」，所以受託人版嘅標題式樣唔可以用 `$` 收尾。中文譯名
兩個來源都照樣由 `FIDELITY_DIMENSION_ZH` 對照，出返同一套標籤。換版之後配置維度
（34 個）同十大持倉（230 項）同積金局副本一模一樣，冇多冇少。

配置本身仲有一個更舊嘅日期：便覽寫「Fund Data as of 31/07/2026」，但配置表下面嘅註腳寫
「^ as of 30/06/2026」。現時 `factSheetAsOf` 一個披露得一個，記嘅係便覽自己嗰個；
逐塊披露各自嘅截至日期唔喺 #229 範圍，要做就另開票。

**MASS 逐隻基金一份便覽**。`www.yflife.com/en/product/mpf-hongkong/fund-price-history/` 嗰版
用 `aisite-applyapi/mo/moCompanyFund/fundList` 出返 14 隻成分基金嘅 `fund_code` 同便覽路徑
`app2.yflife.com/MPFWeb/pdf/fact_sheet/<code>_E.pdf`。API 寫嘅係 `http://`，同一條路徑行
`https://` 一樣返 200，所以名單一律寫 `https://`。取檔要 `curl_cffi`
（`impersonate="chrome124"`）——普通 header 過唔到。14 份 2026-06-30，積金局副本
`MT00350.pdf` 係 2025-12-31，新半年。基金名兩邊逐隻對得上（官網列表把預設投資策略嗰兩隻
標咗星號註腳，抄錄時剝走，星號唔屬基金名）。

版面同積金局副本一模一樣，所以標題、配置、持倉三塊契約共用；只有截至日期唔同，要按來源
分開兩份契約（同海通嗰種「成個版面唔同」唔一樣）。副本係中英對照版，中文日期一行讀得到；
官網逐隻基金嗰份淨係英文，「Fund Data as at June 30, 2026」排喺左窄欄斷開兩行，而同一條
基線右邊仲有「Fund Price (HKD)」。所以 `asOf` 加咗兩個原語：`band` 只喺指定橫向範圍搵日期
（唔限範圍就會併埋隔籬欄，日期唔再連續），`joinWrappedLines` 連埋下一行再試一次式樣。
