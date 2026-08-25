# ADR 0002 — 以發布快照為界的邊緣快取

日期：2026-08-25
狀態：已接受

## 背景

公開 API 每次請求都直接讀 D1。單次頁面瀏覽約觸發 5 次 API 呼叫、合計約 2,000–2,500 行讀取，
Cloudflare D1 免費額度每日 500 萬行，換算後只支撐約 2,000 名訪客／日。強積金官方資料
每月更新一次，逐次請求重讀完全相同的內容並無必要。

同時，快取不得違反既有的 fail-closed 規則：未發布的候選資料、來源失敗及過期數值都不可
因為快取而洩漏或延長曝光。

## 決定

在 API 加入 `publicationCache()` middleware（`apps/api/src/caching.ts`）：

1. **可快取路徑**僅限已發布的唯讀端點：`/fund-classes/:id`、`/search`、`/filters`、
   `/summary`、`/schemes`、`/rankings`。
2. **只有在 `current_publication` 有已發布快照、且回應為 200 時**才發出
   `Cache-Control: public, max-age=300, stale-while-revalidate=600` 及
   `ETag: "<snapshotId>"`。
3. **其餘一律 `no-store`**：`/health`、未知路由、非 GET、400／404，以及任何在「未發布」
   狀態下產生的回應。未發布的 404 因此不會被快取住，發布後即時可見。
4. **邊緣快取鍵綁定內容版本**，而非只綁快照名稱：
   `contentVersion = snapshot_id + ":" + candidate_batches.raw_sha256`。
   發布新快照即自動失效，毋須手動 purge；同名但內容不同的快照亦不會互相污染。
5. **條件請求**：`If-None-Match` 命中時直接回 304，不執行查詢。

## 後果

- 同一快照內的重複請求由 Cloudflare 邊緣及瀏覽器回應，D1 讀取量下降一至兩個數量級。
- 資料最多滯後 5 分鐘（`stale-while-revalidate` 期間最多 15 分鐘）。官方資料每月更新，
  此延遲可接受。
- Worker 部署於自訂網域時，邊緣快取需經 Cache API（`caches.default`）；本 middleware
  已直接使用，毋須額外 Cache Rules。本機測試環境若無 `caches` 物件則自動略過。
- 快照識別碼的不可變性成為明示契約：同一 `snapshot_id` 不得對應不同內容。
  測試 helper 需為每個情境產生獨立的快照識別碼。

## 相關

- 規格：`docs/specs/2026-08-08-hk-mpf-comparison-v1-implementation-spec.md`
- 測試：`apps/api/test/caching.test.ts`
