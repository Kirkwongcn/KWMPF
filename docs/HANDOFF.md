# KWMPF 即時交接

更新：2026-11-12 00:35–00:45（Asia/Hong_Kong）；API的時效評估日為UTC 2026-11-11。這是獨立只讀查核及文件修訂，不是新發布。
詳細證據讀[本次查核](reviews/2026-11-12-independent-status-audit.md)，下一批工作讀[優先待辦](NEXT_TASKS.md)。

## 1. 版本及授權

- Repo：`https://github.com/Kirkwongcn/KWMPF.git`（public）。
- **已驗證main**：`11750936e88f697b54dca40d0c58afeac5ea3bac`，2026-10-20T17:11:42Z的PR #399合併commit。
- **本次文件branch**：`docs/status-audit-20261112`，從以上main建立；本機checkout `C:/Users/user/Documents/Codex/2026-09-26/kwmpf/work/kwmpf-review-redesign`，起始status乾淨，已是linked worktree，沒有另開巢狀worktree。
- 文件不能自引最後commit；最後SHA／push／status由本輪外部回執及GitHub該分支核對。下一位接手應以使用者收到的最後文件SHA取得本分支，網站程式基線仍是上列main。
- **未經使用者對該次操作批准，不得合併main、部署、dispatch／批准protected gate、修改Cloudflare設定、寫remote D1／R2。** 本輪只保存文件，沒有新功能／重構、網站測試或build。

2026-10-01交接branch `docs/claude-handoff-20261001-safe`／commit `2e711533cd19a4c002b7d1b47f0cb80d548f947b`保留作歷史。它未包含後來的ADR0010–0016及最新code，不可拿來覆蓋本輪基線。舊交接的45日時效、Lipper分類及「三年累積待決」已被後來ADR取代。

## 2. 正式版本：已驗證

| 層次 | 本次實際結果 |
| --- | --- |
| 正式前端 | `https://kwmpf.kirkwongcn.com/`可載入；title「KWMPF｜香港強積金比較」；JS入口`/assets/index-B35mfBxF.js` |
| Pages project／deployment | `kwmpf-web-production`／`c29ce958-459c-4600-aa0e-034090dbcdbf`；production、deploy success；commit與main相同；建立於2026-10-20T17:18:45.194415Z |
| Worker deployment／version | `kwmpf-api-production`／deployment `21d83889-c054-4c70-ab37-95dd51f09f8b`；version `66e8c461-afe9-4297-a687-f7edb36e8ceb`，100% traffic |
| Worker版本及線上health | version binding `RELEASE_VERSION`與`GET /health`均為main完整SHA；health 200、status ok |
| 正式資料 | `GET /summary` 200；snapshot `snapshot-mpfa-platform-2026-09-30-11750936e88f`；451類別／24計劃／11受託人；官方截至2026-09-30 |
| 來源／回報候選 | `data/sources/2026-10-12/mpf-fund-platform.json`；`data/coverage/2026-10-20-official-return-observations-candidate.json` |
| 發布佐證 | [Production run #50](https://github.com/Kirkwongcn/KWMPF/actions/runs/39463946045) success；Worker及Pages marker均指該run／同一SHA；jobs列migration、seed、備份讀回、部署、smoke及release tuple success |

Pages metadata仍有`commit_dirty=true`；版本marker／API／deployment一致已核實，並未逐byte重建frontend bundle。沒有直接讀production D1、重做備份／還原或讀回R2 release manifest。

## 3. PR #399與Issue #396

**已驗證**：[PR #399](https://github.com/Kirkwongcn/KWMPF/pull/399) closed且merged，merge SHA就是main；只新增兩個`data/coverage`檔。
獨立讀committed候選並與2026-10-14基底逐key比較：724行＝350年率化＋374累積，28行宏利三年累積改至2026-09-30，696行不變，0新增／0刪除key。這不是724行全部重新核對原文。
CI #906／run39463735871的verify、high-risk-review及publication-seed step為success；三筆原文是PR歷史證據，本輪未重下載PDF或跑seed。當時70排名／280過期不能當今日數字。

**已驗證**：[Issue #396](https://github.com/Kirkwongcn/KWMPF/issues/396)仍open，只有2026-10-17的一則Hermes調查留言。其早期「宏利整份作廢」處理已被#397／ADR0016部分取代；計算方法與官方回覆仍未解決。
同日2026-09-30：DHK121／`mpfa-cf-365`受託人5年`3.69`對平台`3.72`、10年`5.71`對`5.78`。committed report保留兩組原值／原文／日期／來源SHA，並抑制該行Lipper補位。
線上detail也確認三年累積仍`2.66`、自己的日期2026-08-31；平台原生5／10年累積仍是`3.72`／`5.78`，不能誤說所有平台年期均被清空。三年年率化是另一個欄位，其六月底來源已stale。

## 4. 今日覆蓋及新候選

- 線上三年**年率化**`/rankings?metric=return&period=3`：37行、313 stale；一年447行、0 stale。均200且同snapshot。它們不是三年累積排序的行數，也不是全來源覆核。
- [PR #400](https://github.com/Kirkwongcn/KWMPF/pull/400) open，head `32ee78898a4f60585b8e058d0a152aee35dead16`；候選/report日期2026-10-26、官方截至2026-09-30。MASS已有14行同期核對；BOC-Prudential仍download-failed、Sun Life Rainbow仍六月底；三筆人工原文checkbox未完成。
- [PR #402](https://github.com/Kirkwongcn/KWMPF/pull/402) open，head `6a9e91c6425df577d9df19ec72cb9009610244a9`；平台候選截至2026-10-31，report outcome=`needs_review`、publishable=false。7項費率變更，涉及`mpfa-cf-799`、`908`、`1821`；451行結構ready不等於准發布。
- [Issue #401](https://github.com/Kirkwongcn/KWMPF/issues/401)仍open；run40598195002實際錯誤是cf_id466的platform protection page，不是已證明基金數量變動。之後11月3／10日來源refresh success；舊故障不能當持續停機，也未證明已永久修復。

## 5. 部署觸發與操作排隊

本次main YAML核對：CI為PR／push main；production／staging網站deploy只`workflow_dispatch`，production要求main、確認字串、同SHA CI、來源審查及environment。
Cloudflare兩個Worker以immutable tag查Build triggers皆空；production Pages回應無Git source設定。功能branch push不符合這些已核實的正式部署觸發；外部hook及GitHub environment實際reviewer／branch policy仍未核實。

觀察到production backup #7 waiting、#8 pending，staging backup #17 waiting、來源封存#11 waiting；最後查到的production backup success為10月25日#6。等待不等於失敗；未查明原因／持鎖情況，不自行approve、cancel或rerun。詳見優先待辦。

## 6. 驗證界線、未同步及接手頭三步

**本輪實跑**：Git remote/main/branch/status/fetch、GitHub PR/issue/comments/files/jobs GET、Cloudflare Pages/Worker/version/Build triggers GET、隔離Chrome唯讀GET首頁／health／summary／一及三年排名／一隻基金detail；committed JSON逐key核對及文件完整性檢查。
**未執行**：安裝依賴、application tests、typecheck、build、E2E／publication-seed、PDF重抓／重抽、D1或R2 mutation、merge／deploy。歷史CI另標run與日期。
本輪程式／來源資料／workflow／lockfile未改；最後文件commit/push由回執定位。其他舊checkouts未重新盤點；10月1R2交接index及Codex Cloud／Claude／NAS存取未重驗，不假稱已同步到那裡。

下一位頭三步：

1. 取得使用者回執的本文件branch／SHA，核對HEAD／remote／status；讀AGENTS、CONTEXT、本頁、NEXT_TASKS及相關ADR；再次查main是否前進。
2. 先處理PR402的7項費率原文／date／disposition核對，再確認PR400是否有有效增量及三筆原文；兩個分開審查，不拿舊平台snapshot交叉核對新月份。
3. 依NEXT_TASKS取得具體實作／操作批准；若要修code再按change-policy以最新source與overlay做隔離驗收。任何合併／部署須等使用者批准。
