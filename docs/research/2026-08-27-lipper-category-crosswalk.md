# Lipper 香港退休基金分類與官方平台 fundType 對照

日期：2026-08-27
來源：`data/sources/lipper/2026-08-27-mpf-navigator-portfolio-change.xlsx`（Sheet2，Asset Universe = Pension Funds）
比對對象：`data/sources/2026-08-13/mpf-fund-platform.json`（451 隻，dataAsOf 2026-07-31）

## 結論

採用 Sheet2 分類作為網站的同類比較單位。它比官方平台 fundType 更貼近使用者慣用的比較口徑，
但**無法從平台資料自動推導**，必須以「基金 → 分類」對照表維護。

## 兩套分類的規模

- Sheet2：25 個分類、441 隻基金
- 平台 fundType：24 個分類、451 隻基金

## 自動比對結果

以名稱模糊比對（scheme + constituent fund + class，相似度門檻 0.62）：

- 自動配對 422 / 441（95.7%）
- 未配對 19 隻，全部集中在兩個計劃的簡稱寫法差異：`MASS MPF`（9 隻）、`BOC-Pru Easy-Choice MPF`（10 隻）。
  加一張計劃簡稱別名表即可解決。
- 另有約 5 隻屬明顯錯配（例：Japanese Equity 配到 Europe Equity Fund），需人手覆核。

Sheet2 名稱是 Lipper 約 50 字元截斷格式，沒有 `fundClassId`，所以對照表要人手確認一次，
之後以 `fundClassId` 為主鍵鎖定，季度更新時只需處理新增／刪除。

## 一對一的分類（可直接對應）

| Sheet2 分類 | 平台 fundType |
|---|---|
| Asian Bond | Bond Fund - Asia Bond Fund |
| China Equity | Equity Fund - China Equity Fund |
| DIS - Age 65 Plus Fund | Mixed Assets Fund - DIS - Age 65 Plus Fund |
| DIS - Core Accumulation Fd | Mixed Assets Fund - DIS - Core Accumulation Fund |
| European Equity | Equity Fund - Europe Equity Fund |
| Global Bond | Bond Fund - Global Bond Fund |
| Global Equity | Equity Fund - Global Equity Fund |
| Greater China Equity | Equity Fund - Greater China Equity Fund |
| Guaranteed Fund | Guaranteed Fund |
| Hong Kong Dollar Bond | Bond Fund - Hong Kong Dollar Bond Fund |
| Hong Kong Equity | Equity Fund - Hong Kong Equity Fund |
| Hong Kong Equity (Index Tracking) | Equity Fund - Hong Kong Equity Fund (Index Tracking) |
| Japanese Equity | Equity Fund - Japan Equity Fund |
| Lifestyle - (>20-40% Equity) | Mixed Assets Fund - 21% to 40% Equity |
| Lifestyle - (>40-60% Equity) | Mixed Assets Fund - 41% to 60% Equity |
| Lifestyle - (>60-80% Equity) | Mixed Assets Fund - 61% to 80% Equity |
| Lifestyle - (>80-100% Equity) | Mixed Assets Fund - 81% to 100% Equity |
| MPF Conservative Fund | Money Market Fund - MPF Conservative Fund |
| RMB Bond Fund | Bond Fund - RMB Bond Fund |
| United States Equity | Equity Fund - United States Equity Fund |

## 三處無法自動推導（必須靠對照表）

1. **亞洲股票拆兩檔**：平台只有一個 `Equity Fund - Asia Equity Fund`（30 隻），
   Sheet2 拆成 Asia ex Japan Equity（14）同 Asia Pacific ex Japan Equity（19）。
2. **Other Fund（45 隻）**：包含目標日期基金（SaveEasy、Target Retirement、20xx Retirement）、
   退休入息、行業主題（Healthcare）、Korea、彈性配置等。平台將它們散落在
   Mixed Assets - Uncategorized（37）、Equity - Uncategorized（5）、RMB Bond、Money Market 等。
3. **貨幣市場**：平台一個 `Other than MPF Conservative Fund`（12 隻），
   Sheet2 拆成 Hong Kong Dollar Money Market（3）同 RMB and HKD Money Market（6）。

## 建議

- Sheet2 分類作為**顯示與同類比較的主分類**；平台 fundType 保留為次要欄位（做交叉檢查同回溯）。
- `Other Fund` 45 隻對比較意義不大，建議在網站再細分（目標日期／退休入息／主題／彈性配置），
  屬 Sheet2 之上的加工，需標明是本站分類。
- 對照表以 `fundClassId` 為主鍵，存成版本化 JSON，季度更新時出「新增／刪除／改分類」差異報告。

## 附註：Sheet1

同一檔案的 Sheet1 與基金分類無關。使用者已指示不用理會，本專案不入庫、不引用。
