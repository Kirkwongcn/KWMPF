---
name: "KWMPF"
description: "沿用原有研究品牌，呈現可查證的強積金原值、日期與來源"
colors:
  paper: "#f6f5f1"
  ink: "#16252c"
  navy: "#123b46"
  action: "#0f414e"
  teal: "#267786"
  gold: "#c7a66a"
  gold-light: "#d8b774"
  muted: "#5b666c"
  muted-strong: "#537080"
  line: "#d9ddd8"
  control-border: "#7b8681"
  soft: "#f2f4f1"
  table-head: "#f5f7fa"
  white: "#fff"
  nav-link: "#d3e0eb"
  brand-subtitle: "#b7cbd1"
  positive: "#006b37"
  negative: "#9a3b3b"
  warning-bg: "#fff6e8"
  stale: "#a57837"
  missing: "#c7cfda"
  category-ochre: "#a7864e"
  category-slate: "#536e7b"
  category-violet: "#81768c"
  category-green: "#61887a"
  category-rose: "#a96065"
typography:
  display:
    fontFamily: 'Georgia, "Times New Roman", "PMingLiU", serif'
    fontSize: "clamp(28px, 3.4vw, 50px)"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  title:
    fontFamily: 'Georgia, "Times New Roman", "PMingLiU", serif'
    fontSize: "1.65rem"
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  subheading:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Microsoft JhengHei", sans-serif'
    fontSize: "1.2rem"
    lineHeight: 1.3
  body:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Microsoft JhengHei", sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  control:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Microsoft JhengHei", sans-serif'
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.65
  action-label:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Microsoft JhengHei", sans-serif'
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
  brand:
    fontFamily: 'Georgia, "Times New Roman", "PMingLiU", serif'
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  panel: "4px"
  control: "8px"
  table: "10px"
  badge: "5px"
  mode-track: "4px"
  mode-option: "3px"
  brand-mark: "50%"
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
    backgroundColor: "{colors.navy}"
    textColor: "{colors.nav-link}"
    typography: "{typography.body}"
    padding: "20px 0"
  navigation-current:
    textColor: "{colors.white}"
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
  return-heatmap:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.24}"
  calendar-columns:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.24}"
  allocation-composition:
    textColor: "{colors.ink}"
    typography: "{typography.supporting}"
  disclosure:
    textColor: "{colors.action}"
---

# Design System: KWMPF

## Overview

**Creative North Star: "可查證的資料工作台"**

沿用使用者於 2026-09-30 明確要求恢復的 KWMPF 原有風格：深青色頁首、金色 kW 圓形標記、Kirk Wong Research 名稱、serif KWMPF 字樣，以及既有世界地圖 hero。暖白底與小圓角資料面板承接品牌，不延續先前的鈷藍替代方案。

一般強積金成員與專業研究者同等重要。簡潔與深入分析共用資料、選取與來源入口；圖表協助辨認幅度、期間及組成，完整原值表格負責核對。繁體中文、清楚標籤、鍵盤焦點及手機可操作的捲動入口是共同閱讀條件。

此文件由目前 CSS 與元件抽取，記錄已實作的視覺規則。原有風格是使用者指定的方向；這不代表所有資料來源或發布流程已獲完整正確性認證。既有 hero 沿用 repository 圖片，本次沒有新增或生成 raster。

**Key Characteristics:**

- 原有深青與金色品牌，暖白閱讀底。
- serif 品牌與主標題，sans 正文及控制項。
- 4px 資料面板、8px 控制項及等寬資料數字。
- 圖表類型按資料語意選擇，原值、日期與來源保留。
- 兩種閱讀模式均可進入核對資料，手機保留完整表格入口。

## Colors

暖白、深青與金色延續原有研究品牌；青綠與資料語意色服務比較。

### Primary

- **深青頁首**（`navy`）與 **深青操作色**（`action`）：前者承載品牌導覽，後者用於連結、按鈕及白色表面的鍵盤焦點。
- **資料青綠**（`teal`）：點圖、曆年正值柱及配置第一類；負值使用 `negative`。

### Secondary

- **品牌金**（`gold`）與 **亮金**（`gold-light`）：沿用的品牌標記、深色表面焦點、當前導覽底線及部分面板識別。
- **資料狀態色**：`positive`、`negative`、`warning-bg`、`stale`、`missing` 分別協助辨認符合、負值／未核實、警示、過期與缺項；仍須有文字。
- **配置類別色**：`teal` 配合 `category-ochre`、`category-slate`、`category-violet`、`category-green`、`category-rose` 區分項目，不代表優劣。

### Neutral

- `paper` 為暖白頁面，`white` 為資料面，`soft` 為圖軌與未著色狀態，`table-head` 為表頭。
- `ink`、`muted-strong`、`muted` 分別承擔主文字、次要說明及日期來源；深色頁首使用 `nav-link` 與 `brand-subtitle`。
- `line` 用於分組邊界；`control-border` 讓輸入框與零線清楚可辨。

### Named Rules

**The 狀態要有文字 Rule.** 顏色只提供第二條辨識線索；過期、未取得、未核實與抽取異常必須同時以文字交代。

## Typography

**Display Font:** `display` 的 Georgia / Times New Roman / PMingLiU serif 組合，承接原有品牌及主標題。
**Body Font:** `body` 的 Inter 優先、系統 sans 備援組合；記錄的是 CSS 宣告，不宣稱另行安裝或下載字型。
**Label/Mono Font:** 控制項沿用正文；資料使用 tabular numerals，快照識別碼才使用 code 字體。

### Hierarchy

- **Display**：hero 主標題使用 `display`，正常字重與平衡換行。
- **Title / Subheading**：主段使用 serif `title`，手機降至 (1.4rem)；次段使用 sans `subheading`。
- **Body**：`body` 用於內容；長篇方法說明上限 (72ch)。
- **Control / Action Label / Label**：控制項共用尺寸，按鈕和欄位標籤以較重文字辨認。
- **Supporting / Data / Caption**：輔助文字交代日期來源，等寬原值方便核對，圖題直接命名圖表。
- **Brand**：`brand` 專供 KWMPF 字樣；Kirk Wong Research 是品牌識別文字，不擴張為全站眉題樣式。

### Named Rules

**The 原值先行 Rule.** 官方百分比保留原始精度；零值、尚未取得、官方明示未披露及抽取異常分開呈現。

## Layout

內容最大寬度 (1520px)，桌面側內距為 `clamp(18px, 4vw, 64px)`；來源在 (1050px) 以下覆寫為 (28px)，在 (700px) 以下覆寫為 (20px)。頁首最小高度為 (72px)，窄螢幕導覽換行，連結保持至少 (44px) 操作高度。

閱讀模式與資料覆蓋入口位於 hero 下方。內頁主要上下留白為 (40px / 72px)，手機為 (28px / 48px)。篩選列由四欄改為兩欄，再改為單欄；相關資料使用 `spacing.16` 至 `spacing.24`，跨區塊採更大的留白。

一般寬表保留完整欄位並在自己的容器水平捲動；回報矩陣最小寬度為 (640px)。捲動提示與可取得焦點的區域一起提供。兩欄費用、配置、曆年表取消一般 (600px) 最小寬度，採固定欄寬與文字換行，首欄約佔 (60%)。

點圖與條形圖在手機將標籤、身份及原值置於上列，圖軌移至下列。配置圖例由兩欄改為單欄，圓環由 (200px) 改為 (180px)。標籤保留計劃／類別身份，不能只以同名成分基金名稱辨認。

## Elevation & Depth

資料面常態以白底、細邊界及表頭分層。沒有資料卡片投影；閱讀模式選取仍沿用 `0 2px 5px #17223114`，計劃選取使用 `inset 0 0 0 1px var(--kw-action)` 作狀態內框。點圖的外描邊用於辨認資料點，不是容器浮起。

### Named Rules

**The 平面資料面 Rule.** 資料面板以細邊界分組；投影只沿用已實作的選取控制狀態，不擴張為卡片裝飾。

## Shapes

資料面板、圖表、工具列及組別選擇使用 `rounded.panel`；按鈕與輸入使用 `rounded.control`。表格容器保留 `rounded.table`，狀態標籤使用 `rounded.badge`。品牌 kW 圓形、資料圓點與配置圓環有實際識別或數據用途，並非裝飾遮罩。

## Components

### Buttons and Fields

主要按鈕為深青底白字，次要為白底深青字；內距 (10px 18px)，最小高度 (44px)。輸入內距 (10px 12px)，有明確邊界及上方標籤。白色表面焦點為深青外框 (3px)，偏移 (3px)；深色頁首與 hero 焦點使用亮金。背景狀態轉換為 (180ms ease-out)，reduced-motion 時移除。來源目前仍有主要按鈕的鈷藍滑入遺留；此值不列為品牌 token。

### Navigation and Reading Mode

頁首保留 kW 圓形、Kirk Wong Research 與 serif KWMPF；導覽為「基金瀏覽／基金排名／計劃比較」。當前頁以白字、較重字及亮金底線共同標示。閱讀模式是帶 `aria-pressed` 的兩個按鈕；深入分析預設展開更多資料，簡潔仍可進入來源、限制與完整表格。頁尾保留方法、覆蓋、官方平台與免責入口。

### Chips and Panels

狀態標籤為柔灰底、短文字及 (3px 7px) 內距。資料面板使用白底細邊界、`rounded.panel` 及 `spacing.24`，手機內距為 (18px)。既有 hero 上方小標籤僅記錄為現況，不作新頁的通用標題模式。

### Tables and Disclosures

表格用柔淡表頭、左對齊、等寬數字及原值旁的日期來源。原生 details / summary 在兩種模式均可操作。過期數值仍可保留在原值表格，但日期及狀態必須在場。「未取得」表示本快照沒有可用值；不自行推論官方未披露。

### Numeric Comparisons

排名的圖表／完整表格選擇，以及組別、期間與指標保留在網址。點圖／橫條的 chartKind 選擇目前只保存在元件內的本機狀態，不保存在網址。每幅圖共用含零的實際尺度，各指標使用自己的單位；選同一比較組別才作排名圖，跨組只可明示並列。排名圖限制首十個時保留說明與完整入口。基金並列的點圖只繪 verified 期間；過期、未核實及缺失保留狀態文字而不畫數值點。

### Return Matrix

四個年率化期間形成回報矩陣，每格保留原值、時效、日期與來源。已核實可用值依絕對幅度使用青綠／負值紅透明度 (0.06–0.28)；過期及未核實值保留文字，使用柔灰底且不參與色階。不同期間不構成時間走勢。

### Calendar Returns

曆年回報使用獨立柱形與共同零線；每柱代表完整曆年，不連線、不推造 NAV。缺失不畫成零，下方緊湊表格保留原值。

### Allocation

先經保守的顯示守門核對標籤及有限數值。異常抽取暫不顯示圖表與數值表，提供便覽入口並說明這不代表官方沒有披露。通過守門、非負且合計 (99–101%) 的配置，最多六項用圓環，更多項用堆疊；合計調整只影響圖形長度，原值不改。不完整但可用的配置退回獨立條形。前端守門不能替代來源 parser 修復。

## Do's and Don'ts

### Do:

- **Do** 沿用原有深青頁首、金色品牌標記、serif 品牌字與既有地圖 hero。
- **Do** 保留官方百分比原值、各欄位日期及來源；非官方分類與本站統計明示身份。
- **Do** 用點圖或條形比較數值、矩陣比較期間、獨立柱圖呈現曆年回報，完整表格保留核對入口。
- **Do** 只有有效的非負完整組成使用圓環或堆疊；不完整但可用的配置退回獨立條形。
- **Do** 保留同名基金的計劃與類別身份，讓簡潔及深入分析都能查看來源與限制。
- **Do** 使用「未取得」描述未知缺項；只有來源明示沒有披露時，才使用「官方未提供」及原因。
- **Do** 為寬表提供捲動提示，兩欄費用、配置及曆年表在手機使用緊湊可換行版面。

### Don't:

- **Don't** 為了對齊而補零、四捨五入或固定官方百分比的小數位。
- **Don't** 把過期或未核實回報繪成可用數值圖；矩陣可保留原值但不著色、不參與色階。
- **Don't** 把跨組別並列當排名，或把回報、費用與風險合成推薦分數。
- **Don't** 把不同期間或獨立曆年回報連成未披露的 NAV／價格走勢。
- **Don't** 用同一快照日期覆蓋欄位日期，或讓閱讀模式隱藏來源入口。
- **Don't** 把被隔離的解析異常當作官方沒有披露，或將前端顯示守門當作來源 parser 已修復。
- **Don't** 將未驗收的生產資料、遺留滑入色或既有 hero 上方小標籤擴張成新頁的規範。
