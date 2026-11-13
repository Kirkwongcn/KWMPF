#!/usr/bin/env bash
set -euo pipefail

repo="repos/$GITHUB_REPOSITORY"
[[ "${OFFICIAL_DATA_APP_LOGIN:?Missing official data App identity}" =~ ^[a-z0-9][a-z0-9-]*\[bot\]$ ]]
[[ "$OFFICIAL_DATA_APP_LOGIN" != 'github-actions[bot]' ]]
test "$GITHUB_REF" = refs/heads/main
test "$(gh api "$repo/git/ref/heads/main" --jq .object.sha)" = "$GITHUB_SHA"
test "$(git rev-parse HEAD)" = "$GITHUB_SHA"
pr=$(gh api "$repo/commits/$GITHUB_SHA/pulls?per_page=100" |
  jq -ce --arg repo "$GITHUB_REPOSITORY" --arg sha "$GITHUB_SHA" --arg author "$OFFICIAL_DATA_APP_LOGIN" '
    map(select(.merged_at != null and .merge_commit_sha == $sha and
      .head.repo.full_name == $repo and .base.repo.full_name == $repo and
      .base.ref == "main" and .user.type == "Bot" and .user.login == $author)) |
    if length == 1 then first else error("Expected one merged official refresh PR") end')
branch=$(jq -er .head.ref <<<"$pr")
head_sha=$(jq -er .head.sha <<<"$pr")
number=$(jq -er .number <<<"$pr")
base_sha=$(git rev-parse HEAD^)
test "$(git log -1 --format=%s)" = "Automatic official data PR #$number"
gh api "$repo/pulls/$number" |
  jq -e --arg sha "$GITHUB_SHA" '.merged and .merge_commit_sha == $sha and .merged_by.login == "github-actions[bot]"' >/dev/null
test "$(git rev-parse 'HEAD^{tree}')" = "$(gh api "$repo/git/commits/$head_sha" --jq .tree.sha)"
python3 scripts/auto-official-policy.py HEAD^ HEAD "$branch"

python3 scripts/auto-official-reconcile.py verify-ci "$number" "$branch" "$head_sha" "$base_sha"
echo "Validated PR #$number at $head_sha against its protected main base $base_sha." >> "$GITHUB_STEP_SUMMARY"
