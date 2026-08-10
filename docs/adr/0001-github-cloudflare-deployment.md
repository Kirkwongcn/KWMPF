# ADR 0001：GitHub 及 Cloudflare 分工部署

日期：2026-08-08
狀態：已接受

## 背景

香港強積金比較網站需要公開網頁、資料 API、每日資料擷取、PDF 解析、版本化原始文件及可回退的發布流程。資料更新不能直接影響公開網站，也不能把未驗證資料展示給用戶。

## 決定

使用 GitHub Private repository 管理程式碼及 GitHub Actions；使用 Cloudflare Pages 發布網站、Workers 提供 API、D1 保存標準化資料及排名結果、R2 保存原始資料；Workers Cron 負責每日觸發及發布檢查。

GitHub Actions 處理較重的擷取、PDF 解析、標準化及交叉核對。正常批次可自動發布；異常批次必須先人工核對。預設排名每日預先計算，自訂時間框架才即時計算。

異常批次由 GitHub production environment 的 required reviewer 批准或拒絕；批准不能繞過驗證或直接修改正式 D1 資料。部分來源失敗時，未受影響資料可以發布，而受影響欄位只可沿用上一個已驗證值及其原日期和狀態。

## 原因

- 前端、API、批次及原始資料有清楚分界。
- Private repository 可先降低來源處理及部署設定外洩風險。
- GitHub Actions 較適合重型文件處理；Workers Cron 較適合定時觸發及輕量發布控制。
- D1、R2 與 Cloudflare 網站服務位於同一部署邊界，減少公開查詢的跨平台依賴。

## 後果

- 需要管理 GitHub 與 Cloudflare 之間的 secrets、權限及部署 workflow。
- D1 的關聯查詢及容量限制需要在實作前以實際資料量驗證。
- PDF 解析不能依賴 Cloudflare Worker 執行，必須在 GitHub Actions 或其他受控工作環境完成。
- 日後如要公開 repository，必須先重新檢查來源授權、秘密、原始文件及歷史提交。

## 未決事項

- 具體網站框架及 Cloudflare Pages build 設定。
- D1 schema、R2 保留期限及備份方案。
- GitHub Actions 與 Cloudflare 的最小權限 token 配置。
