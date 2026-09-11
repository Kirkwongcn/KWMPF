#!/usr/bin/env bash

set -euo pipefail

root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT

body_ok="$root/body-ok.md"
body_partial="$root/body-partial.md"
body_empty="$root/body-empty.md"
body_no_evidence="$root/body-no-evidence.md"

cat >"$body_ok" <<'MARKDOWN'
## 覆核
- [x] high-risk: code-review
- [x] high-risk: publication-seed
code-review evidence: Standards 零發現；Spec 零發現，已覆核全部差異。
publication-seed evidence: rankings 447 筆；三筆已逐項對照官方來源。
MARKDOWN

cat >"$body_partial" <<'MARKDOWN'
- [x] high-risk: code-review
- [ ] high-risk: publication-seed
MARKDOWN

printf '一般 PR 描述，冇勾任何嘢。\n' >"$body_empty"
cat >"$body_no_evidence" <<'MARKDOWN'
- [x] high-risk: code-review
- [x] high-risk: publication-seed
MARKDOWN

low_risk="$root/low-risk.txt"
printf 'apps/web/src/pages/Home.tsx\ndocs/agents/change-policy.md\n' >"$low_risk"

high_risk="$root/high-risk.txt"
printf 'apps/web/src/pages/Home.tsx\npackages/coverage/src/fact-sheet-allocation.ts\n' >"$high_risk"

reference_only="$root/reference-only.txt"
printf 'data/reference/allocation-label-map.json\n' >"$reference_only"

if ! scripts/check-high-risk-review.sh "$low_risk" "$body_empty" >/dev/null; then
  echo "純 UI／文件改動不可以要求覆核憑證" >&2
  exit 1
fi

if scripts/check-high-risk-review.sh "$high_risk" "$body_empty" >/dev/null 2>&1; then
  echo "改到高危路徑而冇勾憑證，必須失敗" >&2
  exit 1
fi

if scripts/check-high-risk-review.sh "$high_risk" "$body_partial" >/dev/null 2>&1; then
  echo "只勾一半憑證，必須失敗" >&2
  exit 1
fi

if scripts/check-high-risk-review.sh "$high_risk" "$body_no_evidence" >/dev/null 2>&1; then
  echo "淨係勾 checkbox 而冇實際結果，必須失敗" >&2
  exit 1
fi

if ! scripts/check-high-risk-review.sh "$high_risk" "$body_ok" >/dev/null; then
  echo "勾齊憑證應該通過" >&2
  exit 1
fi

if scripts/check-high-risk-review.sh "$reference_only" "$body_empty" >/dev/null 2>&1; then
  echo "data/reference 屬高危路徑，冇勾憑證必須失敗" >&2
  exit 1
fi

if ! scripts/check-high-risk-review.sh "$reference_only" "$body_ok" >/dev/null; then
  echo "data/reference 勾齊憑證應該通過" >&2
  exit 1
fi

if scripts/check-high-risk-review.sh "$high_risk" 2>/dev/null; then
  echo "缺少參數必須失敗" >&2
  exit 1
fi
