# KWMPF GitHub、Cloudflare 與跨工具交接

日期：2026-10-01（Asia/Hong_Kong）。這份文件描述儲存及取回方法；即時版本與狀態以
[HANDOFF](HANDOFF.md)、外部完成回執及 R2 `independence-current.json` 為最新補充定位；舊 `current.json` 仍定位原交接。
設定宣告在 [config/storage.json](../config/storage.json)，不是 Terraform，也不會自行建立資源。

## 0. 完全不依賴舊本機：最新狀態

使用者新增此目標；另讀 [LOCAL_INDEPENDENCE](LOCAL_INDEPENDENCE.md)。使用者已另外批准本輪上傳（put-attempt預算420MB）。394,359,318 bytes補充payload已上傳私有R2並逐件GET核對；全部8,443路徑及4份Git bundles用R2副本完整驗證。完成文件包/manifest及`independence-current.json`由外部完成回執定位；**只讀client、Codex Cloud環境與獨立雲端還原尚未完成**。下列15MB批准與初次上傳是歷史checkpoint；没有修改正式設定或部署。

## 1. 本輪範圍及狀態

使用者要求先安排 GitHub／Cloudflare，再重寫交接；NAS 尚未設置。
先處理 KWMPF。其他項目需各自盤點 repo、資料、用途及權限，未宣稱已設定。

**已完成私有儲存及初次讀回核對（2026-10-01 14:47 香港時間）。**
使用者已分別批准建立 `kwmpf-handoff` 及清單內私有資料上傳／下載核對，總上傳上限 15 MB。
Cloudflare API 核實 Standard／APAC、r2.dev 關閉、無自訂域名；完整物件無自動到期，預設只有七日中止未完成 multipart。

原始 ZIP、新版 ZIP、五份入口文件、manifest、讀回報告與 current 指標共 10 件／8619851 bytes，remote put/get 後各檔長度及 SHA-256 相符。
初次成功 manifest 是 `handoffs/2026-10-01/0e3a38ebb952869f72abd7c4d2b0ae782828bfc6/manifest.json`；current 亦已讀回。
先前自動批准審查拒絕建立／匯出；其後都取得對該次操作的明確批准才執行，沒有換工具繞過。

本頁與 [CLOUD_STATUS](handoff/CLOUD_STATUS.json) 是有日期 checkpoint。把完成結果另 commit／push 後，再保存最終 ZIP並核對後才更新 current。
**最新 exact branch／commit／ZIP hash 以外部 `HANDOFF_RECEIPT.json` 和 R2 `current.json` 指定 manifest 為準**；本頁不預先宣稱最終 revision 成功。
早期 ZIP repo/ 使用 Windows CRLF 匯出；入口文件使用 Git blob bytes，fresh clone exact commit 是 canonical。
最終 ZIP 改用 `core.autocrlf=false` 匯出並逐檔核對 Git blob，不重寫早期保存包。

## 2. 資料分工

| 位置 | 實際用途 | 交接時注意 |
| --- | --- | --- |
| 公開 GitHub `Kirkwongcn/KWMPF` | code、已公開來源 JSON、ADR、規則、五份入口文件 | 私有附件、憑證、D1 SQL、SQLite、node_modules 不進 Git |
| 既有 `kwmpf-production-raw`／`kwmpf-staging-raw` | 網站來源封存、D1 備份及發布證據 | 既有資料沒有全部複製到交接 bucket；不能當成同一份備份 |
| 已建立 `kwmpf-handoff` 私有 R2 | 已保存接手 ZIP、入口文件、歷史保存及 manifest | 不綁定現有 Worker／Pages；獨立客户端授權尚待配置 |
| NAS | 使用者提供 AS5402T、HDD、RAID 後 12 TB | 尚未設置；空閒容量、ADM、檔案系統及網絡未核實，沒有自動備份或備用入口 |

原本約 1.78 GB 的本機實體佔用包括依賴、快取、重複 checkout 及暫存；不等於需要上傳的資料量。
本輪從 4,270,131 bytes 的既有交接包起步，不複製整個 Windows 工作空間。

## 3. 儲存契約

- bucket 使用 Standard；APAC 是 location hint，不是嚴格資料所在地保證。
- 不開公開 `r2.dev`、custom domain 或公用下載站；不設自動到期。
- 此處「不設自動到期」指完整物件；Cloudflare 預設七日清理未完成 multipart upload 仍啟用。
- 每個版本：`handoffs/<香港日期>/<完整 Git commit>/`。
- `original-handoff.zip` 是已掃描的 2026-10-01 初始保存包，指向 `2c08f15...`；它不是後續文件版本。
- 新版本使用 `handoff.zip`、`manifest.json`，以及同一 prefix 的 `entrypoints/` 五份文件。
- manifest 記錄 repo／branch／exact commit、各 object key／bytes／SHA-256、保存邊界及讀回結果。
- 所有版本物件成功上傳並下載核對後，才寫根 `current.json` 指向該 manifest。
- object keys 不重用於另一個 commit；同版本重試先核對既有內容，不用 ETag 代替 SHA-256。
- manifest 與包本身不能包含自己的最終 SHA；ZIP SHA 在外部 manifest，Git commit 在外部回執。

## 4. 接手方法：GitHub 先、私有附件後

1. 按使用者收到的 final repo／branch／commit clone，核對 HEAD、remote、git status。
   先讀 CLAUDE → AGENTS → HANDOFF → PROJECT_MAP → DECISIONS → DOCUMENT_INDEX。
2. 在自己的環境獨立取得 Cloudflare 授權。不能假設 Codex 的 connector／OAuth 授權會傳到 Claude、Zo 或另一個雲端任務。
3. 用 `current.json` 取得 exact manifest，再下載該版本 ZIP；在本機核對 SHA-256／bytes及包內 paths。
4. `private-preservation/` 是歷史證據、舊 patch 與未同步項目保存；先逐項比較，不覆蓋 fresh Git clone。
5. 本機依賴重新依 lockfile 安裝；驗證結果記錄當地環境，不把歷史 CI／ZIP CRC 當成網站測試。

### 已安裝 Wrangler 的取回範例

此範例使用 repo pinned Wrangler 4.120.0。先於 fresh clone 安裝依賴、確認身分及目標帳戶。
本機透過 pinned Wrangler 4.120.0 已執行同類 remote put/get 並核對；下列 fresh-clone 範例仍需在接手客戶端獨立授權及驗證。

```bash
cd apps/api
bun run wrangler whoami
bun run wrangler r2 object get kwmpf-handoff/current.json --remote --file /absolute/private-path/current.json
# 從 current.json 取得 manifestKey，再把以下 placeholder 換成該精確 key。
bun run wrangler r2 object get kwmpf-handoff/<manifestKey> --remote --file /absolute/private-path/manifest.json
```

帳戶選擇可使用 `CLOUDFLARE_ACCOUNT_ID`；憑證採工具登入或受保護 secret store。
S3 客戶端使用 `R2_ACCESS_KEY_ID`／`R2_SECRET_ACCESS_KEY`／`R2_ENDPOINT`；文件不列值。
R2 bucket-scoped object token 用於 S3 API；不能假設它亦可呼叫 Cloudflare 管理 REST API／Wrangler。
新客戶端優先只有 `kwmpf-handoff` 的讀取權限。管理帳戶的 OAuth／connector 不等於已建立最小權限客戶端憑證。

目前沒有新增 API token、公開 Worker／MCP、跨 LLM 共用 secret 或 GitHub environment secret。
只有客戶端授權、取回及 checksum 真正通過後，才記為「該客戶端可用」。

## 5. GitHub 自動化與正式部署邊界

- `ci.yml` 只在 PR 及 push `main` 觸發；有 lockfile cache、同 ref 過時 CI 取消，PR 才有 E2E／高危 gate。
- `deploy-production.yml`／`deploy-staging.yml` 是 manual；既有定期來源／D1 備份保留原方式。
- 不為交接新增 push-triggered deployment、重複 Actions 或 NAS runner。
- 本輪只 push 功能分支；沒有自動合併授權，沒有 dispatch／批准網站發布。
- 最新只讀 API：兩個 Worker 的 Workers Builds triggers 都是空；兩個 Pages 的 source 欄位未出現，production branch 是 main。
- rulesets GET 為空清單；classic main protection GET 是 403，不表示 main 沒有 protection。
- environment reviewers／branch policy、外部 webhook 尚未核實；不可猜測或降低 checks。

這是 `github-actions-efficiency` 的檢查結果：現有 CI 分流／cache 已存在，本輪毋須為純交接再改 workflow。

## 6. 保存邊界、容量及費用

- 初始交接包保留 32 份歷史文件與差異清單；第三方 PDF binary、原始下載 ZIP、SQLite／D1 SQL及部分暫存只在 inventory。
- 不宣稱所有 266 件本機附件或 301 個差異均已完整複製上雲；manifest 逐項描述保存與排除。
- 有限秘密模式掃描及 SHA 核對，不等於完整 credential history 或全部來源內容認證。
- R2 10 GB 是 Standard 免費額度，不是容量上限；現有帳戶使用量與免費餘額未核實。
- 本輪預計總儲存少於 15 MB；實際 bytes 與檔案清單記於 manifest。不因資料小就宣稱沒有費用。
- 私有 R2 交接附件保存及逐檔讀回已核實；NAS 自動異地備份尚未設置。最終外部 receipt 記實際物件 bytes；不以初次 checkpoint 代替最新 tuple。

## 7. 下一階段

NAS 另行核實 ADM／Btrfs／剩餘容量及私人網絡；先測試只讀 R2 拉取、歷史保存及隔離復原。
其他項目各自採 bucket／權限，不能把資料夾前綴當成權限隔離。正式 D1 另有 SQL 匯出流程，不能只靠複製 R2。
監察／NAS 自動化、最小權限憑證與正式部署，按各自具體操作再取得所需批准。

## 官方操作來源

- [R2 bucket creation](https://developers.cloudflare.com/r2/buckets/create-buckets/)
- [R2 credentials and bucket scopes](https://developers.cloudflare.com/r2/api/tokens/)
- [Wrangler R2 commands](https://developers.cloudflare.com/workers/wrangler/commands/r2/)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [R2 and rclone](https://developers.cloudflare.com/r2/examples/rclone/)
- [D1 export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
