# 現行強積金覆蓋清單

`current.json` 是 2026-06-30 MPF Fund Platform 基線產生的第一份覆蓋清單：24 個計劃、451 個基金類別候選、11 名受託人。平台顯示 382 隻成分基金；列表中的基金顯示名稱可能包含基金類別，因此在逐 `cfid` 及計劃文件核實前不可用名稱自行合併。

目前已逐 `cfid` 核實全部 451 個平台基金類別身份，並按三個受託人批次交叉核對最新受託人基金入口／KSID及MPFA計劃文件。451項均取得三方一致證據並標示為 `verified`；日後任何來源缺漏、改名、轉移或終止訊號，重建時會轉為 `pending_verification`、列出來源網址與核對時間，並立即排除排名。

重建：

```sh
bun coverage:build \
  --source-dir data/sources/2026-08-11 \
  --output data/coverage/current.json
```

重新擷取並封存 Fund Platform 原始 HTML：

```sh
bun coverage:fetch-platform \
  --expected-fund-classes 451 \
  --expected-constituent-funds 382 \
  --expected-schemes 24 \
  --expected-trustees 11 \
  --expected-counts-source https://mfp.mpfa.org.hk/eng/mpp_download_asset_size.jsp \
  --raw-dir <原始資料封存目錄> \
  --run-id <不可重用的擷取版本> \
  --output data/sources/2026-08-11/mpf-fund-platform.json
```

四個 expected counts 取自獨立的積金局資產規模文件，不可由同次平台擷取結果推算。每次擷取寫入不可覆蓋的 run 目錄，並產生逐檔 URL、資料日期、擷取時間、SHA-256、大小及解析狀態的 `manifest.json`。這些數字是本快照的官方 2026-06-30 驗收基線，不是永久常數；新一輪官方總數改變時，須先核實新增／移除報告才更新。

加入後續官方來源時重複 `--source`；需要偵測新增、移除或身份改變時，加入 `--previous <上一份覆蓋清單>`。

第二批官方來源的固定快照產物由以下指令重建；它同時載入第一批作回歸核對，避免第二批發布時遺失既有 verified 狀態：

```sh
bun coverage:second-batch \
  --platform data/sources/2026-08-11/mpf-fund-platform.json \
  --scheme data/sources/2026-08-11/official-scheme-batch-01.json \
  --scheme data/sources/2026-08-11/official-scheme-batch-02.json \
  --trustee data/sources/2026-08-11/trustee-01.json \
  --trustee data/sources/2026-08-11/trustee-02.json \
  --trustee data/sources/2026-08-11/trustee-03.json \
  --trustee data/sources/2026-08-11/trustee-04.json \
  --trustee data/sources/2026-08-11/trustee-05.json \
  --trustee data/sources/2026-08-11/trustee-06.json \
  --trustee data/sources/2026-08-11/trustee-07.json \
  --trustee data/sources/2026-08-11/trustee-08.json \
  --output data/coverage/second-official-batch.json
```

餘下三名受託人使用 `coverage:remaining-batch`，完整重建三批來源後產生 `remaining-official-batch.json`；若任何來源缺失或身份不一致，該項會保留為 `pending_verification`，不會被靜默標成 verified。

來源及限制詳見 `docs/research/2026-08-11-current-mpf-coverage-sources.md`。
