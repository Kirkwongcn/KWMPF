#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git -C "$tmp" init -q
git -C "$tmp" config user.email test@example.com
git -C "$tmp" config user.name test
mkdir -p "$tmp/data" "$tmp/apps/web"
printf 'base\n' >"$tmp/README.md"
git -C "$tmp" add .
git -C "$tmp" commit -qm base
base="$(git -C "$tmp" rev-parse HEAD)"

printf 'source\n' >"$tmp/data/source.json"
git -C "$tmp" add .
git -C "$tmp" commit -qm data
printf 'code\n' >"$tmp/apps/web/app.ts"
git -C "$tmp" add .
git -C "$tmp" commit -qm code
(cd "$tmp" && "$root/scripts/check-pr-composition.sh" "$base" HEAD)

printf 'mixed\n' >>"$tmp/data/source.json"
printf 'mixed\n' >>"$tmp/apps/web/app.ts"
git -C "$tmp" add .
git -C "$tmp" commit -qm mixed
if (cd "$tmp" && "$root/scripts/check-pr-composition.sh" "$base" HEAD >/dev/null 2>&1); then
  echo "mixed data/code commit unexpectedly passed" >&2
  exit 1
fi
