# 2026-11-12 獨立GitHub及正式版本查核

查核窗：香港時間2026-11-12 00:30起；遠端主要回應為UTC2026-11-11 16:30–16:36。只讀查核、文件保存；[HANDOFF](../HANDOFF.md)為入口，[NEXT_TASKS](../NEXT_TASKS.md)列待辦。

可重讀的精簡回應存[證據JSON](../handoff/2026-11-12-status-evidence.json)。它是有日期的回應快照；日後仍須再讀live來源。

## 方法與來源

先讀KW-Knowledge正式專案索引及「官方來源衝突須隔離並保留雙方原文與日期」正式頁：2026-10-30整理、固定main1175093、H01原候選v1.1已正式收錄；內容是具名歷史文件／程式證據，未重跑原系統，不當本輪現況或操作授權。
之後獨立GitHub GET main ref、PR399、其files／exact-head CI jobs、Issue396及全部一則comments；查open PR（2項）、open issue（2項）、main exact-SHA runs；Cloudflare GET Pages canonical／Worker deployments／active version／兩個immutable-tag Build triggers；隔離Chrome讀正式網站及公開API。
沒有登入Zo／Claude、沒有啟動其他LLM任務或讀私人認證內容。

## A. GitHub結果

| 查核 | 結果／直接來源 |
| --- | --- |
| main | [ref](https://api.github.com/repos/Kirkwongcn/KWMPF/git/ref/heads/main)＝`11750936e88f697b54dca40d0c58afeac5ea3bac` |
| #399 | [PR](https://github.com/Kirkwongcn/KWMPF/pull/399) closed／merged，2026-10-20T17:11:42Z；merge SHA同main；僅candidate與report兩檔 |
| #399 CI | [CI906](https://github.com/Kirkwongcn/KWMPF/actions/runs/39463735871)，head851b05ba68a5817e5b308303bfa3f04a9ba1ac0f；verify、high-risk-review success；E2E job內publication-seed step success，Install Playwright browser／Run Playwright E2E皆skipped；不能把job成功說成當次Playwright通過 |
| main CI | [CI907](https://github.com/Kirkwongcn/KWMPF/actions/runs/39463930380) success，exact main SHA；不是本輪新跑 |
| #396 | [Issue](https://github.com/Kirkwongcn/KWMPF/issues/396) open；調查留言日期2026-10-17。讀到的是歷史原文／推測與建議，沒有已確認的官方計法回覆 |
| 開放PR／issue | #400、#402；issue #396、#401。故「#399之後沒有其他PR」只可指已合併主線，不能解作沒有待審PR |

另以本機fetch後同一main的committed JSON作逐key核對：2026-10-14→10-20候選皆724行，28個key內容改變、0新增／0移除，變動皆宏利三年累積至2026-09-30；696行不變。350年率化＋374累積；DHK121三年累積保留2.66@2026-08-31。
PR列三筆44.15／17.79／12.01也在候選中找到；**本輪未重讀官方PDF**，不能把這個JSON一致性核對當新原文認證。

## B. 正式部署交叉核對

- Pages canonical：`c29ce958-459c-4600-aa0e-034090dbcdbf`；project `kwmpf-web-production`，stage success、environment production、branch main，commit同1175093。
- Worker：deployment `21d83889-c054-4c70-ab37-95dd51f09f8b`、version `66e8c461-afe9-4297-a687-f7edb36e8ceb`，100%；RELEASE_VERSION同main。
- 兩者marker：`KWMPF-release-run=39463946045-attempt=1-sha=11750936e88f697b54dca40d0c58afeac5ea3bac`。
- [Deploy50](https://github.com/Kirkwongcn/KWMPF/actions/runs/39463946045) jobs列成功的D1備份／R2讀回／migration／完整seed／Worker／Pages／smoke／release tuple；這些是10月20歷史執行結果，沒有當成本輪新操作。
- 正式域名列在Pages project domains，首頁實際可載入；入口JS `index-B35mfBxF.js`。metadata有`commit_dirty=true`，未重建byte-equivalent bundle，不聲稱乾淨checkout可重現位元組已驗收。

## C. 實際線上GET（UTC 2026-11-11）

| URL path（API origin為kwmpf-api-production.kw-screener.workers.dev） | 狀態／內容 |
| --- | --- |
| `/health` | 200；status ok、version為main；bindings d1/r2=true只表示binding存在，不是備份成功證明 |
| `/summary` | 200；snapshot-mpfa-platform-2026-09-30-11750936e88f；451／24／11，dataAsOf earliest/latest皆9月30 |
| `/rankings?metric=return&period=1` | 200；447行，0 stale；同snapshot |
| `/rankings?metric=return&period=3` | 200；37行，313 stale；同snapshot；是三年年率化，不是累積 |
| `/fund-classes/mpfa-cf-365` | 200；三年累積2.66、自身8月31日，90日／age72／verified；三年年率化來源6月30日、age134／stale；平台5／10年累積3.72／5.78 |

API時效用UTC日界，不能把香港11月12日直接代成API age的11月11日。summary cache-control仍public max-age=300／stale-while-revalidate=600；本輪沒有做完整conditional request／cache invalidation驗收。
一般web fetch工具無法取得該站/API，後改用隔離Chrome只讀fetch成功；初次工具失敗不是網站停機。

## D. 來源／流程待辦的精確差別

- PR402 report `decision.outcome=needs_review`、`publishable=false`，但`readiness.ready=true`／451 accepted；7項fee_changed涉及3類別。這不是fail-open，readiness與publication decision不可混用。異常明細見NEXT_TASKS。
- PR400 exact head32ee788報告已收MASS14行9月資料，且仍登記兩個DHK121 officialConflicts、quarantinedRows含365、thirdPartySuppressedForConflicts含365、rejectedSources空。這些是候選，尚未正式發布；原文三筆checkbox未完成。
- main `.github/workflows/refresh-trustee-returns.yml`仍只把`rejectedSources`寫入rejected.txt，再用它／下載異常／job failure開issue；沒有把officialConflicts獨立輸出到跟進issue。同一候選無內容增量時會刪OUTPUT與REPORT。故reader隔離已實作，workflow層「官方衝突跟進／保留證據」仍有明確缺口。
- Issue401錯誤是platform protection page。11月3日run41742652172、11月10日run42927409530之後成功；機制改良與關閉issue仍需證據，不能說目前來源管線完全停止。

## E. 待批准的操作隊列（讀取時狀態）

| Run | 名稱／狀態 |
| --- | --- |
| 41298296735 | production backup #7，waiting |
| 42471889732 | production backup #8，pending |
| 42465108374 | staging backup #17，waiting |
| 42927825888 | source archive #11，waiting |
| 39506456555 | source archive #8，waiting，較舊run也未結 |
| 40177037169 | production backup #6，10月25日success，是這次main runs中最後成功者 |

沒有把waiting／pending推斷成gate拒絕、token失效、備份失敗或資源鎖原因。沒有批准或取消run。source archive #10另見success，不等於#11也完成。

## F. 保存、權限與驗證範圍

現有linked worktree已隔離；由乾淨old handoff branch切換新功能branch `docs/status-audit-20261112`，base是最新main，保留原branch。只更新Markdown及非敏感metadata，未修改網站code／data／workflow／lockfile。
功能push安全查核：CI僅PR/push main；網站deploy manual，要求main／確認／同SHA CI／來源審查。兩Worker的Build trigger空；Pages無Git source。外部webhook、GitHub environment reviewer／branch policy仍未全面核實，不能從YAML猜。
未重跑安裝、application tests/build/E2E/seed，未直接查D1、讀回R2、重下載PDF、觸發任何workflow或改正式環境。沒有批准main merge或部署。
本輪外部證據及工具回執保存在Windows工作空間`outputs/status-audit-2026-11-12/`；公開分支另存精簡JSON證據。10月1R2保存包及NAS／其他LLM存取仍只是舊checkpoint，本輪沒有更新其pointer。接手exact文件SHA由最後外部回執及GitHub功能ref核對，文件不能自引自己的commit。
