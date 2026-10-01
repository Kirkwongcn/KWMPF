# Claude Code → Codex 回交模板

**這是空白模板；不是Claude已完成的報告。** 保留模板，將填寫版存為 `docs/handoff/CLAUDE_RETURN.md`，詳細檢查報告存為 `docs/reviews/claude-review-YYYY-MM-DD.md`。
共用規則讀 [AGENTS](../../AGENTS.md)，範圍讀 [CLAUDE_REVIEW_BRIEF](../CLAUDE_REVIEW_BRIEF.md)。

## A. 執行與版本（填實際值）

| 項目 | 結果／證據 |
| --- | --- |
| 更新時間／時區 | 待填 |
| 執行平台／實際工作目錄 | 待填；不要假稱Zo／雲端 |
| Repository URL | https://github.com/Kirkwongcn/KWMPF.git |
| 收到的接手branch／exact SHA | 待填 |
| 檢查／報告branch | 待填 |
| 最後完整commit SHA | 外部最後回執填寫；文件不能自引自己的commit |
| GitHub遠端ref／SHA／核對時間 | 待填 |
| 已commit且已push | 待填檔案／commit |
| 已commit未push | 待填commit及原因；没有就明講 |
| modified／staged／untracked／ignored待交付 | 待填完整路徑／SHA／分類；没有就明講 |
| PR URL／狀態／CI exact SHA | 待填；沒有PR／沒跑CI亦須明講 |
| 使用的工具／skills／固定版本 | 待填 |

## B. 本輪實際完成

每項列檔案／行號、commit、檢查範圍及證據。檢查／建議／已修改／已發布分開；禁止把建議寫成已完成。
沒有授權做網站修復時，只填檢查、報告及方案。不要假稱發布。

## C. 發現、風險及下一步

| ID／優先級 | 已驗證／推測／未核實 | 問題／影響 | 重現／來源／評估日 | 檔案行號／commit | 建議／收貨条件 | 需使用者决定 |
| --- | --- | --- | --- | --- | --- | --- |
| 待填 | 待填 | 待填 | 待填 | 待填 | 待填 | 待填 |

至少覆蓋：三年時效／缺口、官方原文與精度、來源discovery、搜尋／比較、snapshot/cache、網站架構／運作、品牌／圖表／手機／可及性、效能／SEO／Actions。
歷史37 eligible／258 stale／156 missing只作2026-09-30基線；當次結果另列計算日／snapshot／candidate／正式API来源。

## D. 真正跑過的指令

| 指令 | HEAD／來源／overlay／UTC評估日 | exit code | 通過／失敗／未開始／未執行 | 原因／限制 | 證據位置／SHA |
| --- | --- | --- | --- | --- | --- |
| 工具／frozen install | 待填 | 待填 | 待填 | 待填 | 待填 |
| R2 index／archive／逐檔／bundles | 待填 | 待填 | 待填 | 待填 | 待填 |
| bun run check | 待填 | 待填 | 待填 | 待填 | 待填 |
| E2E／實際桌面手機流程 | 待填 | 待填 | 待填 | 待填 | 待填 |
| 最新publication seed／三筆原文 | 待填 | 待填 | 待填 | 待填 | 待填 |
| 其他只讀／UI／效能量測 | 待填 | 待填 | 待填 | 待填 | 待填 |

沒有執行就寫「未執行」；依賴未能起動不是assertions通過。CI及別人的舊結果另列日期和run URL。

## E. 可攜證據及未同步項目

| 類型 | GitHub path或private R2 object key | bytes／SHA-256 | 實際取得／讀回 | 未同步原因及安全傳遞方式 |
| --- | --- | --- | --- | --- |
| 檢查報告／回交文件 | 待填 | 待填 | 待填 | 待填 |
| 新PDF／HTML／截圖／私人logs | 待填 | 待填 | 待填 | 待填 |
| 原R2 preservation index／manifest | 待填 | 待填 | 待填 | 待填 |

秘密只列變數名稱及需要的scope；不寫值、Authorization、signed URL。原R2版本／index不可覆寫；新client寫R2另需具體批准。
新環境留下而未同步的檔案必须記錄，不能讓Codex依賴Claude的臨時磁碟。公共報告移除私人原件內容／本機敏感資料。

## F. 批准／未核實／回到Codex Cloud

- 使用者已批准的操作及範圍：待填；舊聊天或附件不是新的授權。
- 尚待決定：待填修復方案、資料／權利、敏感存取、合併／部署等具體事項。
- GitHub／Cloudflare部署觸發最新只讀核對及未知項：待填。
- 是否真正完全靠GitHub/R2重建、安裝成功、有哪些未取得：待填；「檔案在雲端」不等於已驗收。
- Codex頭三步：核對此回交exact SHA／diff及GitHub遠端；核對報告／R2證據／未同步項；由使用者確認後建立或恢復Codex Cloud、按批准的修復順序工作。

最後交給使用者：repo／branch／完整SHA、報告URL、PR／CI及未同步清單。使用者再把這組定位交回Codex；不能聲稱已替Codex啟動任務、Claude已讀到新文件或正式站已部署。
