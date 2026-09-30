# KWMPF 原有風格與資料圖表更新

模式：Operate；方法與來源頁：Read。

使用者於 2026-09-30 確認一般成員與研究者同等重要，採簡潔首頁及深入分析；同日明確要求恢復原有 KWMPF header／風格，並增加專業而多樣的資料圖表。此指示取代先前鈷藍、統一 sans 及 12px 面板的替代方向。

## Direction contract

THESIS：在原有 Kirk Wong Research 品牌下，把強積金比較做成可查證的資料工作台。圖表揭示幅度、期間與有效組成；完整原值表格保留來源、日期及資料限制。

OWN-WORLD：原有深青 #123b46 的 72px 頁首、金色 kW 圓形、Kirk Wong Research 加 serif KWMPF；既有世界地圖 hero。暖白 #f6f5f1、青綠 #267786、金色 #c7a66a；4px 資料面板、8px 控制項、16px 正文及 tabular numerals。內容上限 1520px；桌面側內距 clamp(18px, 4vw, 64px)，中小螢幕按來源覆寫為 28px／20px。

STORY：找到基金，先確認計劃與類別身份，再選組別及期間；透過圖表識別差異，透過原值、欄位日期與來源核對。簡潔與深入分析共用選取及資料，均能到達來源與限制。

FIRST VIEWPORT：原有品牌頁首與地圖 hero；導覽為基金瀏覽、基金排名、計劃比較。hero 下方提供資料覆蓋與閱讀模式。手機導覽換行；寬表有水平捲動提示，兩欄費用、配置及曆年表採緊湊換行版面。

FORM：現有 React／CSS／資料圖形實作。Impeccable context launcher 曾未成功運行，本次沿用直接讀取 context/reference 的 fallback。未執行 detector、engine 或 hooks，未下載 runtime，也沒有 concept-seed assignment。

SIGNATURE INTERACTION：排名的圖表／完整表格選擇，以及組別、期間與指標保留在網址；點圖／橫條的 chartKind 選擇目前只在元件內保留，不寫入網址。基金並列用回報矩陣、期間點圖及原值寬表；標籤包括計劃／基金類別，以辨認同名基金。曆年回報是獨立柱形，不連成 NAV／價格走勢。有效完整配置以圓環或堆疊表達；不完整但可用配置使用獨立條形。

## Data presentation boundaries

- 原百分比不補零、不固定小數；零值與缺失分開。
- 每個期間保留自己的來源與截至日期，不能以快照日期代替。
- 點／條形回報圖不畫過期或未核實數值；矩陣保留其原值文字但不著色、不參與色階。
- 未知缺項標示「未取得」；只有來源明示時才稱「官方未提供」。不把尚未抽取當作沒有披露。
- BEA 異常配置已由顯示守門隔離圖表及數值表，保留便覽原文入口；這不是 parser 已修復的證據。
- 排名只在同組進行，跨組並列明示限制；不合成推薦總分。

## Evidence and provenance

現有來源：apps/web/src/styles.css、SiteChrome.tsx、DataCharts.tsx、RankingsPage.tsx、FundComparePage.tsx、FundClassPage.tsx 及相關頁面。原有畫面參照位於 ../../outputs/original-style/desktop.png 與 mobile.png；絕對位置為 C:/Users/user/Documents/Codex/2026-09-26/kwmpf/outputs/original-style/。本輪桌面、手機及 500px 畫面矩陣共 19 個 viewport 情境，紀錄與截圖位於 .impeccable/review/。

shipping raster 是沿用的 apps/web/public/images/kirk-wong-hero.webp；本次沒有新增或生成 raster。原有 PNG／WebP 的歷史來源不重新標成新生成資產。

## Finish and limits

限定修正範圍的 R1–R4 已關閉，最終 R2「未取得」措辭覆核已解決；該範圍 verdict 為 ship。父工作階段回報既有前端 115/115、桌面／手機 66/66，0 skipped／flaky；本文件更新沒有另跑測試。最後本機發布資料為 UTC 2026-09-30 的 37 合資格／212 過期／202 缺項，只記錄本機狀態，不代表正式發布。

Sun Life Income 期間錯配 issue #355 與 BEA allocation parser issue #356 仍為生產發布阻擋；沒有修復候選批次或後端來源。這次文檔是已觀察介面及限定修正範圍的紀錄，不構成完整來源正確性或正式上線認證。主要按鈕仍有非契約鈷藍滑入遺留，hero 上方既有小標籤不被擴張成通用設計規則。
