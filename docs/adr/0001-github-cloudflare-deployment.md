# ADR 0001：GitHub 及 Cloudflare 分工部署

日期：2026-08-08
狀態：已接受

## 背景

香港強積金比較網站需要公開網頁、資料 API、每日資料擷取、PDF 解析、版本化原始文件及可回退的發布流程。資料更新不能直接影響公開網站，也不能把未驗證資料展示給用戶。

## 決定

使用 GitHub Public repository 管理程式碼及 GitHub Actions；main branch 強制通過 CI，部署秘密及正式資源識別碼只保存於受保護的 GitHub environment。使用 Cloudflare Pages 發布網站、Workers 提供 API、D1 保存標準化資料及排名結果、R2 保存原始資料；Workers Cron 負責每日觸發及發布檢查。

GitHub Actions 處理較重的擷取、PDF 解析、標準化及交叉核對。正常批次可自動發布；異常批次必須先人工核對。預設排名每日預先計算，自訂時間框架才即時計算。

異常批次由 GitHub production environment 的 required reviewer 批准或拒絕；批准不能繞過驗證或直接修改正式 D1 資料。部分來源失敗時，未受影響資料可以發布，而受影響欄位只可沿用上一個已驗證值及其原日期和狀態。

## 原因

- 前端、API、批次及原始資料有清楚分界。
- Public repository 提高方法透明度，但原始文件授權、秘密及正式資源識別碼必須在每次發布前檢查。
- GitHub Actions 較適合重型文件處理；Workers Cron 較適合定時觸發及輕量發布控制。
- D1、R2 與 Cloudflare 網站服務位於同一部署邊界，減少公開查詢的跨平台依賴。

## 後果

- 需要管理 GitHub 與 Cloudflare 之間的 secrets、權限及部署 workflow。
- D1 的關聯查詢及容量限制需要在實作前以實際資料量驗證。
- PDF 解析不能依賴 Cloudflare Worker 執行，必須在 GitHub Actions 或其他受控工作環境完成。
- 所有提交及 artifact 均按公開內容處理；來源授權、秘密、原始文件及歷史提交必須持續檢查。

## 實作狀態補記（2026-10-01）

本節只記錄現行實作與上述決定的差異，不改寫原決定；依 `main` `6a593dba460b905badbfca9e9eac85a16318309e` 核對。

- **發布**：沒有自動發布。正式部署只有 `deploy-production.yml` 的手動 `workflow_dispatch`，須在 `main`、輸入確認字串、指定來源快照，並重用同一 SHA 成功的 `main` push CI，再經 `production` environment。來源擷取 `refresh-source-snapshot.yml` 每週二 19:00 UTC 排程並接受手動執行，只建立候選 PR，不發布。
- **Workers Cron**：`apps/api/wrangler.jsonc` 沒有 `triggers.crons`；每日觸發及發布檢查目前不由 Worker 執行。
- **排名**：沒有每日預先計算；API `/rankings` 在請求時按已發布快照組合及計算。
- 要改為自動發布、加入 Cron 或預先計算，須另立 superseding ADR，並先驗證權限、失敗復原及監測；本補記不構成變更授權。

## 未決事項

- 具體網站框架及 Cloudflare Pages build 設定。
- D1 schema、歷史資料保留及回退窗口仍待 review。
- R2 lifecycle：使用者於 2026-09-27 決定 D1 備份及來源封存目前不設自動到期。固定保留年期、不同類型物件的清理程序及費用覆核仍未完成；不得把「沒有自動到期」描述成已確定某個保留期限。
- GitHub Actions 與 Cloudflare 的最小權限 token 配置。
