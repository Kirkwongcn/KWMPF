# KWMPF 修復及新版設計正式發布 — 2026-09-30

## 已完成的發布

使用者於 2026-09-30 回覆「批准合法及發佈」，依本次 PR #358／#359 等效覆核及合併請求的上下文，接受人工覆核並批准合併及正式發布。repo `/code-review` 命令不可用；沒有聲稱曾執行該命令。原件、候選、來源審查及正式環境 gate 都保留自己的證據。

- 正式網站：[KWMPF](https://kwmpf.kirkwongcn.com)。保留原有 header、品牌色與背景；簡潔／深入分析、覆蓋比例、點圖／橫條圖、回報期間圖、配置／持倉圖及原值表隨同發布。
- [程式 PR #358](https://github.com/Kirkwongcn/KWMPF/pull/358)：head `910d5c5` 的 [CI #808](https://github.com/Kirkwongcn/KWMPF/actions/runs/36719163141) verify、E2E／publication-seed、high-risk-review 全通過；squash merge `59a41349fe8a10744e5ac3763fe74731378bcfdf`。
- [資料 PR #359](https://github.com/Kirkwongcn/KWMPF/pull/359)：先 retarget main，再只重接七個資料檔案；head `b2a86dd` 的 [CI #810](https://github.com/Kirkwongcn/KWMPF/actions/runs/36720125609) 同樣全通過；squash merge `3f655960c620b019f245886d709283c0e1b67590`。
- main 的 [CI #811](https://github.com/Kirkwongcn/KWMPF/actions/runs/36720403804) 成功。部署重用這個精確 SHA 的 CI，不重複執行完整 CI。
- [Production run #28](https://github.com/Kirkwongcn/KWMPF/actions/runs/36721593812) attempt 1 成功；正式 code SHA `3f655960c620b019f245886d709283c0e1b67590`。本記錄後續的文件更新不表示重新部署程式。

## 來源原件保存

[Trustee archive run #3](https://github.com/Kirkwongcn/KWMPF/actions/runs/36720235207) 以既有 `2026-08-31` 連結清單取得 58／58 份 PDF，0 失敗。本機下載其 artifact `11097817725`，逐一重驗全部 58 檔 SHA／bytes；修復用四份 PDF 的 URL、SHA 及 bytes 與已接受候選精確一致。歸檔是來源版本保存，其他 54 份的下載成功不代表本輪完成內容認證。

| 修復原件 | SHA-256 | Bytes |
| --- | --- | ---: |
| Sun Life Rainbow | `76b62bf6a5d80afb51c44997db8744d985c829ef1a613b9f4c6290243174b293` | 7206638 |
| BEA Industry | `598833c402d1a047832cb9a324fbaadde6546362c30bda6b5187026a3b9f4308` | 1022475 |
| BEA Master Trust | `0e3b5b731bccf242c8517684568702265a8fb5d56d82e53ca5463420406e6473` | 904260 |
| BEA Value | `90f1c4d143d8dde176e530f893c65f4068d9f42c03a40f21174e23bcc85db649` | 751497 |

受保護 staging job 將 deterministic tar.gz 與 index 保存至 private `kwmpf-staging-raw/source-archives/trustee-fact-sheets/2026-08-31/run-36720235207/`，兩物件均逐位元讀回一致。BEA Master Trust 同 URL 的新版本因而有獨立歸檔；舊版本仍保留。連結清單批次 8 月 31 日不是四份 PDF 回報的截至日期，四份回報各自截至 6 月 30 日。R2 依使用者選擇不設自動到期。

## 正式備份及發布記錄

- 平台來源：`data/sources/2026-09-26/mpf-fund-platform.json`，截至 `2026-08-31`；14 項費率異常保留 `needs_review`，既有 disposition 綁定精確 source／report SHA。run #28 的 preflight 顯示 `accepted for this exact source and report`；沒有清除警告。
- 回報候選：`data/coverage/2026-09-30-official-return-observations-candidate.json`。完整 seed 為 451 類別、295 trustee observations、32 比較組別、56 DIS 元件及 24 完整計劃。
- 部署前 snapshot：`snapshot-mpfa-platform-2026-08-31-fef19f9a5437`。
- 備份 ID：`d1-2026-09-30T13-27-44Z-run-36721593812`；private production R2 `backups/<backup-id>/` 中 SQL 與 manifest 均讀回驗證。
- SQL：1,999,829 bytes；SHA-256 `3809491cdecbc3a4bcd61dd4581029c74c133acd06d84d0aeec291c59029bfdc`。
- 發布 snapshot：`snapshot-mpfa-platform-2026-08-31-3f655960c620`。
- Worker deployment `4ebe61a2-2dfa-4e20-a01f-950c89815ac6`；version `18b91437-b95d-448a-9d6b-6f282967f764`。
- Pages deployment `48675d4f-4815-4f87-bb8f-b1f3aa5df51d`。
- Release tuple：private production R2 `releases/3f655960c620b019f245886d709283c0e1b67590/run-36721593812-attempt-1/manifest.json`，SHA-256 `9de33da93b1b90d09697788aa07a6993bf0055f752d7615d61ce016f129317bc`，逐位元讀回一致。

## 實際線上資料驗收

公開 Worker `/health` 回報正式 SHA，D1／R2 bindings 均 true；`/summary` 為相同 snapshot、451 類別、24 計劃、11 受託人。快取政策為 `public, max-age=300, stale-while-revalidate=600`。

| 線上基金／欄位 | 結果 | 各自日期 |
| --- | --- | --- |
| Sun Life Conservative Class B，三年 | 2.84% | 2026-06-30；過期 |
| BEA Industry Balanced，三年 | 9.33% | 2026-06-30；過期 |
| BEA Growth，三年 | 14.73% | 2026-06-30；過期 |
| Sun Life Income，三年 | 官方 N/A，第 9 頁；URL／SHA／自己的日期齊備 | 2026-06-30 |
| Sun Life Income，一年 | 平台較新的 2.58%，沒有被便覽的一年 3.23% 覆蓋 | 2026-08-31 |

線上逐基金讀取全部 40 份 BEA 詳情及 interpretation：40／40 配置完整，合計在 100±0.5%，每份 10 項持倉，20 mapped／20 not-asset-class。原值與編輯三桶仍分開。這是線上讀回核對；原文人工視覺覆核範圍與限制見來源修復手冊。

UTC 2026-09-30 三年：37 可排名、258 過期、156 未取得；排名及 data-quality 一致。一年 447／0／4，五年 427／0／24，十年 358／0／93。沒有為增加排名數放寬 90 日或推算官方未給的年率化數值。

## 仍須跟進

修復抽取不會令六月底原件變新。三年剩餘缺口、新官方便覽 discovery、獨立三年累積回報欄位、其他 226 筆舊觀察的完整原文 reconciliation，以及流程審查列出的 P1／P2 工作繼續跟進。此發布不代表三年全面覆蓋或整個專業架構審查已全部結案。

已在正式網域目視核對桌面首頁及三年同組點圖（日期、258 隻過期排除提示、三隻同組排名）；390px 手機詳情顯示 Income 一年 2.58%／三年官方 N/A／自己的日期與原件頁數，頁面沒有整體橫向溢出，原值表保留自己的橫向捲動。桌面及手機畫面已保存；沒有把本機 66 項 E2E 說成正式站自動化全站測試。

本機手冊附件 `outputs/source-repairs-2026-09-30/` 保存原件 manifest、58 檔 archive 比對、正式 API 讀回 proof、CI jobs 及桌面／手機實際畫面。較早文件所述「待合併／未發布」是當時的歷史狀態，本篇記錄本次實際結果。
