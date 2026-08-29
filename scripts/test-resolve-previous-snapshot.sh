#!/usr/bin/env bash

set -euo pipefail

root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT

mkdir -p "$root/2026-08-13" "$root/2026-08-28" "$root/lipper"
echo '{}' >"$root/2026-08-13/mpf-fund-platform.json"
echo '[]' >"$root/2026-08-28/fund-fact-sheet-links.json"
echo '{}' >"$root/lipper/notes.json"

resolved=$(scripts/resolve-previous-snapshot.sh "$root")
if [ "$resolved" != "$root/2026-08-13/mpf-fund-platform.json" ]; then
  echo "a date directory without a platform snapshot must be skipped, got ${resolved}" >&2
  exit 1
fi

mkdir -p "$root/2026-09-01"
echo '{}' >"$root/2026-09-01/mpf-fund-platform.json"

resolved=$(scripts/resolve-previous-snapshot.sh "$root")
if [ "$resolved" != "$root/2026-09-01/mpf-fund-platform.json" ]; then
  echo "the newest platform snapshot must win, got ${resolved}" >&2
  exit 1
fi

empty=$(mktemp -d)
trap 'rm -rf "$root" "$empty"' EXIT
mkdir -p "$empty/lipper"

if scripts/resolve-previous-snapshot.sh "$empty" 2>/dev/null; then
  echo "a tree with no platform snapshot must fail loudly" >&2
  exit 1
fi

if scripts/resolve-previous-snapshot.sh "$root/does-not-exist" 2>/dev/null; then
  echo "a missing sources directory must fail loudly" >&2
  exit 1
fi
