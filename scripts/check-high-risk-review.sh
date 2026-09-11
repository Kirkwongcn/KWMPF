#!/usr/bin/env bash

set -euo pipefail

# 用法：scripts/check-high-risk-review.sh <改動檔案清單> <PR 描述檔>
#
# 這個專案最大的風險是靜默改寫官方數字，而 typecheck／test／build 全綠一樣過。
# 所以凡是改到 scripts/high-risk-paths.txt 列出的路徑，PR 描述必須勾齊兩項憑證：
#
#   - [x] high-risk: code-review
#   - [x] high-risk: publication-seed
#
# 描述亦要保留實際結果，避免淨係剔 checkbox 而冇可覆核憑證。
# 純 UI／文件改動不受影響，不加摩擦。

changed_files="${1:-}"
pr_body="${2:-}"

if [ -z "$changed_files" ] || [ -z "$pr_body" ]; then
  echo "用法：scripts/check-high-risk-review.sh <改動檔案清單> <PR 描述檔>" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
patterns_file="${KWMPF_HIGH_RISK_PATTERNS:-${script_dir}/high-risk-paths.txt}"

if [ ! -f "$patterns_file" ]; then
  echo "找不到高危路徑清單 ${patterns_file}。" >&2
  exit 2
fi

patterns=()
while IFS= read -r pattern; do
  case "$pattern" in
    '' | '#'*) continue ;;
  esac
  patterns+=("$pattern")
done <"$patterns_file"

matched=()
while IFS= read -r file; do
  [ -n "$file" ] || continue
  for pattern in "${patterns[@]}"; do
    # shellcheck disable=SC2254
    case "$file" in
      $pattern)
        matched+=("$file")
        break
        ;;
    esac
  done
done <"$changed_files"

if [ "${#matched[@]}" -eq 0 ]; then
  echo "沒有改到高危路徑，略過覆核憑證檢查。"
  exit 0
fi

echo "改到以下高危路徑："
printf '  %s\n' "${matched[@]}"

missing=()
for token in "code-review" "publication-seed"; do
  if ! grep -qiE "^[[:space:]]*[-*][[:space:]]*\[x\][[:space:]]*high-risk:[[:space:]]*${token}\b" "$pr_body"; then
    missing+=("$token")
  fi
done

for token in "code-review" "publication-seed"; do
  evidence="$(sed -nE "s/^[[:space:]]*${token}[[:space:]]+evidence:[[:space:]]*(.+)$/\\1/ip" "$pr_body" | head -n 1)"
  if [ "${#evidence}" -lt 20 ] || [[ "$evidence" == *"<!--"* ]]; then
    missing+=("${token} evidence")
  fi
done

if [ "${#missing[@]}" -eq 0 ]; then
  echo "PR 描述已勾齊高危覆核及實際結果。"
  exit 0
fi

echo "" >&2
echo "PR 描述未勾齊高危覆核憑證，欠：" >&2
printf '  - [ ] high-risk: %s\n' "${missing[@]}" >&2
echo "" >&2
echo "做法見 docs/agents/change-policy.md。勾之前要真係跑過，唔係補格式。" >&2
exit 1
