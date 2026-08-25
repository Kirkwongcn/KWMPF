#!/usr/bin/env bash
# Serve the Worker locally against a throwaway D1 seeded with the published
# snapshot, so end-to-end tests exercise real data instead of fixtures.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
state="${KWMPF_E2E_STATE:-$root/apps/e2e/.e2e-state}"
source_snapshot="${KWMPF_E2E_SOURCE:-$root/data/sources/2026-08-13/mpf-fund-platform.json}"
port="${KWMPF_E2E_API_PORT:-8799}"

export WRANGLER_SEND_METRICS=false

rm -rf "$state"
mkdir -p "$state"

bun "$root/packages/coverage/src/build-staging-seed.ts" \
  --source "$source_snapshot" \
  --output "$state/seed.sql"

cd "$root/apps/api"
bunx wrangler d1 migrations apply kwmpf-staging --local --persist-to "$state/d1"
bunx wrangler d1 execute kwmpf-staging --local --persist-to "$state/d1" --file "$state/seed.sql"
exec bunx wrangler dev --local --persist-to "$state/d1" --port "$port"
