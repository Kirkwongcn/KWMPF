# 開發目錄、固定版本及指令

| 位置／指令                                | 用途及前提                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `apps/web/`                               | React／Vite；`src/main.tsx` 路由入口、`SiteChrome.tsx` 共用 header、`styles.css`／`DESIGN.md` 品牌規則 |
| `apps/api/`                               | Hono Worker；`src/index.ts` API、`migrations/` D1 schema、`wrangler.jsonc` 本機模板                    |
| `packages/coverage/`                      | 官方來源抓取、抽取、身分核對、候選報告及 publication seed                                              |
| `apps/e2e/`                               | Playwright 桌面／手機、本機 Worker／Vite 隔離流程                                                      |
| `data/`、`scripts/`、`.github/workflows/` | 來源／候選／reference、操作腳本及 CI／受保護發布                                                       |
| `bun install --frozen-lockfile`           | 使用 `package.json` 指定的 Bun 版本；必須保留 `bun.lock`，不得為安裝方便升級依賴                       |
| `bun run typecheck`                       | 全 workspace TypeScript 檢查                                                                           |
| `bun run test`                            | coverage、API、Web 單元／整合測試；不包括 E2E                                                          |
| `bun run build`                           | Web production bundle、coverage 型別檢查、Worker **dry-run** bundle；不是發布                          |
| `bun run check`                           | format、Bash／Python 腳本檢查、typecheck、test、build；需要可用 POSIX Bash、Python 3、Node、Bun        |
| `bun run e2e`                             | 另行執行桌面／手機流程；依 Playwright 設定準備 Chromium、Bash 及隔離本機 D1                            |
| `bash scripts/check-publication-seed.sh`  | 以最新來源及明確指定的 return overlay 驗證本機 API，並另核對三筆官方原文                               |

指令定義及 CI 路徑已核實；實跑結果以 `docs/HANDOFF.md` 為準。
Windows 環境差異不代表測試成功或 code 缺陷。已核准來源／disposition 綁定 Git blob bytes，不得全庫格式化。
