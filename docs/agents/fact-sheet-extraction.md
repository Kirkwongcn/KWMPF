# 基金便覽：連結、抽取與缺口分類

便覽去邊度攞、點樣由 PDF 抽出配置同十大持倉、抽唔到嗰陣點記低。
受託人版對積金局副本嘅取捨見 `fact-sheet-sources.md`；
跨計劃嘅資產三桶歸類見 `editorial-mapping.md`。

## Official scheme fact sheets

積金局的「基金便覽」按計劃發布，連結抄錄自〈註冊強積金計劃及成分基金〉登記冊，存放於
`data/sources/<YYYY-MM-DD>/fund-fact-sheet-links.json`。`packages/coverage/src/fact-sheet-lookup.ts`
只認 `YYYY-MM-DD` 目錄，取最新一個帶有該檔案的批次，並在 `publication-seed` 時把
`schemeFactSheet`（連結、抄錄日期、登記冊網址）寫入每筆快照 payload。
快照內有計劃在連結檔中找不到就會報錯，不可靜默略過。
檔案編號的前綴代表計劃類型（`MT` 集成信託、`IS` 行業、`ES` 僱主營辦），不可由編號推算。
更新做法：開新的日期目錄，由登記冊重新抄錄全部計劃，再重跑 seed。

## Fact sheet allocation and top holdings

便覽的「配置」及「十大持倉」由 `packages/coverage/src/fact-sheet-allocation.ts` 抽取，
24 個計劃各自一份契約寫在 `fact-sheet-allocation-contracts.ts`。抽取靠座標：便覽是多欄
雙語版面，`pdftotext -layout` 會把相鄰欄位併成同一行，所以一律行 `pdftohtml -xml`
（`pdf-xml.ts`）。契約只描述「去邊度攞」，不描述「點樣改寫」——維度標題、標籤及證券名稱
一律原文照錄，不做正規化或跨計劃映射。跨計劃的三桶資產歸類是另一層，見下節。

五條不可繞過的規則：

- **有數值、冇名稱就整塊當官方未提供**。宏利環球精選有部分證券名稱畫成向量而非文字，
  靜默丟走這些行會令名單短一截、排名整體移位，等於改寫官方披露。走 `unavailableFields`，
  並把原因（連同落單那幾行的原文）寫入 `unavailableReasons`。
- **抽唔到成表就明講**。`BlockSelector.unextractable` 用嚟聲明「版面上有呢一塊，但抽唔到」，
  例如宏利環球精選的條形圖標籤是向量、我的強積金的圓餅圖標註共用基線又有數值離群。
  設咗就一律走 `unavailableFields`，唔會出局部資料。
- **接駁文字唔可以加多咗空格**。同一行的文字段落用水平空隙決定要唔要空格（`joinItems`：
  中銀保誠把 `8.4%` 拆成 `8` `.` `4` `%` 四段緊貼的文字）；跨行的中文標籤兩邊都係中文時
  唔加空格，中英對照之間就要加。
- **配對唔做模糊比對**。`fact-sheet-allocation-pairing.ts` 只做大小寫、彎引號、破折號
  正規化，加上契約聲明的 `platformNamePrefix`（平台寫「BCT (Pro) …」，便覽冇呢個前綴）。
  同名兩個區段就報唔配對，唔可以隨便揀一個。一隻成分基金的多個基金類別共用同一份披露。
- **疊印分層靠落筆次序，唔靠座標**。永明每一版都把另外一至兩版（有幾版仲要係上兩季
  嘅舊數）成版疊印上去：標題、截至日期、成張十大持倉逐版重覆一次，只差兩至七 pt，
  有幾行兩份的百分比左界完全一樣。座標分唔開，但 `pdftohtml` 依內容流輸出，而內容流
  一定係先寫本頁自己嗰版。所以 `PdfTextItem.drawIndex` 保住落筆次序，
  `TitleSelector.overlaidPages` 每頁取最先落筆嗰個標題，並且只讀到下一個標題落筆為止。
  實測 27 版全部第一層都係 `As at 30/06/2026`，疊上去嗰啲先係 2025-09-30／2025-03-31。
  `rejectOverlaidRows` 保留做防線：切唔乾淨就會有一行帶兩個百分比，
  嗰陣寧可整塊當抽唔到，都唔靠座標猜邊個數值屬邊隻基金。

版面原語，唔好夾硬用錯：一般表格逐行讀；`rowGap` 把換行拆散的一列併返（宏利自在人生、
富達的數值垂直置中排在兩段名稱之間，容差要細過列距）；`callouts` 分組圖表標註，預設按
中心 x（中銀保誠、交銀的幾個扇形百分比會落在同一條基線上），`overlap` 則按水平範圍相交
（MASS 的標註在餅左邊靠右對齊、右邊靠左對齊，中心對唔上），兩者都以百分比作結；
`labelColumnGap` 把換行的中英對照標籤逐欄併返（新地）。

欄界四個原語：`band` 明確劃死；`leftSlack` 收窄自動欄界的左邊容差（富達左欄評論的
斷字連字符會漏入）；`columnWidth` 收窄右邊（自動欄界只識數到下一個更右的標題，
右邊係註腳時推唔到）；`headingFontSize` 排除附錄用細字縮印的同一批表（富達用 4 級字）。

有幾個計劃逐隻基金披露唔同維度（富達、BCT Simple／Smart），`heading` 要認齊全部維度標題，
`headingLabel` 逐個對照中文名，唔可以夾硬當成同一個維度。

覆蓋報告：`bun run coverage:fact-sheet-allocation-report --platform <平台快照> --links
<fund-fact-sheet-links.json> --fact-sheets <PDF 目錄> --output <report.json>`。報告逐個計劃
列出已配對數、未配對清單及原因、以及配對到但官方未披露的原因。2026-09-04 以 59 份便覽跑
（二十三個計劃用受託人官網那期、AMTD 用積金局副本；MASS 佔 14 份、富達佔 23 份）：
382 隻成分基金中 381 隻配對到，
310 隻有配置、361 隻有十大持倉。餘下缺口主要是圖表式披露：宏利環球精選的配置畫成條形圖、
永明畫成圓環圖（受託人版一樣係向量，文字層一個字都冇）、我的強積金的圓餅圖標註共用基線，
全部走 `unavailableFields` 並寫明原因。

同一條指令加 `--disclosures <fund-fact-sheet-disclosures.json>` 會另出一份披露檔：覆蓋報告
只收數目，發布要原文，所以兩份各自輸出，不可由報告的數目倒推。披露檔存放在來源批次目錄
（現時 `data/sources/2026-08-31/`），由 `fact-sheet-disclosure-lookup.ts` 讀取——同 `fact-sheet-lookup.ts`
一樣只認 `YYYY-MM-DD` 目錄、取最新一個帶有該檔的批次。`publication-seed` 逐個基金類別查，
查到就把 `factSheetDisclosure` 寫入 payload，`/fund-classes/:id` 原樣送出。
451 個基金類別中 450 個有披露。

## 缺口分類

「官方未提供」同「官方以圖表披露」是兩回事，票 #210 要求分開講。原因文字（`unavailableReasons`）
是診斷用的英文長句，網站**不可以**靠字串比對反推分類，所以抽取層在知道分別那一刻另外記低
`unavailableKinds`：`not-disclosed`（該區段冇呢一塊）、`chart-only`（契約聲明畫成圖表）、
`values-without-names`（有百分比但名稱畫成向量）、`overlaid-text-layer`（文字層疊印）。
四個代號各自對應詳情頁一句中文措辭，英文原因不出街。新增缺口成因時要一併加代號同措辭，
唔可以塞落現有代號當「其他」。
