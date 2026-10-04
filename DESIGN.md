---
name: "KWMPF 強積金基金圖冊 / MPF Fund Atlas"
description: "測繪圖冊：每隻基金類別是一個有座標、有測量日期、有官方基準點的測量點"
colors:
  navy: "#123b46"
  gold: "#c7a66a"
  gold-light: "#d8b774"
  gold-strong: "#765b24"
  gold-hover: "#e7cc94"
  highlight: "#00879f"
  context: "#b4bfc1"
  paper: "#f4f3ee"
  sheet: "#fbfaf7"
  rule: "#cdd3cf"
  rule-strong: "#8f9b97"
  table-head: "#efeee8"
  ink: "#16252c"
  muted: "#5b666c"
  muted-strong: "#537080"
  action: "#0f414e"
  action-hover: "#0a2f38"
  soft: "#f2f4f1"
  photo-ground: "#0b2a33"
  header-text: "#c4d5dc"
  nav-link: "#d3e0eb"
  atlas-grid: "#e2e6e2"
  legend-selected: "#e3efef"
  positive: "#006b37"
  negative: "#9a3b3b"
  warning-bg: "#fff6e8"
  white: "#ffffff"
  viz-1: "#00879f"
  viz-2: "#c07f12"
  viz-3: "#d0577a"
  viz-4: "#5560c4"
  viz-5: "#4b9a3a"
  viz-6: "#7b4fa0"
  viz-context: "#b8c2c4"
  viz-grid: "#e6e9e6"
  viz-axis: "#9aa39f"
typography:
  plate-title:
    fontFamily: '"Archivo", "PingFang HK", "Noto Sans HK", "Noto Sans TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "clamp(2.1rem, 3.9vw, 3.3rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0.02em"
  sheet-title:
    fontFamily: '"Archivo", "PingFang HK", "Noto Sans HK", "Noto Sans TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "clamp(1.7rem, 2.6vw, 2.35rem)"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: '"Archivo", "PingFang HK", "Noto Sans HK", "Noto Sans TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "1.5rem"
    fontWeight: 650
    letterSpacing: "-0.01em"
  title:
    fontFamily: '"Archivo", "PingFang HK", "Noto Sans HK", "Noto Sans TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "1.35rem"
    fontWeight: 650
    letterSpacing: "-0.01em"
  body:
    fontFamily: '"Archivo", "PingFang HK", "Noto Sans HK", "Noto Sans TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
    fontVariation: '"wdth" 96'
  data:
    fontFamily: '"Archivo", "PingFang HK", "Noto Sans HK", "Noto Sans TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "0.92rem"
    fontWeight: 600
    fontFeature: '"tnum" 1'
  label:
    fontFamily: '"Archivo", "PingFang HK", "Noto Sans HK", "Noto Sans TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "0.72rem"
    fontWeight: 400
    letterSpacing: "0.06em"
  plate-title-mobile:
    fontFamily: '"Archivo", "PingFang HK", "Noto Sans HK", "Noto Sans TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.05
  stat-value:
    fontFamily: '"Archivo", "PingFang HK", "Noto Sans HK", "Noto Sans TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "1.05rem"
    fontWeight: 600
    fontFeature: '"tnum" 1'
  supporting:
    fontFamily: '"Archivo", "PingFang HK", "Noto Sans HK", "Noto Sans TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "0.85rem"
    fontWeight: 400
  caption:
    fontFamily: '"Archivo", "PingFang HK", "Noto Sans HK", "Noto Sans TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "0.78rem"
    fontWeight: 400
    lineHeight: 1.5
  atlas-label:
    fontFamily: '"Archivo", ui-sans-serif, system-ui, sans-serif'
    fontSize: "11px"
    fontWeight: 400
  english-subtitle:
    fontFamily: '"Archivo", ui-sans-serif, system-ui, sans-serif'
    fontSize: "0.9rem"
    fontWeight: 400
    letterSpacing: "0.06em"
    fontVariation: '"wdth" 118'
  grid-reference:
    fontFamily: '"Archivo", ui-sans-serif, system-ui, sans-serif'
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.08em"
  mark:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "1.1rem"
    fontWeight: 600
    letterSpacing: "0.02em"
rounded:
  panel: "2px"
  inner: "1px"
  none: "0px"
  brand-mark: "50%"
spacing:
  "2": "2px"
  "4": "4px"
  "8": "8px"
  "12": "12px"
  "16": "16px"
  "18": "18px"
  "24": "24px"
  "28": "28px"
  "40": "40px"
  "72": "72px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.white}"
    typography: "{typography.data}"
    rounded: "{rounded.panel}"
    padding: "10px 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.action}"
    rounded: "{rounded.panel}"
    padding: "10px 18px"
  button-gazetteer:
    backgroundColor: "{colors.gold-light}"
    textColor: "{colors.navy}"
    rounded: "{rounded.panel}"
    padding: "10px 18px"
  button-gazetteer-hover:
    backgroundColor: "{colors.gold-hover}"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.panel}"
    padding: "10px 12px"
    height: "44px"
  header:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.nav-link}"
    height: "68px"
  reading-mode-selected:
    backgroundColor: "{colors.gold-light}"
    textColor: "{colors.navy}"
    rounded: "{rounded.inner}"
    padding: "6px 11px"
  gazetteer:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.white}"
    padding: "12px 18px"
  sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  title-block-cell:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    padding: "9px 16px 10px"
  legend-filter:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    padding: "8px 14px 8px 12px"
    height: "44px"
  legend-filter-selected:
    backgroundColor: "{colors.legend-selected}"
  table-head:
    backgroundColor: "{colors.table-head}"
    textColor: "{colors.muted-strong}"
    typography: "{typography.label}"
---

# Design System: KWMPF 強積金基金圖冊

## Overview

**Creative North Star: "測繪圖冊 / The MPF Fund Atlas"**

強積金市場被當成一張可以實地核對的地政測繪圖來讀。每隻基金類別是一個測量點：有座標（3 年波幅 × 1 年回報）、有測量日期、有基準點（官方來源）；積金局基金類型是圖例與分區。介面由深青圖框、金色測量刻度、測繪紙白底及 1px 細線組成，沒有卡片陰影、沒有儀表板大數字，也不是報紙式編輯排版。

密度偏高而安靜：一個圖框之內放齊地名索引（搜尋）、實景圖帶、標題欄及基金圖；內頁以「圖幅」開頭，標題欄記錄圖名、截至日期、來源與範圍。唯一的強調色是測量高亮青 highlight，其餘一切退為 context 灰。中文以系統字，英文標籤與數字用 Archivo（寬度軸），serif 只屬 kW 標記與 KWMPF 字樣。

這套系統是 2026-10 shipped build 的紀錄，來源為 `apps/web/src/atlas.css`（最後載入，覆寫 `styles.css`／`viz.css`／`refresh.css`）、`App.tsx`、`Atlas.tsx`、`SiteChrome.tsx`。方向契約見 `.impeccable/surfaces/src-app-tsx.md`。

**Key Characteristics:**

- 深青 1px 圖框外加 4px 偏移細線（neatline），直角（2px）、零陰影。
- 金色刻度尺（12px 小刻／60px 大刻）只出現在地圖語境：頁首底邊、相片圖框。
- 圖格固定 A–H × 1–8，中英對照軸標題；坐標同樣印在相片圖框。
- 標題欄（title block）取代大號統計數字：細線分格、正文級數值、tabular numerals。
- 單一高亮：選中的積金局基金類別用 highlight，其餘為 context。
- 每個數值保留官方原文與自己的截至日期；本站衍生數值標明「本站計算」。

## Colors

一個深青圖框、一支金色刻度、一個測量高亮，其餘是紙與細線。

### Primary

- **圖框深青 Survey Navy** (`navy`)：頁首、地名索引帶、圖框及圖幅的 1px neatline、標題欄頂線、表頭底線、內頁分段控制的選中態、基金圖焦點圈。是這個世界的「海域與圖框」。
- **測量高亮青 Survey Highlight** (`highlight`)：基金圖中被選類別的測量點、四分位分布框（虛線，選中變實）、圖例選中圓點、圖幅索引的點、全站 `:focus-visible` 外框。每屏只有一個被高亮的組別。

### Secondary

- **刻度金 Survey Gold** (`gold`)：刻度尺、章節標題下的金色基準短刻。只作線，不作面。
- **淺金 Gold Light** (`gold-light`)：深青底上的文字與控制：頁首 hover／現時頁底線、閱讀模式選中底、地名索引按鈕、相片上的圖格坐標、深青底上的焦點框。
- **深金 Gold Strong** (`gold-strong`)：淺底上的金色文字：基金圖圖格坐標（A–H／1–8）、tooltip 中的圖格參照、圖幅索引中位數短線。淺底上不用 `gold` 寫字（對比不足）。

### Neutral

- **測繪紙 Survey Paper** (`paper`)：頁面底色、頁尾底、捲軸軌。
- **圖紙 Sheet** (`sheet`)：所有圖幅、圖框、面板、表格容器、標題欄的底。比 paper 淺一級，層次靠紙色而非陰影。
- **細線 Rule** (`rule`)：圖幅內分格、標題欄格線、偏移 outline、列表分隔。
- **重細線 Rule Strong** (`rule-strong`)：圖幅外框（非首頁圖框）、章節標題底線、統計列底線、捲軸拇指。
- **表頭暖白 Table Head** (`table-head`)：資料表欄頭底色，配 navy 底線。
- **Context 灰** (`context`)：基金圖中未被選中或被退後的測量點。
- **墨 Ink / Muted / Muted Strong** (`ink`、`muted`、`muted-strong`)：正文、說明、標籤與軸標題。
- **相片底 Photo Ground** (`photo-ground`)：實景圖帶載入前的底色與相片上漸層、caption 的底（以透明度疊加）。
- **深底文字** (`header-text`、`nav-link`)：頁首及地名索引上的次級文字。

### Inner-page chart series

內頁圖表（`Charts.tsx`、`DataCharts.tsx`、`PeerPosition.tsx`）沿用既有 `viz-1`…`viz-6` 系列色及 `viz-context`／`viz-grid`／`viz-axis`；`viz-1` 與 highlight 同值。這是上一版沿用下來仍在出貨的系列色，不屬於基金圖。

### Named Rules

**The Single Highlight Rule.** 基金圖只用一個高亮色（highlight）對比 context 灰；不按六大基金類別各上一色。六色方案在驗證器失敗（一般視力最差 ΔE 8.5、色覺異常最差 3.5），所以類別身份靠圖例篩選，不靠色相。

**The Gold Is a Ruler Rule.** 金色只用於刻度、坐標與基準標記，以及深青底上的互動文字；不作大面積填色，不作淺底正文。

**The Paper Layer Rule.** 深度只靠 paper → sheet 兩級紙色及細線；沒有第三種面板底色。

## Typography

**Display / Body Font:** Archivo（自託管，OFL，`/fonts/archivo-latin.woff2`、`/fonts/archivo-latin-ext.woff2`，weight 400–800，width 62%–125%）配系統中文字（PingFang HK、Noto Sans HK、Noto Sans TC、Microsoft JhengHei）
**Mark Font:** Georgia serif，只限 kW 標記與 KWMPF 字樣

**Character:** 測繪圖上的工程字：Archivo 的寬度軸讓英文副題與坐標拉寬（112%–118%），正文略收（96%）；中文用使用者系統字，不另載中文網頁字型。serif 只出現在品牌標記，像圖章而非標題字。

### Hierarchy

- **Plate Title**（700，clamp(2.1rem, 3.9vw, 3.3rem)，1.05）：首頁實景圖帶上的「強積金基金圖」，只此一處；手機用 Plate Title Mobile（2rem）。
- **Sheet Title**（650，clamp(1.7rem, 2.6vw, 2.35rem)，1.2）：內頁圖幅標題。
- **Headline**（650，1.5rem）：頁內 h2。
- **Title**（650，1.35rem）：圖幅頭（`kw-sheet__head`）標題。
- **Body**（400，16px，1.65，寬度 96%）：正文；說明段落上限 72–88ch。
- **Data**（600，0.9–0.92rem，tabular numerals）：標題欄值、圖例計數、表格數字。
- **Stat Value**（600，1.05rem，tabular numerals）：內頁統計列數值；刻意只比正文大一級，不作儀表板大數字。
- **Supporting**（400，0.85rem）：圖例計數、圖幅頭腳說明、頁尾標題欄正文。
- **Label**（400，0.72rem）：標題欄 dt；頁尾標題欄 dt 加 0.06em 字距。
- **Caption**（400，0.78rem，1.5）：表頭、表格 caption、圖例註、圖幅索引附註。
- **Atlas Label**（400，11px）：基金圖 SVG 刻度數字與軸標題（中文 11.5px、英文 10.5px 寬體）。
- **English Subtitle**（0.9rem，寬度 118%，0.06em）：中英對照的英文行，淺金或 muted。
- **Grid Reference**（600，10px，0.08em，`gold-strong`）：A–H／1–8 圖格坐標。

### Named Rules

**The Tabular Rule.** 所有數字欄、統計值、圖例計數、標題欄值都用 tabular numerals；但數字字串照官方原文輸出，不固定小數位、不補 0。

**The Serif Is a Seal Rule.** Georgia 只用於 kW 標記與 KWMPF 字樣（頁首、頁尾標題欄）；任何標題、數字都不用 serif。

**The Bilingual Label Rule.** 圖名、軸標題、標題欄名稱以中文為主、英文為副（寬體、較小），英文不取代中文。

## Layout

內容上限 `1520px`，側內距 `clamp(18px, 4vw, 64px)`（中螢幕 28px、手機 20px）。主內容 `28px 72px` 上下內距；圖幅之間 40px。

首頁是一個全寬圖版：深青帶（桌面 180px、手機 120px）托起一個圖框，框內由上而下是地名索引（搜尋）→ 實景圖帶（clamp(190px, 16vw, 250px)，手機 168px，標題壓在左側漸層上，圖片來源 caption 在右下；手機移到相片下方）→ 標題欄（1.5fr + 4 × 1fr + 1.6fr；≤1050px 三欄；≤760px 兩欄並移到基金圖之後）→ 基金圖圖幅（左圖例 200–250px、右圖；≤1050px 圖例改橫排在上）。之後是圖幅索引，以及「測量紀錄＋目錄」7:5 雙欄（≤1050px 單欄）。

內頁以圖幅標題開頭：標題與說明左右對齊於一個 neatline 圖框，底部一行標題欄格（auto-fit，最少 150px；手機兩欄）。

斷點：1050px（圖例橫排、頁首換行、頁尾標題欄兩欄）、760px（圖框去掉側邊與 outline、單欄、標題欄兩欄、頁尾單欄）。

**The Fixed Grid Rule.** 基金圖圖格固定 A–H（橫）× 1–8（縱），在任何寬度同一組數據得出同一圖格；相片圖框上的坐標與刻度對齊。

## Elevation & Depth

全站零陰影（`--kw-shadow-1`／`--kw-shadow-2` 設為 none）。深度只有三種手段：paper 與 sheet 兩級紙色；1px 實線框加 4px 偏移 outline 的雙線 neatline；以及深青帶托起白圖框。相片上的文字靠深青漸層（92% → 74% → 0）及 caption 半透明底，不靠投影；圖格坐標在相片上只用 3px 柔光 text-shadow 保讀性。

**The Neatline Rule.** 一個可獨立閱讀的圖幅 = 1px 框線（首頁圖框與內頁標題用 navy，一般圖幅用 rule-strong）+ `outline: 1px solid rule; outline-offset: 4px`。手機去掉 outline。

## Shapes

全部直角語言：面板、控制、按鈕 2px；分段控制內鈕 1px；捲軸、可用度條 0。唯一圓形是 kW 標記（34px，淡金 1px 圈）、圖例圓點（9px）及基金圖測量點（r 3，選中 r 4）。

刻度尺用 `repeating-linear-gradient`：金色 1px，每 12px 一小刻（4–5px 高），每 60px 一大刻（7–9px 高），頁首底邊 70% 不透明。章節標題下用兩個 1px × 9px 金色短刻（48px、96px）作基準標記。

## Components

### Buttons

- **Shape:** 直角（2px），最少 44px 高。
- **Primary:** action 深青底、白字、600，`10px 18px`；hover 轉 action-hover，邊框同步。
- **Secondary:** 白底 action 字；hover 轉 soft 底。
- **Gazetteer:** 地名索引內的搜尋按鈕用 gold-light 底、navy 字，hover 轉 gold-hover；與輸入框無縫相連（輸入框去右邊框）。
- **Focus:** 全站 2px highlight outline、2px offset；深青底上改 gold-light。

### Inputs / Fields

- **Style:** 白底、1px control border、2px、`10px 12px`、44px 高；hover 邊框轉 action。地名索引內邊框為 gold-light。

### Navigation

- **Header:** navy 68px，底邊金色刻度尺（`.kw-header::after`）。左 kW 標記 + serif KWMPF + 寬體英文副題；導覽 0.95rem nav-link 色，hover／現時頁轉 gold-light，現時頁 3px 金底線；右側資料狀態連結與閱讀模式（透明底、`#3f6672` 1px 框，選中 gold-light 底 navy 字）。≤1050px 換行。

### Gazetteer 地名索引

搜尋即「地名索引」：navy 帶，左側 gold-light 粗體名稱（0.08em 字距）＋說明，中間輸入＋按鈕，右側常用捷徑白字；底線 1px gold。手機單欄。

### Photo Band 實景圖帶

全寬維多利亞港實景（`apps/web/public/images/hk-harbour-{1200,2400}.webp`，David Iliff，Wikimedia Commons，CC BY-SA 3.0；`CREDITS.md`），上緣與右緣金色刻度，圖格坐標淺金印在刻度旁；左側漸層上放圖版標題（中文、寬體英文副題、說明）；右下 caption 寫作者與授權連結。列印時隱藏。

### Title Block 標題欄

取代儀表板統計數字。dt 用 label、muted；dd 用 data 600；格與格之間 1px rule。出現於首頁圖框（圖名、截至日期、來源等）、內頁圖幅標題底、頁尾（navy 框、serif KWMPF、聲明行跨全寬）。內頁 `kw-stats` 統計列同一語言：navy 頂線、rule-strong 底線、1.05rem 數值、無大號數字。

### Fund Atlas 基金圖

SVG 散點：3 年波幅 × 1 年回報，navy neatline、`atlas-grid` 格線、rule-strong 虛線零線、gold-strong 圖格坐標、中英軸標題。測量點預設 context，選中類別 highlight（白描邊）；指向顯示 tooltip（基金名、計劃、原值、日期、圖格參照），點擊開該基金頁。圖例即篩選：44px 列、9px 圓點，選中 legend-selected 底 + highlight 圓點；樣本說明點與分布框。下方表列各積金局基金類型的數量與中位數，caption 標明本站計算。

**Motion:** 唯一動態：選類別時四分位分布框 360ms `cubic-bezier(0.2, 0, 0, 1)` 淡入；測量點 fill／r 220ms 過渡。`prefers-reduced-motion: reduce` 下關閉。

### Sheet Index 圖幅索引

每個積金局基金類型一行條帶：rule 軌、虛線零點、highlight 點（55% 不透明，hover 全實＋navy 描邊）、gold-strong 2px 中位數短線（本站計算）。按類別分組，組標題下 rule-strong 線。

### Tables and Panels

表頭 table-head 暖白底、navy 底線、label 字級；數字右對齊、tabular。面板（卡片、工具列、圖表容器、表格容器）一律 sheet 底、rule 框、2px、無陰影。分段控制 rule-strong 框，選中 navy 底白字。

## Do's and Don'ts

### Do:

- **Do** 照官方原文顯示數字：披露寫 `1.205%` 就顯示 `1.205%`；不固定小數位、不補 0、不四捨五入、不正規化標籤。
- **Do** 把官方 `n.a.` 顯示為「官方未提供」，與 0 及「未取得」分開；不以風險級別或基金種類補位。
- **Do** 在每個數值、圖幅標題欄及 tooltip 旁保留該來源自己的截至日期；便覽與平台日期分開標示。
- **Do** 把中位數、四分位、分布、平均等衍生數值標明「本站計算」。
- **Do** 只用積金局基金類型（ADR 0011）分類、分組、上圖例；比較與排名只在同一類型內進行。
- **Do** 用 neatline（1px 框 + 4px 偏移 outline）界定可獨立閱讀的圖幅，用標題欄記錄圖名、日期、來源。
- **Do** 在地圖語境（頁首底邊、相片圖框）用金色刻度尺；它們是刻意的測繪尺，不是裝飾紋理。
- **Do** 每一張出貨圖片在 `apps/web/public/images/CREDITS.md` 記錄作者、來源與授權。

### Don't:

- **Don't** 加陰影、圓角卡片（> 2px）或大號儀表板統計數字。
- **Don't** 在基金圖按類別用多色；保持單一 highlight 對 context。
- **Don't** 用編輯分類（如三桶資產）或任何非積金局基金類型的分組。
- **Don't** 把過期或未核實的數值畫入圖或參與排名；原值表可保留原文。
- **Don't** 用一隻基金的披露或另一來源的截至日期頂替另一隻。
- **Don't** 把金色刻度或網格紋理用在非地圖的內容面板。
- **Don't** 把 serif 用於標題或數字；只限 kW 標記與 KWMPF 字樣。
- **Don't** 把基金圖的「圖格」坐標搬到基金頁：它依賴基金圖由數據決定的軸域，離開基金圖就不成立。
