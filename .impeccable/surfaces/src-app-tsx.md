---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/SiteChrome.tsx"]
---

# KWMPF 強積金基金圖冊（2026-10 重新設計）

模式：Operate（研究工具）；方法、資料狀態：Read。一般成員與研究者同等重要；手機與桌面都要完成搜尋、同類比較及來源核對。

使用者 2026-10-04 指示：用 Impeccable 及所有設計 skill 重新設計，可完全重新排版、不必跟現有分頁；靈活運用邊界及圖像，必須專業。保留金色 kW 標記及深青金色配色，其餘重做；加入真實香港攝影（Wikimedia Commons，記錄作者及授權）；基金分類只用積金局基金類型（ADR 0011）。

## Direction contract

THESIS：強積金市場是一張可以實地核對的測繪圖。每隻基金類別是一個有座標（風險 × 回報）、有測量日期、有基準點（官方來源）的測量點；積金局基金類型是圖例與分區。拒絕金融科技的卡片儀表板，也拒絕報紙式編輯排版。

OWN-WORLD：香港地政測繪圖的系統：深青 #123b46 圖框與海域、金色 #c7a66a 測量刻度與基準標記、測繪紙白底；圖框帶刻度邊緣與網格坐標（A–H／1–8），中英對照標籤，右下標題欄記錄圖名、截至日期、來源與比例。Archivo（寬度軸）作英文標籤與數字，系統中文字，serif KWMPF 字樣只屬標記。面板直角、1px 細線分層，不用卡片陰影。

STORY：訪客先看到整個市場的分布，知道比較只在同一積金局基金類型內進行；用「地名索引」找到自己的基金，打開它的圖幅，逐項核對數值、測量日期與來源，再與同類型的鄰點比較。

FIRST VIEWPORT：全寬維多利亞港實景相片置於帶刻度與網格坐標的圖框內，左上 kW 標記與 KWMPF；畫面主體是「基金圖」：451 個測量點按 3 年波幅（橫）× 1 年回報（縱）落點，按積金局六大基金類別上色，圖例即篩選；搜尋欄作「地名索引」置於圖框上緣；右下標題欄寫「強積金基金圖 · 平台數據截至 2026-08-31 · 來源：積金局」。

FORM：測繪圖冊（候選 6／7，seed key 1eee06bc，roll degraded：impeccable.style 被網絡政策擋住，沒有 challenger 及 QUALITY BAR）。Code-led：本環境沒有圖像生成。

SIGNATURE INTERACTION：在圖例選一個基金類別，其餘測量點退後、該類各積金局類型的分布框（四分位）浮現；指向測量點顯示基金名、計劃、原值與日期，點擊打開該基金圖幅。動態只此一處，尊重 reduced-motion。

FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Data presentation boundaries

- 原百分比不補零、不固定小數；零值、官方未提供、未取得分開。
- 每個期間及欄位保留自己的來源與截至日期；過期數值不入圖、不排名，原值表保留。
- 分類只用積金局基金類型；本站計算的中位數、四分位、分布明示「本站計算」。
- 圖形不合成未披露時間序列；跨類型並列不作排名。
