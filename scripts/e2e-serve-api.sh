#!/usr/bin/env bash
# Serve the Worker locally against a throwaway D1 seeded with the published
# snapshot, so end-to-end tests exercise real data instead of fixtures.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
state="${KWMPF_E2E_STATE:-$root/apps/e2e/.e2e-state}"
source_snapshot="${KWMPF_E2E_SOURCE:-$root/data/sources/2026-08-13/mpf-fund-platform.json}"
return_observations="${KWMPF_PUBLICATION_SEED_RETURN_OBSERVATIONS:-${KWMPF_E2E_RETURN_OBSERVATIONS:-$root/data/coverage/2026-08-13-official-return-observations-partial.json}}"
port="${KWMPF_E2E_API_PORT:-8799}"

export WRANGLER_SEND_METRICS=false

rm -rf "$state"
mkdir -p "$state"
if [[ ! -f "$return_observations" ]]; then
  echo "Publication return observations do not exist: $return_observations" >&2
  exit 1
fi

seed_args=(--source "$source_snapshot" --output "$state/seed.sql" --return-observations "$return_observations")
bun "$root/packages/coverage/src/build-staging-seed.ts" "${seed_args[@]}"

cd "$root/apps/api"
bun x wrangler d1 migrations apply kwmpf-staging --local --persist-to "$state/d1"
bun x wrangler d1 execute kwmpf-staging --local --persist-to "$state/d1" --file "$state/seed.sql"
exec bun x wrangler dev --local --persist-to "$state/d1" --ip 127.0.0.1 --port "$port"
