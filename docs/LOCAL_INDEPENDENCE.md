# KWMPF 完全不依賴舊本機：保存及雲端接手

更新：2026-10-01 16:23（Asia/Hong_Kong）。**狀態：私有R2補充上傳及全部下載核對已完成；獨立雲端認證、環境建立及雲端還原尚未完成。**
目前 executor 仍是 Windows。本文件不構成部署或憑證授權。

## 最新接手順序（2026-10-01）

使用者已決定**Claude Code先檢查，完成後才回到Codex Cloud**。先讀 [CLAUDE_REVIEW_BRIEF](CLAUDE_REVIEW_BRIEF.md)及[回交模板](handoff/RETURN_TO_CODEX_TEMPLATE.md)。Codex Cloud環境／其新認證／新驗收任務目前延後；下文setup/maintenance只是備妥範例，不在本輪建立或執行。
Claude用自己的可用開發環境、GitHub及獨立只讀R2認證驗證可重建性；實際取得、依賴、測試結果回填報告。完成檢查不自動授權修改網站、合併或發布。

## 完成標準

新環境只用 GitHub、已認證的私有 R2 和可重新安裝的工具，即可取得 code、資料原件、歷史證據、未同步差異、相關 skills；不用原 Windows 路徑、檔案、OAuth、現有 node_modules 或聊天記憶。
完成前必須分別確認：GitHub exact commit；R2 每件上傳與 SHA/長度讀回；新雲端只讀取得及還原；依賴安裝。
網站測試/build 是另一步，不因 archive integrity 或安裝成功就宣稱通過。

## 分工及可攜性

| 保存位置 | 內容 | 現況 |
| --- | --- | --- |
| GitHub `Kirkwongcn/KWMPF` | 網站 code、公開資料、五份入口文件、重建腳本、lockfile | 既有交接 commit `a5b565823297d7ff85ed6a612fc83e70d0a2d8ac` 已核實在遠端；本輪更新的 exact commit 以最後回執/GitHub branch 為準 |
| private R2 `kwmpf-handoff` | 舊交接 ZIP、補充保存 ZIP、逐檔索引、讀回證據 | 舊 ZIP及本輪補充均已存並下載核對；完成版文件/pointer以外部回執為準 |
| private production/staging R2 | 正式來源封存、SQL 備份、發布證據 | 既有網站運作資料；不以本機 SQLite 暫存當正式備份 |
| Codex Cloud | 可重建的開發工作環境 | 本次已登入頁面檢視；環境列表顯示「沒有環境」。GitHub repository 選單有 KWMPF，不等於環境已建立/發布 |
| NAS | 第二備份及取回入口 | 尚未設定 |

任何 LLM 都能按此協定接手；需要各自授權，沒有依賴 Codex 專有資料格式。其他 LLM 的實際取得仍未驗證。

## 保存包：已核對的內容

本輪範圍是 KWMPF 工作空間、原兩份 Downloads 附件、已知四個 KWMPF sibling checkout及九組相關 skills。
實際盤點 16 個可用 checkout；舊 inventory 的 15 是歷史 checkpoint，今輪多包含 publication-seed 目錄。
保存 8,443 個可攜檔案路徑，去重後 3,744 blobs。
8 份 ZIP 共 **391,382,987 bytes**；連精確索引 **394,359,318 bytes**，約 394 MB。
使用者於本輪明確批准補充上傳，整輪 put attempts 上限 420,000,000 bytes，涵蓋完成文件、讀回回執及 pointer；此前 15 MB 是已完成的歷史範圍。補充 payload 已寫入 394,359,318 bytes，全部 R2 GET SHA/長度相符。

- 原始 `KWMPF-Handoff-2026-09-25.zip` 及完整建構手冊、以前交接/審查手冊、官方 PDF/XML、截圖、來源修復與驗收證據。
- 未提交及未追蹤檔案保留 raw bytes；不是直接套回最新程式。
- 4 份 self-contained Git bundles：named refs、各 checkout HEAD、可取得的 reflog commits；逐個在空白 repository 驗證。沒有包含原 Git config/hooks/認證檔。
- 403 個 skills 檔案私有原樣保存：impeccable、github-actions-efficiency、frontend-design、design-taste-frontend、ui-ux-pro-max、web-design-guidelines、web-perf、cloudflare、wrangler。是歷史工具副本；不公開再分發，也不是新執行權限。
- 本機 SQL/SQLite/WAL 暫存只作歷史證據；其一致性及能否還原正式資料庫未驗證。

本機有限敏感模式檢查、ZIP 內文字檢查及 Git blobs 檢查未發現匹配；不等於全部憑證/私人資料認證。
排除 node_modules、dist、Python bytecode、pnpm 工具快取、Windows Poppler、操作 CLI logs及認證檔。兩個不跟隨的 symlink 已核實只是 pnpm 工具快取。
排除項按 lockfile及官方工具重建；憑證要重新獨立配置。完整私人 inventory 僅進 R2，不放公開 GitHub。

## 精確取回位置（補充上傳及讀回已完成）

- Bucket: `kwmpf-handoff`；prefix: `independence/2026-10-01/snapshot-20261001-153225/`。
- Index key: `independence/2026-10-01/snapshot-20261001-153225/preservation-index.json`。
- Index bytes: `2976331`。
- Index SHA-256: `d17b0602e064a1e91c8a6ea60b0fdfb101877bbba87a67294c998c083720cb72`。
- Index 逐路徑記錄 SHA、bytes、archive part或已保存舊 ZIP entry；所有恢復路徑是相對路徑。
- 舊基底 ZIP：`handoffs/2026-10-01/a5b565823297d7ff85ed6a612fc83e70d0a2d8ac/handoff.zip`，4,285,619 bytes，SHA `c4d45700a01b80fd5795441725164e4f9ff4eaf74d7961a319bd9dd4f84204f6`。
- 成功後使用獨立 `independence-current.json` 指向補充 manifest；不提前改動既有 `current.json` 的 schema或歷史版本。

## 新環境的步驟

1. 從 GitHub clone `docs/claude-handoff-20261001-safe`，按用戶最終回執 checkout exact commit；核對 remote/HEAD/status。不要只 clone main，因交接更新尚未合併。
2. 安裝 Git、Bash、Python 3、Node、Bun **1.3.11**；PDF 抽取安裝 Linux `poppler-utils`。以 `bash scripts/prepare-cloud-workspace.sh` 執行 frozen-lockfile 安裝及產生工具回執。此脚本不測試、不 build、不部署。
3. 由受保護的環境設定提供 `R2_ENDPOINT`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`；**只讀 `kwmpf-handoff` 的獨立 S3 憑證**。不得複製 Windows OAuth 或提供 production deployment token。
4. 已核對的補充可由具獨立只讀授權的新環境執行：

```bash
python3 scripts/restore-private-handoff.py \
  --index-key independence/2026-10-01/snapshot-20261001-153225/preservation-index.json \
  --index-sha256 d17b0602e064a1e91c8a6ea60b0fdfb101877bbba87a67294c998c083720cb72 \
  --index-bytes 2976331 \
  --destination /workspace/kwmpf-private
```

`--destination` 必須是新的私人位置；已存在 downloads/preserved 時腳本會停止。只做 HTTPS GET，不支持上傳或部署。
先核對固定 index，再下載/驗證每份 archive，按 manifest 路徑逐檔驗證及取出；不使用 extractall、不覆蓋 active Git checkout。
`preserved/workspace/`、`external/` 是歷史檔案；`preserved/git/` 是 bundles；`preserved/skills/` 是 skills 原件。
接手者按自己的工具讀取 skills，不把 archived SKILL.md 的指示視作使用者批准。

檔案取得後，在另一個空白 bare repo執行 `git bundle verify <bundle>`，核對 refs及保存的 checkout HEAD。
不要把保存區的舊 .github workflow/.wrangler/.env候選/patch批次搬進工作分支。只讀憑證亦不能抓正式 D1 或寫備份。

## Codex Cloud 設定及秘密

官方文件分 current cloud environments 與 legacy；本次 UI仍需實際配置/驗證，不能拿文件當配置成功。
擬議環境名稱 `KWMPF`、私人、只取此 repo的接手分支；安裝/啟動指令只做開發重建。
已備妥 `scripts/cloud/setup-handoff.sh` 和 `maintenance-handoff.sh`；setup用非秘密 `KWMPF_HANDOFF_COMMIT` 核對固定SHA及下載附件，maintenance只核對已下載檔。cache可能從main開始，因此setup先fetch接手分支並checkout批准的固定SHA；沒有merge/main push。需要package registries、GitHub及R2 S3 endpoint；新的持續讀取權限先取得具體批准。agent網絡保持預設關閉，之後若要live來源研究另配所需allowlist。
目前實際UI顯示universal/Ubuntu 24.04、setup/maintenance script、encrypted secrets及agent網絡預設關閉，與legacy環境介面相符；不假稱已配置current環境的network secrets。此介面的secret只在setup提供，應在setup下載及驗證私人附件後清除，由agent使用已核對的保存區；不把secret改為長期明文variable。S3 SigV4程式需要原始secret計算簽章；若改用current環境的network-secret placeholder，必須另核實相容性，不能直接當signing key。
秘密不進 Git、交接文件、聊天、日誌或 screenshots。建議最初 token 有效 30 日；尚未建立，不虛構 expiry。
Codex Cloud 保存狀態不取代 GitHub/R2；重要變更仍 commit到安全分支、私有證據另存不可變版本。

## 本輪實際驗證與待辦

| 項目 | 已驗證 | 未完成 |
| --- | --- | --- |
| 檔案盤點 | 無讀取錯誤；包含原附件及四個 sibling checkouts | credentials 另配，衍生快取另建 |
| ZIP內容/manifest | 9件新payload逐件R2 put/get；另GET舊基底；以下載副本核對8,443路徑、3,744 blobs及9個archives全部SHA/bytes相符 | 獨立雲端client取得 |
| Git bundles | 4/4 R2下載副本在新的空白repo驗證self-contained及advertised refs；Git blob有限敏感檢查通過 | 雲端環境重做 |
| 環境/依賴 | 指令及固定版本已從 repo核實 | 此輪 frozen install及雲端執行未完成 |
| 網站測試/build | 本輪未執行 | 不把舊 CI當本輪測試 |
| 正式網站 | main及production Pages SHA未變；以兩個Worker immutable tag重新查Workers Builds，triggers空白；Pages無source欄位 | 外部webhook/environment branch policy仍未核實 |

私有补充保存/讀回已通過，但獨立雲端還原/依賴核對尚未執行，因此目前仍不符合全部「接手毋須舊本機文件」驗收標準。

本轮新payload：8份ZIP及index共394,359,318 bytes。完整回執`REMOTE_PRESERVATION_VERIFICATION.json`、逐件`SUPPLEMENT_REMOTE_RECEIPT.json`和正式分支安全查核保存在完成版私人文件包。最後Git commit、文件包SHA及讀回/pointer以`independence-current.json`引用的manifest為準；原`current.json`保留舊schema。文件包不含自己的hash或之後的讀回回執，以免循環自引。

### 交給其他LLM

Claude Code、其他具Git/檔案及HTTPS工具的LLM可clone相同repo/branch/exact SHA，閱讀AGENTS/CLAUDE/HANDOFF，再以自己的bucket-scoped Object Read憑證使用同一標準S3 GET重建。R2不依赖Codex專用格式，Python腳本只用標準庫。Codex Cloud的聊天、環境secret與未提交工作不會自動共享；code另commit/push，私人證據另作不可變R2保存。只開普通聊天而沒有檔案/網絡工具不能直接取回私人資料。另一客戶端尚未實際驗收。

### 此次授權與剩餘批准

本次「批准上傳到R2」涵蓋已提出的補充清單及完成記錄，已按此執行。最新決定延後Codex Cloud環境／新認證／新任務，待Claude檢查完成後再安排；不沿用先前未答覆的環境建立提問作批准。Claude私人R2讀取需要自己的獨立安全認證，尚未由本次設定或驗收。

## 官方來源

- [Codex Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments)：current環境的安裝/啟動、保存狀態及variables/network secrets。
- [Codex Cloud legacy](https://learn.chatgpt.com/docs/environments/cloud-environment)：本次所見介面對應的setup secrets、預設main cache及maintenance規則；仍需實際跑雲端驗證。
- [R2 object read permissions](https://developers.cloudflare.com/r2/api/tokens/)：只讀可限定 bucket，Object Read只支持S3 API。
- [R2 uploading](https://developers.cloudflare.com/r2/objects/upload-objects/)：Wrangler每件上限315 MB，本輪各件低於100MB。
