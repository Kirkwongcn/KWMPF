# KWMPF

香港強積金計劃及基金比較網站。

## 審查及設計跟進

- [2026-09-30 全流程審視與網站改版跟進手冊](docs/reviews/2026-09-30-full-process-and-design-review.md)：資料時效、来源搜尋、準確度、架構缺口、驗收及下一步。
- [介面設計系統](DESIGN.md)：簡潔首頁、深入分析模式、圖表與表格的共用規則。

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
