#!/usr/bin/env bash

set -euo pipefail

# 印出最新一份受託人回報候選 overlay 的路徑。
# 揀法同 deploy-production.yml／deploy-staging.yml 的
# 「Resolve the latest trustee-return candidate」步驟一致：
# 日期開頭的 *-official-return-observations-candidate.json，按 C locale 排序取最後一個，
# 檔案必須非空。CI 的 publication-seed 用同一個定義，避免同正式發布用不同 overlay
# （見 docs/agents/change-policy.md）。

coverage_root="${1:-data/coverage}"

if [ ! -d "$coverage_root" ]; then
  echo "找不到 coverage 目錄 ${coverage_root}。" >&2
  exit 1
fi

shopt -s nullglob
candidates=("$coverage_root"/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-official-return-observations-candidate.json)
if ((${#candidates[@]} == 0)); then
  echo "${coverage_root} 之下沒有受託人回報候選 overlay。" >&2
  exit 1
fi

path="$(printf '%s\n' "${candidates[@]}" | LC_ALL=C sort | tail -n 1)"
if [ ! -s "$path" ]; then
  echo "最新的受託人回報候選 overlay 是空檔：${path}" >&2
  exit 1
fi
printf '%s\n' "$path"
