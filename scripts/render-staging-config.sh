#!/usr/bin/env bash

set -euo pipefail

database_id="${1:-}"
output="${2:-}"
placeholder="00000000-0000-0000-0000-000000000000"
source_config="apps/api/wrangler.jsonc"

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

sed "s/$placeholder/$database_id/" "$source_config" > "$output"
