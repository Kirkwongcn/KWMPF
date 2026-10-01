#!/usr/bin/env bash

set -euo pipefail

root=$(mktemp -d)
empty=$(mktemp -d)
trap 'rm -rf "$root" "$empty"' EXIT

echo '{}' >"$root/2026-08-13-official-return-observations-partial.json"
echo '{}' >"$root/2026-09-27-official-return-observations-candidate.json"
echo '{}' >"$root/2026-09-27-official-return-observations-report.json"
echo '{}' >"$root/current.json"

resolved=$(scripts/resolve-latest-return-candidate.sh "$root")
if [ "$resolved" != "$root/2026-09-27-official-return-observations-candidate.json" ]; then
  echo "only dated candidate overlays may be chosen, got ${resolved}" >&2
  exit 1
fi

echo '{}' >"$root/2026-09-30-official-return-observations-candidate.json"
resolved=$(scripts/resolve-latest-return-candidate.sh "$root")
if [ "$resolved" != "$root/2026-09-30-official-return-observations-candidate.json" ]; then
  echo "the newest candidate overlay must win, got ${resolved}" >&2
  exit 1
fi

: >"$root/2026-10-01-official-return-observations-candidate.json"
if scripts/resolve-latest-return-candidate.sh "$root" 2>/dev/null; then
  echo "an empty newest candidate overlay must fail loudly" >&2
  exit 1
fi

if scripts/resolve-latest-return-candidate.sh "$empty" 2>/dev/null; then
  echo "a tree with no candidate overlay must fail loudly" >&2
  exit 1
fi

if scripts/resolve-latest-return-candidate.sh "$root/does-not-exist" 2>/dev/null; then
  echo "a missing coverage directory must fail loudly" >&2
  exit 1
fi
