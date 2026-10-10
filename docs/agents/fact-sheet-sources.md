# 基金便覽來源：受託人官網優先，積金局登記冊做 fallback

呢一份講來源政策同來源檔嘅結構。逐個受託人嘅實戰紀錄（反爬蟲對策、連結陷阱、
換版揭發嘅缺口）見 `fact-sheet-source-notes.md`；決策背景見
`docs/adr/0003-trustee-first-fact-sheet-sources.md`。

## Fact sheet source: trustee first, MPFA registry as fallback

積金局便覽庫存放的副本落後平台數據四至八個月，受託人官網已經出到更新一期。所以**配對用積金局
登記冊、內容抓受託人官網**：`data/sources/<YYYY-MM-DD>/trustee-fact-sheet-links.json` 人手由各
受託人官網抄錄，`trustee-fact-sheet-lookup.ts` 讀取。抽取層逐個計劃先試受託人那份，抽唔到
（官網改版、下載失敗、版面對唔上契約）就退回積金局副本，並把原因寫入報告的
`trusteeFallbackReason`。退回本身唔係錯，但唔可以靜靜哋當成最新版。

同 `fact-sheet-lookup.ts` 一個關鍵分別：**冇呢份名單唔算錯**。積金局的連結必須齊 24 個計劃
（`assertFactSheetCoverage`），受託人這份本來就唔齊，抄到幾多得幾多，其餘退回副本。
連結會不預告改版，所以每筆明寫 `file`（本機檔名），唔靠 URL 尾段推算。

每筆披露帶住 `factSheetSource`（`trustee` 或 `mpfa-registry`）及 `factSheetUrl`，
詳情頁按來源講明措辭並連去實際用咗嗰份便覽——用咗副本就要明講「受託人官網那一期未能取得」，
不可扮成最新版。2026-08-31 抄錄咗 BCT 四個計劃（Simple、Smart、Series 800、Industry Choice）、
永明彩虹（`Rainbow_MPF_Quarterly_Update.pdf`，2026-06-30）、恒生 SuperTrust Plus
（`FFS.pdf`，2026-06-30，積金局副本 2025-12-31）、友邦 Prime Value Choice
（月度 Fund Performance Review，2026-05-31，積金局副本 2025-11-30）、中銀保誠 Easy-Choice
（季度 Fund Fact Sheet，2026-06-30，積金局副本 2026-03-31）、交通銀行 Joyful Retirement
（季度 Fund Fact Sheet，2026-06-30，積金局副本 2025-12-31）、BCT Strategic
（`bcthk.com/wr/ST-Fund-Fact-Sheet`，2026-07-31，積金局副本 2026-03-31）、中國人壽集成信託
（季度基金表現便覽，2026-06-30，積金局副本 2025-12-31）、我的強積金
（季度 Fund Fact Sheet，2026-06-30，積金局副本 2026-03-31）、東亞三個計劃
（集成信託 `mpf-mt-2026-2nd.pdf`、行業 `mpf-is-2026-2nd.pdf`、享惠 `mpf-vs-2026-2nd.pdf`，
全部 2026-06-30，積金局副本 2026-03-31）及滙豐 SuperTrust Plus
（`hsbc.com.hk/content/dam/hsbc/hk/docs/mpf/2q2026.pdf`，2026-06-30，積金局副本 2025-12-31）、
海通（`gthtam.com.hk` 的 Fund Monitor，2026-07-31，積金局副本 2025-12-31）、
BCT Pro Choice（`bcthk.com/MTS-Fund-Fact-Sheet`，2026-06-30，積金局副本 2025-12-31）、
宏利環球精選（`manulife.com.hk/…/services/forms/quarterly-fund-fact-sheet.pdf`，2026-06-30，
積金局副本 2026-03-31）、宏利自在人生（`manulife.com.hk/…/products/mpf/retirechoice-scheme/
fundfact-sheet.pdf`，2026-06-30，積金局副本 2025-12-31）及新地
（`shkp.com/Html/MPF/Fund%20Price%20and%20FFS%20for%20SHKPESS.pdf`，2026-06-30，
積金局副本 2026-03-31）及 MASS（`yflife.com` 逐隻成分基金一份便覽，14 份全部 2026-06-30，
積金局副本 2025-12-31）及富達（`fidelityinternational.com` 逐隻成分基金一份便覽，
23 份全部 2026-07-31，積金局副本 2025-12-31），資料新三至七個月；
餘下 1 個計劃（AMTD）仍未換版，原因見下。

## 逐隻基金一份便覽嘅來源結構

逐隻基金一份便覽時，`trustee-fact-sheet-links.json` 嗰筆寫 `funds`（逐隻聲明基金名、自己嘅
下載連結同本機檔名）而唔係 `file`，計劃層面嘅 `factSheetUrl` 指去列出全部便覽嗰一版。
兩者二擇其一，同時寫會報錯。冇咗「一份 PDF 逐版一隻基金」嗰個天然次序，所以**逐份對名**：
一份只可以切到一個區段，而且區段名要同名單聲明嗰隻對得上，唔啱就報錯（`disclosureForFund`）——
靠檔名或者次序猜，官網一改版就會把另一隻基金嘅配置同持倉貼落去。`factSheetAsOf` 亦由
「全份一個」變成逐份一個：全部同一期先報計劃層面嗰個，唔同期就淨係逐份保留
（`sharedFactSheetAsOf`），取最舊嗰個冚全份等於改寫其餘基金嘅官方日期。

## 換版前必須重跑覆蓋報告

換版面時要一併重跑覆蓋報告比對：Series 800 換到 2026-03-31 那期先揭發配置欄的註腳 `3`
落在 446，撞入原本去到 460 的持倉欄，令整張十大持倉表報唔可用。兩個 band 唔可以重疊。
永明那期換上受託人版先揭發整版疊印唔止一層：積金局副本每頁疊一層，受託人版有幾頁疊兩層，
`rejectOverlaidRows` 只做到「整塊當抽唔到」，19 隻成分基金全部冇持倉；改用落筆次序切層之後
19 隻全部齊十大持倉，並經逐頁對版核對過（見 `TitleSelector.overlaidPages`）。

## 覆蓋唔齊係常態，唔設覆蓋率斷言

配置及持倉的覆蓋本來就不齊，所以**不設**覆蓋率斷言（對照 `assertFactSheetCoverage`：便覽連結
必須齊 24 個計劃）。查不到就不寫入 payload，不可拿同計劃另一隻基金的披露頂上。
一個基金類別對應多過一份披露會報錯，因為靜默覆蓋等於把另一隻基金的持倉貼落去。
便覽的 `factSheetAsOf` 比平台快照落後四至八個月，每筆各自保留自己的日期，
不可沿用平台的 `dataAsOf`。基金詳情頁的「投資組合披露」一節同時顯示兩個日期，
不同期就標示並非完全可比；比重照原值印（披露寫 `11` 就係 `11%`），
固定成兩位小數等於改寫官方數字。

## 受託人每月摘要：三年累積回報（ADR 0014）

滙豐及恒生強積金智選計劃每月出《每月基金表現摘要》，主表有截至上月底的官方三年**累積**回報。
用 `packages/coverage/src/build-monthly-summary-returns.ts` 由舊回報候選檔加入新一期累積紀錄
（`--source`、`--base-candidate`、每份文件一個 `--summary "<計劃>|<網址>|<PDF>|<讀取時間>"`；
平台快照日期同摘要唔同就加 `--check-source <同期快照>`）。主表唔喺剛好一頁、有一行對唔上、
計劃有基金唔喺主表、或者一年累積同積金局平台同期一年回報唔一致，成份文件作廢。
累積紀錄唔會換算成年率化，唔入年率化排名；官方印「-」照出紀錄（`null`／`"-"`），網站寫官方未提供。

## Preserve trustee PDF source evidence

The manual `Archive trustee fact sheets to R2` workflow saves the source PDFs referenced by a dated trustee-link manifest. It records the link-manifest checksum, source commit, original URLs and filenames, retrieval times, byte counts, checksums, and failed downloads in a private archive index. The workflow does not change the factsheet links, extracted returns, ranking candidates, or publication data.

Run it from `main` with an existing `source_batch`. The download job uses sequential browser-impersonated requests and a 30-day GitHub artifact only as a handoff to the protected staging job. After a maintainer approves the `staging` environment, that job writes the deterministic archive and index to the staging R2 bucket and verifies byte-for-byte readback. No real R2 archive exists until that manual run completes; a partial fetch is recorded as partial and never presented as a complete set.
