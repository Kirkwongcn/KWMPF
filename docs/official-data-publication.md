# 例行官方資料發布

2026-11-13，維護者授權例行官方資料更新自動完成搜尋、核對、合併及正式資料發布。新增來源須先核實發布者、基金身分、回報口徑、精度及日期，加入受信來源後才適用。

## 日常操作

- 積金局平台按週建立快照。受託人按日抓取指定官方接口及便覽。友邦從目錄尋找最新一期；萬通重抓各基金的固定 PDF，使用文件內的表現日期。來源的頻率及範圍受限於各發布者的公開資料。
- GitHub 保存來源、擷取時間及雜湊。有變更時建立純資料候選。允許重新執行同一天的抓取；候選沒有實質更新便結束。資料進入 main 前，須驗證來源工作、候選內容、分支版本、資料異常及必要 CI。
- 正式資料作業只使用獨立 GitHub 環境 production-data。執行前核對版本、正式資料基線及 schema，備份至私有 R2 並讀回驗證，再更新 D1 的發布資料及核對公開 API。Worker 及 Pages 版本由獨立程式部署流程管理；資料發布後，網站 /health 的程式版本可與新的資料快照版本不同。
- 下載失敗、來源身分改變、同日官方修訂、檔案或基金配對不足、互相矛盾的資料，須查閱 workflow 報告及 follow-up issue。保留原印值和日期。已安全隔離的個別資料，不阻止其他通過核對的官方更新。

## 一次性設定及停止方式

1. GitHub 的 production-data environment 限制分支為 main。三個 environment secrets 為 DATA_PUBLISH_ACCOUNT_ID、DATA_PUBLISH_D1_ID、DATA_PUBLISH_CF_TOKEN。token 需要對相應 Cloudflare 帳戶的 D1 查詢、匯出、匯入、復原及 R2 物件讀寫授權。向 GitHub Secrets 直接提供 token；文件、issue、工作日誌只記錄名稱。
2. repository variable OFFICIAL_DATA_AUTOPUBLISH 設為 1 才允許自動作業。Check data publishing connection 唯讀核對指定資料庫、現行發布快照及備份 bucket，供開通時驗證。正式資料發布另會用實際備份與讀回驗證檢查相應權限。
3. 暫停例行自動合併及發布可將 OFFICIAL_DATA_AUTOPUBLISH 設為 0。來源抓取仍可產生候選。已開始的正式資料操作先查 run 與備份／回復狀態，避免在中途強制取消。
4. 程式、workflow、資料庫遷移、權限變動，以及無法按現有官方口徑解決的異常，交由維護者決定。正式程式部署繼續使用 production 環境及其獨立審批。

GitHub 設定入口：[production-data 與其他環境](https://github.com/Kirkwongcn/KWMPF/settings/environments)、[Actions variables](https://github.com/Kirkwongcn/KWMPF/settings/variables/actions)、[自動作業紀錄](https://github.com/Kirkwongcn/KWMPF/actions)。
