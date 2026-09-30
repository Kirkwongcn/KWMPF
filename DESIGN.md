---
name: KWMPF
description: 以原值、日期與來源建立可查證的強積金資料比較介面
colors:
  paper: "#f6f7f9"
  ink: "#172231"
  action: "#244ac2"
  action-hover: "#183694"
  muted: "#586475"
  muted-strong: "#46566c"
  line: "#dce1e8"
  control-border: "#8b96a7"
  soft: "#edf1f7"
  white: "#fff"
  positive: "#146344"
  positive-bg: "#edf7f1"
  negative: "#a32d3d"
  negative-bg: "#fff0f1"
  negative-text: "#8b2230"
  warning-bg: "#fff6e8"
  warning-text: "#69480c"
  warning-border: "#966311"
  stale: "#a57837"
  missing: "#c7cfda"
  category-teal: "#238477"
  category-amber: "#ad7b37"
  category-violet: "#9867a0"
  category-slate: "#637189"
  category-rose: "#b45967"
typography:
  headline:
    fontSize: "2.5rem"
    lineHeight: 1.3
    letterSpacing: "-0.035em"
  title:
    fontSize: "1.65rem"
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  subheading:
    fontSize: "1.2rem"
    lineHeight: 1.3
  body:
    fontFamily: '"Segoe UI", "Microsoft JhengHei", system-ui, sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  control:
    fontFamily: '"Segoe UI", "Microsoft JhengHei", system-ui, sans-serif'
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.65
  action-label:
    fontFamily: '"Segoe UI", "Microsoft JhengHei", system-ui, sans-serif'
    fontSize: "0.95rem"
    fontWeight: 600
    lineHeight: 1.65
  label:
    fontSize: "0.9rem"
    fontWeight: 600
    lineHeight: 1.65
  supporting:
    fontSize: "0.875rem"
    lineHeight: 1.65
  data:
    fontSize: "0.95rem"
    fontWeight: 600
    lineHeight: 1.65
  caption:
    fontSize: "1.15rem"
    fontWeight: 650
    lineHeight: 1.65
rounded:
  control: "8px"
  panel: "12px"
  table: "10px"
  badge: "5px"
  mode-track: "9px"
  mode-option: "6px"
spacing:
  "8": "8px"
  "12": "12px"
  "16": "16px"
  "20": "20px"
  "24": "24px"
  "28": "28px"
  "32": "32px"
  "40": "40px"
  "48": "48px"
  "64": "64px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.white}"
    typography: "{typography.action-label}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
    textColor: "{colors.white}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.action}"
    typography: "{typography.action-label}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-secondary-hover:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.action}"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  navigation:
    textColor: "{colors.muted-strong}"
    typography: "{typography.body}"
    padding: "24px 0"
  navigation-current:
    textColor: "{colors.action}"
  reading-mode:
    backgroundColor: "{colors.soft}"
    rounded: "{rounded.mode-track}"
    padding: "4px"
  reading-mode-option:
    textColor: "{colors.muted-strong}"
    rounded: "{rounded.mode-option}"
    padding: "7px 12px"
  reading-mode-selected:
    backgroundColor: "{colors.white}"
    textColor: "{colors.action}"
    rounded: "{rounded.mode-option}"
  status-badge:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.badge}"
    padding: "3px 7px"
  panel:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.24}"
  data-table:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.table}"
  value-chart:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.24}"
  disclosure:
    textColor: "{colors.action}"
---

# Design System: KWMPF

## Overview

**Creative North Star: "可查證的資料工作台"**

這個介面以日間研究場景為出發點：明亮灰白底、石墨文字、白色資料面板與鈷藍操作色。繁體中文是主要閱讀語言；資訊密度可以隨簡潔及深入分析模式改變，但基金數值、日期、來源與資料限制始終可以查閱。

視覺重點是閱讀與核對。標題直接命名內容，表格、原值文字及條形圖共同承載證據，色彩協助辨認操作和狀態。一般強積金成員與專業研究者同等重要，因此共同控制項保留清楚標籤、鍵盤焦點及手機操作空間。

此文件由完成後的 CSS 與元件抽取。使用者確認的是雙重用途與閱讀模式；色盤、字型及尺寸屬本次實作的現況，並非使用者逐項指定或批准的品牌選擇。標題字型尚未形成可供新頁繼承的展示字型決策。

**Key Characteristics:**

- 明亮底色、石墨文字及單一鈷藍操作色。
- 白色面板以細邊界分組，常態不浮起。
- 原值文字、欄位日期及來源與圖表共同呈現。
- 簡潔與深入分析共用資料與控制項。
- 表格數字採等寬數字，手機保留完整內容的捲動入口。

## Colors

色盤由冷灰白閱讀底、深色文字及鈷藍操作色構成，資料狀態與配置類別另有語意色。

### Primary

- **操作鈷藍**（`action`）：連結、主要按鈕、當前導覽、選取狀態、焦點框及正向條形圖；按鈕滑入使用較深的 `action-hover`。

### Secondary

- **資料狀態色**：`positive` 與 `positive-bg` 用於符合狀態；`negative`、`negative-bg`、`negative-text` 用於負值或錯誤；`warning-bg`、`warning-text`、`warning-border` 用於警示。可用度圖以 `stale` 及 `missing` 分辨過期與官方未提供。
- **配置類別色**：鈷藍配合 `category-teal`、`category-amber`、`category-violet`、`category-slate`、`category-rose` 區分配置項目。這些色彩表達類別，不表示優劣、風險或推薦。

### Neutral

- **冷白紙底**（`paper`）與 **白色面板**（`white`）：頁面與內容的主要表面。
- **石墨文字**（`ink`）：標題、正文及主要資料；`muted-strong` 用於次要說明與未選取導覽，`muted` 用於來源、日期及輔助文字。
- **柔灰表面**（`soft`）：表頭、圖軌、閱讀模式底層及資料缺口容器。
- **細灰邊界**（`line`）與 **控制項邊界**（`control-border`）：前者分組，後者讓輸入框保持可辨識。

### Named Rules

**The 狀態要有文字 Rule.** 顏色只提供第二條辨識線索；過期、缺失、未核實與錯誤必須同時以文字交代。

**The 操作與分類分工 Rule.** 鈷藍標示可操作或已選取的介面；配置類別色不承擔推薦或綜合評分。

## Typography

**Display Font:** 尚未定為規範；目前大標題沿用正文的系統 sans，此項保留為未規範化的現況。
**Body Font:** `body` 的 Segoe UI / Microsoft JhengHei 系統字型組合。
**Label/Mono Font:** 控制項沿用正文；數字以 tabular numerals 對齊，程式碼與快照識別碼才使用瀏覽器的 code 字體。

**Character:** 正文與控制項採統一 sans，透過尺寸、字重及留白分層。資料值比註解更醒目，原值的字串形態不因視覺整齊而改寫。

### Hierarchy

- **Headline**：內頁主標題使用 `headline`；手機降至 (1.9rem)。字型選擇不在此角色承諾內。
- **Title**：主要段落標題使用 `title`；手機降至 (1.4rem)。
- **Subheading**：面板與次段標題使用 `subheading`。
- **Body**：`body` 用於內容及說明；長篇方法說明的行長上限為 (72ch)。
- **Control / Action Label**：輸入框與按鈕共用尺寸；操作文字使用較重的 `action-label`。
- **Label / Supporting**：欄位標籤使用 `label`；日期與短註解使用 `supporting`。狀態、圖例等緊湊輔助字在來源中另有較小尺寸，不擴張成新的全站字級。
- **Data / Caption**：`data` 用於醒目原值，`caption` 用於圖表標題；資料表與資料值採等寬數字。

### Named Rules

**The 原值先行 Rule.** 官方披露的百分比保留原始顯示精度；零值以零值顯示，缺失值以「官方未提供」或對應狀態顯示。

## Layout

內容置於置中的最大寬度 (1360px) 容器；桌面左右內距為 (40px)，在 (1050px) 以下改為 (28px)，在 (700px) 以下改為 (20px)。內頁主要區域上下留白為 (40px / 72px)，手機改為 (28px / 48px)。

相鄰控制項常用 `spacing.8`，欄位與表格內容使用 `spacing.16`，面板內距及相關資料間隔使用 `spacing.24`。段落及跨區塊的距離逐步擴大至 `spacing.32`、`spacing.48` 及 `spacing.64`。來源中存在針對個別元件的其他間距；不把每個單次值擴張成全站尺度。

篩選列在桌面採四欄，於中等寬度改為兩欄，手機改為單欄。深入解讀與計劃列表以網格分組，窄螢幕按內容需要改為單欄。導覽在 (1050px) 以下換行；手機導覽連結保持至少 (44px) 操作高度。閱讀模式始終留在頁首。

表格維持欄位完整性，在自己的容器內水平捲動；一般資料表的最小寬度為 (600px)，計劃逐項比較為 (760px)。捲動提示及方向鍵入口與表格一起提供。條形圖在手機將標籤與原值置於第一列，圖軌置於第二列。

目前頁首來源的最小高度為 (80px)，與方向契約的 (72px) 有差異；這是記錄的偏差，不是新增的全站高度規範。

## Elevation & Depth

系統常態以白色內容面、冷白紙底、柔灰表頭和單像素邊界建立層次。資料面板與圖表不用投影；少量深度僅用於閱讀模式的已選取選項。選取計劃的內描邊是狀態邊界，沒有把卡片抬離頁面。

### Shadow Vocabulary

- **閱讀模式選取**（`0 2px 5px #17223114`）：白色選項在柔灰模式軌道上輕微浮起。
- **計劃選取內框**（`inset 0 0 0 1px var(--kw-action)`）：與鈷藍邊界共同標示已勾選計劃。

### Named Rules

**The 平面資料面 Rule.** 資料面板以細邊界分組；投影只沿用已實作的選取控制狀態，不擴張成卡片裝飾。

## Shapes

內容面板使用 `rounded.panel`，主要輸入與按鈕使用 `rounded.control`，表格容器使用 `rounded.table`。小型狀態標籤使用 `rounded.badge`；閱讀模式軌道及其選項分別使用專屬圓角。

邊界以單像素為主。圖形由矩形條、共享零線及小型色塊構成；標籤和原值承擔主要資訊，幾何形狀補充比例。來源沒有使用裝飾照片、紋理或漸層作為本次視覺語言。

## Components

### Buttons

操作直接且可辨識。主要按鈕使用鈷藍底與白字；次要按鈕使用白底、鈷藍字與鈷藍邊界。兩者使用 `rounded.control`、實際內距 (10px 18px) 及最小高度 (44px)。

滑入時主要按鈕變深，次要按鈕切換到柔灰底。背景狀態轉換使用 (180ms ease-out)。鍵盤焦點為鈷藍外框 (3px)，偏移 (3px)。停用按鈕使用灰色表面與文字並變更游標；不沿用可操作狀態。

### Chips

標籤簡短且不冒充操作。解讀及 DIS 狀態標籤使用柔灰底、`rounded.badge` 及內距 (3px 7px)；成分齊備標籤採符合狀態的底色及文字。標籤中必須出現可理解的狀態名稱。

### Cards / Containers

容器服務資料分組。白色面板使用細灰邊界、`rounded.panel` 及 `spacing.24` 內距；手機內距改為 (18px)。工具列、組別選擇與圖表沿用此形態。計劃已選取狀態改用鈷藍邊界與內框。

### Inputs / Fields

白底、石墨文字、控制項邊界與 `rounded.control` 構成輸入形態。內距為 (10px 12px)，最小高度為 (44px)。欄位標籤置於控制項上方；複合欄位在窄螢幕留足寬度。焦點沿用全站外框，文字游標使用操作色。

### Navigation

文字導覽以強次要文字呈現；滑入轉為鈷藍。當前頁面以 `aria-current`、較重字及底部 (3px) 鈷藍線一起標示。閱讀模式是帶 `aria-pressed` 的兩個按鈕；選取項為白底鈷藍字，普通項留在柔灰軌道上。跳至主內容連結在鍵盤取得焦點時出現。

### Disclosures

來源與比較方法使用原生 details / summary。深入分析模式預設展開，簡潔模式仍可自行展開；來源、日期及非官方分類說明不能因模式而失去入口。全站頁尾持續提供方法、資料狀態、官方平台與免責文字。

### Data Tables

欄位名稱使用柔灰表頭；欄內左對齊、垂直靠上並使用等寬數字。來源與日期以原值旁的文字或獨立欄位呈現，長基金名稱允許換行。行滑入增加柔灰表面；手機透過可操作的水平捲動查看完整欄位。

### Evidence Charts

ValueBars 在每幅圖內共用含零的實際尺度；負值向零線左側延伸，缺失不繪成零。原值文字不依賴圖形讀取，基金標籤可以進入詳情。每幅不同指標圖採自己的單位與尺度。

可用度圖把相同快照的基金類別分為可排名、過期、缺失及未核實，旁列實際數量。配置圖只在非負且合計介乎 (99–101%) 時堆疊；圖形如按合計調整，披露數字仍保留原值並交代合計。其餘情況退回獨立條形圖。

排名的完整表格與同組圖表共用資料；顯示選擇保存在網址，返回或分享後可以恢復。先選同一比較組別，再畫排名比較圖；圖表只取首十個時必須說明並保留完整表格入口。不同期間的官方回報各自顯示，不能連接成價格走勢。

回報、費用、規模與便覽資料各自顯示截至日期；發布快照日期不能代替欄位日期。排名只在同一比較組別內，圖表各自使用實際單位與共享零線，不合成跨指標總分。簡潔與深入分析模式都保留官方來源、資料限制與完整表格的可操作入口。

## Do's and Don'ts

### Do:

- **Do** 保留官方百分比原值與原有精度，並讓零值與缺失值在文字及圖形上明確分開。
- **Do** 為每項時間性數值呈現自己的截至日期與來源；非官方分類及本站統計必須標明。
- **Do** 先選比較組別再提供同組圖表，並保留完整表格與網址中的顯示選擇。
- **Do** 為不同指標各自使用實際單位及共同零線；用文字原值、狀態及圖例補充色彩。
- **Do** 讓簡潔模式可以展開來源與比較限制，讓深入分析模式直接看到核對資料。
- **Do** 沿用白色細邊界面板、可辨識的控制項邊界、鍵盤焦點及 reduced-motion 處理。

### Don't:

- **Don't** 為了對齊而補零、四捨五入或固定官方百分比的小數位。
- **Don't** 把缺失資料畫成零、用風險級別代替波幅，或用別隻基金的披露補欄位。
- **Don't** 把跨組別數量當成優劣排名，或把回報、費用與風險合成推薦分數。
- **Don't** 把不同期間的獨立披露連成價格時間序列，或以範圍中點冒充官方回報。
- **Don't** 用同一快照日期覆蓋所有欄位的日期，或讓閱讀模式隱藏來源入口。
- **Don't** 把未使用的歷史圖片、舊色彩別名或未解決的展示字型偏差視為新頁的品牌規則。
