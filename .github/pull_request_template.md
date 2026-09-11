## 做咗咩

<!-- 一至三句。對應邊張 issue（Closes #NNN）。 -->

## 收貨條件

<!--
逐條抄 issue 的收貨條件，寫明點驗到。
凡係新增／改動會出街嘅欄位、期間或排名，必須包括端到端那一條：
用最新 data/sources 批次跑一次 publication-seed，指定端點回傳非空，
並抽三筆同官方原文對得上（做法見 docs/agents/change-policy.md）。
-->

- [ ]

## 改動組成

- [ ] 資料檔（`data/`）同 code 分開 commit 或分開 PR；混在同一個 diff 等於冇人 review 到 code

## 高危覆核

<!--
只在改到 scripts/high-risk-paths.txt 列出的路徑時需要，CI 會檢查。
勾之前要真係跑過——勾咗但冇做，責任在勾嘅人。
純 UI／文件 PR 唔使理呢一節。
-->

- [ ] high-risk: code-review
- [ ] high-risk: publication-seed

code-review evidence: <!-- findings／零發現及修正結果 -->

publication-seed evidence: <!-- 端點數量及三筆官方原文核對結果 -->
