# ADR 0009：回應快取綁定查詢、程式版本及評估日期

日期：2026-09-30
狀態：接受，修復 ADR 0002 的 validator 缺口

## 問題

同一 snapshot 的所有路徑共用 ETag，條件請求可以把另一期間、另一基金或錯誤參數當成同一份內容，直接回 304。每日重算的 freshness 亦沒有綁定日期。原始資料 checksum 綁定 edge cache，卻沒有綁定 browser validator。

## 決定

ETag 是路徑、排序後查詢、完整內容版本、Worker release version 及 UTC 評估日的 SHA-256。Edge cache version 同時綁定程式版本及 UTC 日期。保留 300 秒 max-age / 600 秒 stale-while-revalidate；日界附近最多既有 15 分鐘快取窗口，不能宣稱即時失效。所有評估日期使用既有 API 的 UTC 日界。

此改動不更改 45/90 日門檻或歷史 snapshot 的 policy。官方未提供、過期排除及未發布 no-store 規則維持。新增資料品質端點只讀已發布資料，不抓取來源或發布候選。

## 驗證

需要覆核同一 URL 的條件請求、不同 URL / period / release / date / raw SHA 的 validator 分離、未發布及錯誤 no-store，以及第 90/91 日和無效日期的 freshness。具體結果記錄於本次全流程審查報告。
