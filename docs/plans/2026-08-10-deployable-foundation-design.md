# KWMPF 可部署骨架設計

日期：2026-08-10
狀態：已確認

## 決定

採用 Bun workspace 管理兩個可獨立部署的應用：Vite／React 負責 Cloudflare Pages，Hono 負責 Cloudflare Worker。Worker 以明確綁定連接 D1 及 R2；前端不直接存取資料服務，只透過公開 API。

## 首個 tracer bullet

健康 API 回傳 `status`、發布版本及 D1／R2 綁定狀態。健康頁顯示同一份公開契約，讓測試環境可驗證 Pages、Worker及版本是否一致；不得回傳憑證、資源識別碼或內部錯誤。

## 測試 seam

沿用 canonical spec 已確認的外部 seam：透過 HTTP 驗證 Worker 回應，透過渲染後頁面驗證用戶可見結果。Worker 測試使用 Cloudflare Workers Vitest integration；前端測試只驗證公開畫面，不測元件內部狀態。

## 部署與安全

Pull request 執行格式檢查、型別檢查、Worker測試、前端測試及生產建置。正式部署工作只在必要 Cloudflare secrets 齊備時執行；憑證只保存於 GitHub Secrets。D1及R2以 Wrangler bindings 宣告，不把正式資源識別碼硬編碼於公開程式碼。
