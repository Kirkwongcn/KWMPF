#!/usr/bin/env bash

set -euo pipefail

environment="${1:-}"
database_id="${2:-}"
output="${3:-}"
placeholder="00000000-0000-0000-0000-000000000000"
source_config="apps/api/wrangler.jsonc"

case "$environment" in
staging | production) ;;
*)
  echo "environment must be staging or production" >&2
  exit 1
  ;;
esac

if [[ ! "$database_id" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
  echo "D1 database ID must be a UUID" >&2
  exit 1
fi

if [[ -z "$output" ]]; then
  echo "output path is required" >&2
  exit 1
fi

if [[ "$(grep -Fc "$placeholder" "$source_config")" -ne 1 ]]; then
  echo "Wrangler config must contain exactly one D1 placeholder" >&2
  exit 1
fi

rendered=$(sed "s/$placeholder/$database_id/" "$source_config")

if [[ "$environment" == "production" ]]; then
  rendered=$(sed \
    -e 's/"kwmpf-api"/"kwmpf-api-production"/' \
    -e 's/kwmpf-staging-raw/kwmpf-production-raw/' \
    -e 's/kwmpf-staging/kwmpf-production/' \
    <<<"$rendered")
fi

printf '%s\n' "$rendered" >"$output"
