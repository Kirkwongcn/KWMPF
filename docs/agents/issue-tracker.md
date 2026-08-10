# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues in `Kirkwongcn/KWMPF`. Use the `gh` CLI for all operations.

## Conventions

- Create, read, comment on, label and close issues with `gh issue`.
- Infer the repository from the Git remote when working inside this clone.
- Apply `ready-for-agent` to fully specified implementation tickets.
- Represent blocking relationships with GitHub native issue dependencies where available; otherwise retain a visible `Blocked by` section in each issue.
- Do not close or modify a parent issue when working on a child ticket.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## When a skill says “publish to the issue tracker”

Create a GitHub issue in `Kirkwongcn/KWMPF`.

## When a skill says “fetch the relevant ticket”

Run `gh issue view <number> --comments` inside this clone.
