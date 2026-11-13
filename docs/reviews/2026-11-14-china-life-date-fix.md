# 中國人壽季度便覽日期修正

2026-11-14 香港時間。正式版本的十筆回報原已標示 2026-06-30，再解析同一原件時卻得出 2026-06-23。PDF 封面有重疊的 2023 年與 2026 年文字層，版面抽取把舊年份的尾數與下一行 June 2026 拼接。已在[獨立修正分支的程式 commit](https://github.com/Kirkwongcn/KWMPF/commit/2e75e81bd29e9754dcd169ce20da4d238b65cbb8)改用第一頁的原始文字次序及標示季度來核對日期，保留版面抽取讀取數值。多個候選仍有歧義或中英文日期無法吻合時，解析會報錯。

## 官方原件逐項比對

重新下載[中國人壽官方便覽](https://www.chinalife.com.hk/sites/default/files/2026-08/2026%E5%B9%B4%E7%AC%AC%E4%BA%8C%E5%AD%A3%E5%9F%BA%E9%87%91%E8%A1%A8%E7%8F%BE%E4%BE%BF%E8%A6%BD.pdf)，SHA-256 為 `aa02dd277e9a51bc17c2b3172791fdaad9b1956bbc2d161507b135bea1c4e5a4`。可見封面日期及修正後十筆解析日期同為 2026-06-30。以下各項均按原 PDF 的年率化表、基金本身的三年欄及積金局基金類別比對，與正式候選值相同。

| 基金類別 ID | 官方基金名稱 | PDF 頁 | 三年年率化原印值 |
|---|---|---:|---:|
| mpfa-cf-1839 | China Life Greater China Equity Fund | 2 | 17.12% |
| mpfa-cf-1840 | China Life US Equity Fund | 2 | 18.68% |
| mpfa-cf-895 | China Life Hong Kong Equity Fund | 3 | 7.72% |
| mpfa-cf-606 | China Life Retire-Easy Global Equity Fund | 3 | 16.95% |
| mpfa-cf-236 | China Life Balanced Fund | 4 | 10.63% |
| mpfa-cf-237 | China Life Growth Fund | 4 | 13.12% |
| mpfa-cf-1546 | China Life Age 65 Plus Fund | 5 | 5.92% |
| mpfa-cf-1545 | China Life Core Accumulation Fund | 5 | 13.68% |
| mpfa-cf-603 | China Life Joyful Retirement Guaranteed Fund | 6 | 4.85% |
| mpfa-cf-238 | China Life MPF Conservative Fund | 7 | 2.77% |

## 驗收及接手狀態

- 新回歸測試先在舊程式重現 6 月 23 日，修正後通過。涵蓋舊文字層、季度不符、日期矛盾、缺少判別資料。覆核 47/47 項解析器測試通過，coverage TypeScript 檢查通過。Windows 首輪另有一項 Fidelity 測試受 CRLF 影響，重跑採用 Git 的 LF fixture，之後已還原本機換行。
- 以正式命令 parse-fact-sheets.ts 讀取同一原件，10 筆成功；再以 merge-fact-sheet-returns.ts 對十月名冊，10 筆唯一匹配，未匹配及歧義均為 0。
- 全部十筆已超過 90 日，修正不增加合資格基金。正式三年排名完整回應與先前基線一致：79 筆入榜、271 筆過期、0 筆名次改動。正式 API 和 main 版本 9d7d5509c3393e79d53d2d1e14576d488a52ac09。日常自動寫入開關未設定，維持關閉。此為合併前驗收，合併後結果如下。

## 合併後驗收

[PR #410](https://github.com/Kirkwongcn/KWMPF/pull/410) 已 squash-merge，main commit 為 `47d0f6d7598a7539f8e66d562ef4daf66a590e49`。[PR CI](https://github.com/Kirkwongcn/KWMPF/actions/runs/43469205797) 的 verify、high-risk-review、e2e 均通過；[main CI](https://github.com/Kirkwongcn/KWMPF/actions/runs/43469606697) 的 verify 通過。 獨立覆核發現同季度出現兩個中文日期仍可能通過，已加入拒絕條件及回歸案例。

已在上述 main commit 重新下載官方原件並核對 SHA-256，以正式解析入口及積金局名冊重跑，上表十個基金類別皆唯一匹配；原印回報、正式候選值及本機 publication seed 逐筆相同，截至日均為 2026-06-30。解析器測試 47/47 及 coverage TypeScript 通過。正式三年排名完整回應與合併前一致，79 筆入榜、271 筆過期；日常自動寫入開關仍未設定。本次沒有正式部署，線上 Worker 仍為 9d7d5509c3393e79d53d2d1e14576d488a52ac09。
