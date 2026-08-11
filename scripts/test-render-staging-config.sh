#!/usr/bin/env bash

set -euo pipefail

output=$(mktemp)
trap 'rm -f "$output"' EXIT

database_id="12345678-1234-1234-1234-123456789abc"
scripts/render-staging-config.sh "$database_id" "$output"

grep -Fq '"database_id": "12345678-1234-1234-1234-123456789abc"' "$output"
if grep -Fq '00000000-0000-0000-0000-000000000000' "$output"; then
  echo "staging config still contains the placeholder database ID" >&2
  exit 1
fi
