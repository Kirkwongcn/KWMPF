# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues in `Kirkwongcn/KWMPF`. Use the `gh` CLI for all operations.

## Conventions

- Create, read, comment on, label and close issues with `gh issue`.
- Infer the repository from the Git remote when working inside this clone.
- Apply `ready-for-agent` to fully specified implementation tickets.
- Represent blocking relationships with GitHub native issue dependencies where available; otherwise retain a visible `Blocked by` section in each issue.
- Do not close or modify a parent issue when working on a child ticket.

## Acceptance conditions

每張實作票都要寫得出「點樣驗到」。會新增或改動**會出街嘅欄位、期間、排名或
分組**嘅票，收貨條件必須包含一條端到端核對：用最新 `data/sources` 批次跑一次
`publication-seed`，指定端點回傳非空，並抽三筆同官方原文對得上。
只驗自己嗰一層（API 回 200、UI 有得揀）唔算數——做法同前因見
`docs/agents/change-policy.md`。

`needs-info` 係「等使用者決定」，唔係「等 agent 做」。卡住方法論嘅票要麼收窄成
一個做得到嘅 v1，要麼標 `v2-backlog` 拎出 open 列表，唔好留住扮 pipeline。

## Pull requests as a triage surface

**PRs as a request surface: no.**

## When a skill says “publish to the issue tracker”

Create a GitHub issue in `Kirkwongcn/KWMPF`.

## When a skill says “fetch the relevant ticket”

Run `gh issue view <number> --comments` inside this clone.
