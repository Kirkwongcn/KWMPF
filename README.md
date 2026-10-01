# KWMPF

香港強積金計劃及基金比較網站。

## Claude Code 接手

先讀 [CLAUDE.md](CLAUDE.md)／[共用規則](AGENTS.md)，再讀
[即時交接](docs/HANDOFF.md)、[技術及來源地圖](docs/PROJECT_MAP.md)、
[已確定決定](docs/DECISIONS.md) 及 [完整文件索引](docs/handoff/DOCUMENT_INDEX.md)。
最新交接期間暫停新增功能；未經使用者批准不得合併正式分支、改 Cloudflare 或部署。
下列較早審查文件保留當時證據，不以舊進度覆蓋即時交接。

## 雲端儲存及私有附件

讀 [GitHub／Cloudflare 儲存及跨工具接手](docs/CLOUD_STORAGE.md) 與
[設定宣告](config/storage.json)。GitHub 交接分支可讀；私有 R2 `kwmpf-handoff` 已建立，
交接附件已按批准上傳、逐件下載核對，`current.json` 指向完整版本；詳見有日期的交接及外部 receipt。
NAS 尚未設置；另一個 LLM 的獨立授權及資料取回尚未驗證。

完全不依賴舊本機的重建及最新準備狀態見 [LOCAL_INDEPENDENCE](docs/LOCAL_INDEPENDENCE.md)。補充保存包已備妥；額外上傳、獨立client及雲端驗收尚未完成。

## 審查及設計跟進

- [2026-09-30 全流程審視與網站改版跟進手冊](docs/reviews/2026-09-30-full-process-and-design-review.md)：資料時效、来源搜尋、準確度、架構缺口、驗收及下一步。
- [介面設計系統](DESIGN.md)：簡潔首頁、深入分析模式、圖表與表格的共用規則。
- [三年缺口解決手冊](docs/reviews/2026-09-30-three-year-gap-resolution.md)：逐計劃缺口、原文證據、期間錯配、解析修正及替代比較口徑。

## Development

```bash
bun install --frozen-lockfile
bun run check
```

## Cloudflare staging

Run the interactive setup wizard from a terminal:

```bash
./scripts/setup-cloudflare-staging.sh
```

It creates no local credential file. The three deployment values are written directly to the protected GitHub `staging` environment. See `docs/deployment.md` for the resource names and verification contract.
