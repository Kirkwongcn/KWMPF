#!/usr/bin/env bash

set -euo pipefail

output=$(mktemp)
trap 'rm -f "$output"' EXIT

database_id="12345678-1234-1234-1234-123456789abc"

scripts/render-worker-config.sh staging "$database_id" "$output"

grep -Fq '"database_id": "12345678-1234-1234-1234-123456789abc"' "$output"
grep -Fq '"database_name": "kwmpf-staging"' "$output"
grep -Fq '"bucket_name": "kwmpf-staging-raw"' "$output"
grep -Fq '"name": "kwmpf-api"' "$output"
if grep -Fq '00000000-0000-0000-0000-000000000000' "$output"; then
  echo "staging config still contains the placeholder database ID" >&2
  exit 1
fi

scripts/render-worker-config.sh production "$database_id" "$output"

grep -Fq '"database_id": "12345678-1234-1234-1234-123456789abc"' "$output"
grep -Fq '"database_name": "kwmpf-production"' "$output"
grep -Fq '"bucket_name": "kwmpf-production-raw"' "$output"
grep -Fq '"name": "kwmpf-api-production"' "$output"
if grep -Fq 'staging' "$output"; then
  echo "production config still references staging resources" >&2
  exit 1
fi

if scripts/render-worker-config.sh sandbox "$database_id" "$output" 2>/dev/null; then
  echo "an unknown environment must be rejected" >&2
  exit 1
fi

if scripts/render-worker-config.sh production "not-a-uuid" "$output" 2>/dev/null; then
  echo "a malformed database ID must be rejected" >&2
  exit 1
fi

if scripts/render-worker-config.sh production "$database_id" "" 2>/dev/null; then
  echo "a missing output path must be rejected" >&2
  exit 1
fi
