# 基金 → Lipper 分類對照表建立結果

日期：2026-08-28
對應票：#194（範圍第 1、2、5 點）
產出：`data/reference/fund-class-category-map.json`
程式：`packages/coverage/src/lipper-category-map.ts`、`packages/coverage/src/build-fund-class-category-map.ts`

## 結果

| 項目 | 數目 |
|---|---|
| Lipper 來源基金 | 441 |
| 已對照（`entries`） | 441（100%） |
| 未能對照的 Lipper 基金 | 0 |
| 平台基金類別未獲分類 | 10 |
| 需人手覆核（分數 < 0.75） | 2 |
| 人手覆寫 | 0 |

10 個未獲分類的平台基金類別全部屬 `SHKP MPF Employer Sponsored Scheme`，
原因為 `scheme_not_in_source`——該計劃不在 Lipper 來源檔內。
441 + 10 = 451，與平台快照數目一致。

## 比對方法

先前的分析（`2026-08-27-lipper-category-crosswalk.md`）用全域名稱模糊比對，命中 422/441（95.7%）。
改為三重收窄後達到 441/441：

1. **計劃別名表**（`schemeAliases`，23 條）。Lipper 用截斷簡稱（`BOC-Pru Easy-Choice MPF`、
   `Manulife RC (MPF)`），平台用全名。`BCT MPF` 一個簡稱對兩個平台計劃，
   靠第二段 `Simple` / `Smart` 區分；`AIA MPF`、`HSBC MPF`、`Hang Seng MPF`
   的計劃標籤含第二段（`Prime Value Choice`、`SuperTrust Plus`），須整段納入別名鍵。
2. **單位類別字母**。Lipper 名稱結尾的單一大寫字母（`A` / `B` / `T` / `D` / `I` / `H` / `N`）
   對應平台的 `Class A` / `Unit Class A` 等。比對只在同一計劃、同一類別字母之內進行，
   所以同一隻基金的多個單位類別不會互相搶佔。
3. **縮寫正規化 + 詞元相似度**。展開 Lipper 縮寫（`Eq`→equity、`Trkg`→tracking、
   `Grtr`→greater、`Ind S`→industry、`N Amer`→north america 等），
   去除 `Fund` / `Scheme` 等虛詞，再以詞元 Dice 係數計分（前綴等同，最短 4 字元）。
   全域按分數由高至低貪心指派，同一 `fundClassId` 只可被認領一次。

接受門檻 0.55，覆核門檻 0.75。低於 0.55 不配對、直接報錯，不會靜默回退到平台 `fundType`。

## 兩個低分配對（已人手確認正確）

| 分數 | Lipper | 平台 |
|---|---|---|
| 0.667 | `HSBC MPF-SuperTrust Plus-ValueChoice AsPac Eq Trkr` | ValueChoice Asia Pacific Equity Tracker Fund |
| 0.667 | `Hang Seng MPF-SuperTrust Plus-ValChce NAm Eq Trkr` | ValueChoice North America Equity Tracker Fund |

分數偏低只因兩邊詞元數目差距大（Lipper 截斷得較短），名稱本身無歧義。

## 兩套分類的實質分歧

對照完成後，按 Lipper 分類統計對應的平台 `fundType`，確認分歧集中在四處，
其餘 20 個分類是乾淨的一對一：

- **Asia ex Japan Equity（14）／ Asia Pacific ex Japan Equity（19）**：平台只有一個
  `Equity Fund - Asia Equity Fund`。當中 3 隻 Manulife `Allianz Oriental Pacific`
  在平台屬 `Mixed Assets Fund - Uncategorized`，Lipper 當作亞太股票。
- **Other Fund（45）**：平台散落 Mixed Uncategorized（34）、Equity Uncategorized（5）、
  Other than MPF Conservative（3）、RMB Bond（1）、21–40% Equity（1）、41–60% Equity（1）。
- **貨幣市場**：平台一個 `Other than MPF Conservative Fund`（12），
  Lipper 拆成 Hong Kong Dollar Money Market（3）同 RMB and HKD Money Market（6），
  餘 3 隻歸入 Other Fund。
- **Hong Kong Equity (Index Tracking)（18）**：其中 AIA `Hong Kong and China Fund`
  在平台屬非指數的 `Hong Kong Equity Fund`。屬 Lipper 的判斷，不作改寫。

這些分歧無法從平台資料推導，正是必須維護對照表的原因。

## 季度更新

`bun --filter @kwmpf/coverage category-map <平台快照路徑>` 會重建對照表，
並與現有檔案比較，輸出 `diff`（`added` / `removed` / `recategorized`）及 `requiresReview` 旗標。
有未配對項目時指令以非零狀態結束。未覆核不得發布。

## 接入網站（#194 範圍第 3 點）

seed 產生時把 `lipperCategory` 寫入每筆 `fund_class_versions` payload，並附上
`classification`（提供者、資料集、期別）。API 以 `comparisonGroupFor()` 統一決定比較組別：
有 Lipper 分類就用 Lipper，否則用平台 `fundType` 加「平台分類：」前綴自成一組。
前綴是必需的——Lipper 同平台都有 `Guaranteed Fund` 一名，冇前綴會把 SHKP 那隻靜默併入 Lipper 組。

接入後的比較組別由原本 200 多個平台 `fundTypeDescriptor` 收斂為 32 個
（25 個 Lipper + 7 個平台分類），451 隻基金全部仍然入榜，冇任何一隻被剔走。

`/search` 新增 `category` 篩選、`/filters` 新增 `categories` 及 `classification`、
`/schemes` 每個計劃新增 `categories`、`/rankings` 新增 `comparisonGroups` 及
每行 `comparisonGroupSource`。

### 舊網址

網站的分類篩選一直是查詢參數（`/funds?fundType=`、`/rankings?group=`），冇分類頁 slug，
所以冇 301 可做。改為保留 `fundType` 篩選繼續有效，舊 `/funds?fundType=` 連結原樣運作；
`/rankings?group=` 帶著已停用的平台分類時，排名頁退回「全部組別」並說明分類口徑已改。

## 未做

- `Other Fund` 再細分（另開票）。
