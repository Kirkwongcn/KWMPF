#!/usr/bin/env bash
set -euo pipefail

base_sha="${1:?usage: check-pr-composition.sh BASE_SHA HEAD_SHA}"
head_sha="${2:?usage: check-pr-composition.sh BASE_SHA HEAD_SHA}"

mapfile -t changed < <(git diff --name-only "$base_sha" "$head_sha")
has_data=false
has_code=false
for path in "${changed[@]}"; do
  [[ "$path" == data/* ]] && has_data=true
  [[ "$path" == packages/* || "$path" == apps/* ]] && has_code=true
done

if [[ "$has_data" != true || "$has_code" != true ]]; then
  exit 0
fi

data_additions="$(git diff --numstat "$base_sha" "$head_sha" -- data/ | awk '$1 ~ /^[0-9]+$/ { total += $1 } END { print total + 0 }')"
if (( data_additions > 1000 )); then
  echo "PR mixes $data_additions added data lines with application code; split it into separate PRs." >&2
  exit 1
fi

while read -r commit; do
  [[ -z "$commit" ]] && continue
  mapfile -t paths < <(git diff-tree --no-commit-id --name-only -r "$commit")
  commit_data=false
  commit_code=false
  for path in "${paths[@]}"; do
    [[ "$path" == data/* ]] && commit_data=true
    [[ "$path" == packages/* || "$path" == apps/* ]] && commit_code=true
  done
  if [[ "$commit_data" == true && "$commit_code" == true ]]; then
    echo "Commit $commit mixes data/ with packages/ or apps/; separate the changes into commits." >&2
    exit 1
  fi
done < <(git rev-list --reverse "$base_sha..$head_sha")
