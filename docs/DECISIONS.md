# KWMPF 已核實的重要決定

這是已存在／已批准決定的索引，不補寫沒有證據的歷史。日期沿用原文件；有較新決定時列明優先關係。
現況／待辦不放這裡，讀 [HANDOFF](HANDOFF.md)。

| 日期 | 已確定決定 | 原因／佐證 |
| --- | --- | --- |
| 2026-08-08 | GitHub 管理 code／批次；Cloudflare Pages、Workers、D1、私有 R2 分工 | [ADR 0001](adr/0001-github-cloudflare-deployment.md)，重型來源處理與公開查詢分離；實際 manifests／workflows 已核實。ADR 的「正常批次自動發布／Workers Cron」是早期構想，不能視為已實作或當前批准，見下列 2026-10-01 決定及 PROJECT_MAP |
| 2026-08-25 | 以 publication snapshot 劃分快取邊界 | [ADR 0002](adr/0002-publication-scoped-edge-caching.md)；validator 細節由 ADR 0009 補正 |
| 2026-09-11 | 便覽內容優先受託人官網、身分配對用積金局登記冊 | [ADR 0003](adr/0003-trustee-first-fact-sheet-sources.md)，保留當期官方內容及完整性；原 ADR 追認 8 月 31 日實作，不把追認日改作開發日 |
| 2026-09-11 | 疊印 PDF 文字層按 draw order 分層 | [ADR 0004](adr/0004-overlaid-text-layer-by-draw-order.md)，避免跨層／跨基金污染 |
| 2026-09-11 | 第一版編輯配置只用股票／債券／現金及其他三桶 | [ADR 0005](adr/0005-editorial-asset-class-buckets.md)，保留官方標籤，明示非官方映射；不能以純地區／行業比例替代 |
| 2026-09-11 | 基金概覽時效按財政期／披露期限判斷 | [ADR 0006](adr/0006-fund-overview-freshness-by-fiscal-period.md)，不把全份便覽套用回報門檻 |
| 2026-09-26 | 季度三年年率化採最長 90 日，其他回報維持 45 日 | [ADR 0007](adr/0007-quarterly-three-year-return-freshness.md)，已記使用者批准；90 日包含邊界，91 日起排除，保留自己的來源日期 |
| 2026-09-27 | 便覽各欄位日期／財政期／lookback window 分開保存 | [ADR 0008](adr/0008-field-scoped-fact-sheet-temporal-scope.md)，document date 不可自動填到 FER、配置或持倉 |
| 2026-09-27 | R2 備份及來源目前不設自動到期 | ADR 0001 及 [deployment](deployment.md) 已記使用者選擇；不是固定永久保留年期，不因此批准刪物件 |
| 2026-09-30 | 保留原 header／品牌風格；簡潔首頁與深入分析同等重要；圖表用實際單位及來源 | [DESIGN](../DESIGN.md)、[全流程審查](reviews/2026-09-30-full-process-and-design-review.md)、已合併 [PR #357](https://github.com/Kirkwongcn/KWMPF/pull/357)；按使用者原風格要求修訂，沒有畫虛構連續走勢 |
| 2026-09-30 | ETag／edge cache 綁定 route、query、程式版本及 UTC 評估日 | [ADR 0009](adr/0009-time-scoped-representation-caching.md)，修正跨 route／期間／日期 validator；仍保留既有 300／600 秒政策，不宣稱日界即時失效 |
| 2026-10-01 | 暫停新增功能，以核實／保存／Claude 交接為優先；不得未經批准合併正式分支、修改 Cloudflare 或部署 | 使用者本次明確交接要求；更新 [AGENTS](../AGENTS.md) 作共用權限邊界。此決定優先於舊文件的自動發布構想或較早自行合併授權 |
| 2026-10-01 | 先安排 GitHub／Cloudflare 儲存及更新交接；NAS 稍後設定 | 使用者明確說 NAS 未設置。GitHub code／文件與私有附件分開；其後 bucket 的獨立批准見下一行。[CLOUD_STORAGE](CLOUD_STORAGE.md) |
| 2026-10-01 | 批准建立獨立私有 `kwmpf-handoff`，Standard／APAC，完整物件不自動到期 | 使用者明確「批准建立 kwmpf-handoff」；API 200／設定讀回。預設未完成 multipart 七日清理保留。當時私有 payload 上傳另待批准；後續独立批准見下一行，沒有擴大到正式網站／D1 操作 |

| 2026-10-01 | 批准清單內兩份私有 ZIP、五份入口文件、manifest／current.json 與記錄完成結果的最終交接修訂上傳及下載核對，本輪上限 15 MB | 使用者明確批准具體清單；僅 `kwmpf-handoff`，完整物件不自動到期。每個版本讀回核對後才更新 latest pointer；不涵蓋網站部署／D1／NAS／新 client credentials。見 [CLOUD_STORAGE](CLOUD_STORAGE.md) |

## 仍是試用／待決，不能升格為定案

- 比較組／個別指標最少三個有效樣本：已核實 `CONTEXT.md`、`comparison-group-stats.ts` 及試用解讀契約，維持現有規則。
- ±2 百分點（`2026-09-10-trial-1`）只屬已批准試用；[原契約](specs/interpretation-thresholds.md) 有日期及原因。
  使用者選擇維持試用，不代表經驗證的正式門檻。
- 另設三年累積回報、完整日／月價格序列、正式監察通知管道、未來保留期限及 branch rules 強化：仍待核實／決策，沒有替使用者定案。
