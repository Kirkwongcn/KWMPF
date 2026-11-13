#!/usr/bin/env bash
set -euo pipefail

repo="repos/$GITHUB_REPOSITORY"
test "$GITHUB_REF" = refs/heads/main
test "$(gh api "$repo/git/ref/heads/main" --jq .object.sha)" = "$GITHUB_SHA"
test "$(git rev-parse HEAD)" = "$GITHUB_SHA"
pr=$(gh api "$repo/commits/$GITHUB_SHA/pulls?per_page=100" |
  jq -ce --arg repo "$GITHUB_REPOSITORY" --arg sha "$GITHUB_SHA" '
    map(select(.merged_at != null and .merge_commit_sha == $sha and
      .head.repo.full_name == $repo and .base.repo.full_name == $repo and
      .base.ref == "main" and .user.login == "github-actions[bot]")) |
    if length == 1 then first else error("Expected one merged official refresh PR") end')
branch=$(jq -er .head.ref <<<"$pr")
head_sha=$(jq -er .head.sha <<<"$pr")
number=$(jq -er .number <<<"$pr")
test "$(git log -1 --format=%s)" = "Automatic official data PR #$number"
gh api "$repo/pulls/$number" |
  jq -e --arg sha "$GITHUB_SHA" '.merged and .merge_commit_sha == $sha and .merged_by.login == "github-actions[bot]"' >/dev/null
test "$(git rev-parse 'HEAD^{tree}')" = "$(gh api "$repo/git/commits/$head_sha" --jq .tree.sha)"
python3 scripts/auto-official-policy.py HEAD^ HEAD "$branch"

run_id=$(gh api "$repo/actions/workflows/ci.yml/runs?head_sha=$head_sha&event=workflow_dispatch&per_page=100" |
  jq -er --arg branch "$branch" --arg head "$head_sha" --arg repo "$GITHUB_REPOSITORY" '
    [.workflow_runs[] | select(.head_branch == $branch and .head_sha == $head
      and .head_repository.full_name == $repo)] | max_by(.id) |
    select(.conclusion == "success") | .id')
gh api "$repo/actions/runs/$run_id/jobs?filter=latest&per_page=100" |
  jq -e '[.jobs[] | select(.conclusion == "success") | .name] as $passed |
    (["verify","high-risk-review","e2e"] - $passed | length) == 0' >/dev/null
echo "Validated PR #$(jq -r .number <<<"$pr") at $head_sha against CI run $run_id." >> "$GITHUB_STEP_SUMMARY"
