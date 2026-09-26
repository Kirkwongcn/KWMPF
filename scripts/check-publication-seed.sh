#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_relative="$(cd "$root" && bash scripts/resolve-previous-snapshot.sh data/sources)"
source_snapshot="${KWMPF_PUBLICATION_SEED_SOURCE:-$root/$source_relative}"
if [[ ! -f "$source_snapshot" ]]; then
  echo "Publication seed source does not exist: $source_snapshot" >&2
  exit 1
fi

source_as_of="$(jq -er '.sourceDataAsOf' "$source_snapshot")"
temporary_root="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
mkdir -p "$temporary_root"
state_dir="$(mktemp -d "$temporary_root/kwmpf-publication-seed.XXXXXX")"
log_file="$(mktemp "$temporary_root/kwmpf-publication-seed-log.XXXXXX")"
port="${KWMPF_PUBLICATION_SEED_PORT:-8799}"
api_url="http://127.0.0.1:$port"

cleanup() {
  status=$?
  trap - EXIT
  if [[ -n "${server_pid:-}" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  if ((status != 0)); then
    echo "Local publication-seed server log:" >&2
    cat "$log_file" >&2 || true
  fi
  rm -rf -- "$state_dir"
  rm -f -- "$log_file"
  exit "$status"
}
trap cleanup EXIT

KWMPF_E2E_SOURCE="$source_snapshot" \
KWMPF_E2E_STATE="$state_dir" \
KWMPF_E2E_API_PORT="$port" \
WRANGLER_SEND_METRICS=false \
  bash "$root/scripts/e2e-serve-api.sh" >"$log_file" 2>&1 &
server_pid=$!

ready=false
for ((attempt = 0; attempt < 180; attempt += 1)); do
  if curl --fail --silent "$api_url/health" >/dev/null; then
    ready=true
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    break
  fi
  sleep 1
done

if [[ "$ready" != true ]]; then
  echo "Local API did not become healthy for publication-seed." >&2
  exit 1
fi

response="$(curl --fail --silent --show-error "$api_url/rankings?metric=return&period=3")"
ranking_count="$(jq -er '.rankings | length' <<<"$response")"
if ((ranking_count == 0)); then
  echo "The latest publication seed returned an empty three-year ranking." >&2
  jq '{rankings: (.rankings | length), excludedStaleCount}' <<<"$response" >&2
  exit 1
fi

excluded_count="$(jq -r '.excludedStaleCount // "unknown"' <<<"$response")"
printf 'Publication seed passed: source=%s dataAsOf=%s rankingRows=%s excludedStaleCount=%s\n' \
  "$source_relative" "$source_as_of" "$ranking_count" "$excluded_count"
