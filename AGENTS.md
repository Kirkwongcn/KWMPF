# KWMPF

香港強積金計劃及基金比較網站。開始工作前先閱讀 `CONTEXT.md`、相關 ADR，以及
canonical implementation spec（`docs/specs/2026-08-08-hk-mpf-comparison-v1-implementation-spec.md`）。

這一份是路由索引，不放細節。細節在 `docs/agents/` 之下逐個主題一份——**這樣做是因為
本檔案曾經長到 31 KB 而被截斷，尾段的紅線根本傳唔到執行者手上**。任何一份超過
10 KB 就再拆，唔好塞返落嚟。

## 不可繞過的紅線

呢七條凌駕一切效率考慮。做唔到就報錯或者標示「官方未提供」，唔好估。

1. **唔可以靜默改寫官方數字。** 固定小數位、補 0、四捨五入、正規化標籤，
   全部係改寫。披露寫 `1.205%` 就係 `1.205%`。
2. **官方寫 `n.a.` 唔等於 0。** 一律走 `unavailableFields`，唔可以用另一個
   欄位（風險級別、基金種類）補位。
3. **抽唔到就明講，唔出局部資料。** 一張表有一行對唔上，整塊當官方未提供，
   並記低原因同代號（`unavailableKinds`）。
4. **配對唔做模糊比對。** 只做大小寫／引號／破折號正規化加契約聲明嘅前綴。
   同名兩個就報錯，唔可以隨便揀一個。
5. **唔可以拿另一隻基金嘅披露頂上。** 一個基金類別對多過一份披露要報錯。
6. **編輯判斷要標明。** 三桶資產歸類、比較組別都係編輯層，payload 寫
   `official: false`，顯示時要講明「非官方分類」。
7. **每個來源保留自己嘅截至日期。** 便覽比平台落後四至八個月，唔可以沿用
   平台嘅 `dataAsOf`，唔可以攞最舊嗰個冚全份。

## 主題索引

| 主題                                                           | 讀邊份                                   |
| -------------------------------------------------------------- | ---------------------------------------- |
| 改動流程：收貨條件、PR 組成、高危覆核、部署來源、分支衛生、E2E | `docs/agents/change-policy.md`           |
| 便覽連結、PDF 抽取、版面原語、覆蓋報告、缺口分類               | `docs/agents/fact-sheet-extraction.md`   |
| 便覽來源政策：受託人官網優先、來源檔結構                       | `docs/agents/fact-sheet-sources.md`      |
| 逐個受託人嘅實戰紀錄：反爬蟲、連結陷阱、換版缺口               | `docs/agents/fact-sheet-source-notes.md` |
| 三桶資產映射、比較組別平均                                     | `docs/agents/editorial-mapping.md`       |
| 官方平台欄位：DIS、規模、成立日期、年度回報、風險指標、費用    | `docs/agents/platform-fields.md`         |
| 過期政策（財政年結日）                                         | `docs/agents/freshness-policy.md`        |
| 非官方參考數據（Lipper 分類、對照表）                          | `docs/agents/reference-datasets.md`      |
| GitHub issues 用法、收貨條件、`needs-info` 處理                | `docs/agents/issue-tracker.md`           |
| Triage labels                                                  | `docs/agents/triage-labels.md`           |
| Domain docs、ubiquitous language                               | `docs/agents/domain.md`                  |
| 部署步驟                                                       | `docs/deployment.md`                     |

## 已接受的決策（ADR）

規矩答「點做」，ADR 答「點解咁揀、否決過咩、幾時重審」。改到以下任何一項嘅
前提，要先更新對應 ADR，唔好靜靜哋喺規矩度改。

| ADR                                                         | 決策                                       |
| ----------------------------------------------------------- | ------------------------------------------ |
| `docs/adr/0001-github-cloudflare-deployment.md`             | GitHub + Cloudflare 部署架構               |
| `docs/adr/0002-publication-scoped-edge-caching.md`          | 以發布快照為界的邊緣快取                   |
| `docs/adr/0003-trustee-first-fact-sheet-sources.md`         | 便覽內容抓受託人官網、配對用積金局登記冊   |
| `docs/adr/0004-overlaid-text-layer-by-draw-order.md`        | 疊印文字層靠落筆次序分層，唔靠座標         |
| `docs/adr/0005-editorial-asset-class-buckets.md`            | 第一版只做股票／債券／現金及其他三桶       |
| `docs/adr/0006-fund-overview-freshness-by-fiscal-period.md` | 基金概覽過期按財政年結日及法定發布期限計算 |

## 使用者里程碑偏好

當工作進入最終網站設計及網域接入階段，先通知使用者；未獲確認前不處理正式網域
或最終公開發布。
