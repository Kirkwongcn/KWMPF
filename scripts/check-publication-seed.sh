#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_relative="$(cd "$root" && bash scripts/resolve-previous-snapshot.sh data/sources)"
source_snapshot="${KWMPF_PUBLICATION_SEED_SOURCE:-$root/$source_relative}"
if [[ ! -f "$source_snapshot" ]]; then
  echo "Publication seed source does not exist: $source_snapshot" >&2
  exit 1
fi

# 冇明確指定 overlay（CI 只在 PR 改到候選 overlay 時先傳路徑）就用同正式部署一樣的
# 最新候選，唔可以落到 e2e-serve-api.sh 為 E2E 固定的舊 overlay。
return_observations="${KWMPF_PUBLICATION_SEED_RETURN_OBSERVATIONS:-}"
if [[ -z "$return_observations" ]]; then
  return_observations="$(cd "$root" && bash scripts/resolve-latest-return-candidate.sh data/coverage)"
fi
if [[ "$return_observations" != /* ]]; then
  return_observations="$root/$return_observations"
fi
if [[ ! -f "$return_observations" ]]; then
  echo "Publication seed return observations do not exist: $return_observations" >&2
  exit 1
fi

source_label="${source_snapshot#"$root/"}"
return_label="${return_observations#"$root/"}"
source_sha256="$(sha256sum "$source_snapshot" | cut -d' ' -f1)"
return_sha256="$(sha256sum "$return_observations" | cut -d' ' -f1)"
printf 'Publication seed inputs: source=%s sha256=%s returnObservations=%s sha256=%s\n' \
  "$source_label" "$source_sha256" "$return_label" "$return_sha256"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "Publication seed source: \`$source_label\` (SHA-256 \`$source_sha256\`)"
    echo "Publication seed trustee-return overlay: \`$return_label\` (SHA-256 \`$return_sha256\`)"
  } >>"$GITHUB_STEP_SUMMARY"
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
KWMPF_PUBLICATION_SEED_RETURN_OBSERVATIONS="$return_observations" \
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
fact_sheet_source="$(find "$root/data/sources" -mindepth 2 -maxdepth 2 -type f -name 'fund-fact-sheet-disclosures.json' -print | sort | tail -n 1)"
if [[ ! -f "$fact_sheet_source" ]]; then
  echo "The latest publication seed has no factsheet disclosure source." >&2
  exit 1
fi

checked_interpretations=0
while IFS= read -r fund_id; do
  disclosure="$(jq -ce --arg id "$fund_id" '[.funds[] | select(.fundClassIds | index($id))][0] // empty' "$fact_sheet_source" 2>/dev/null || true)"
  [[ -n "$disclosure" ]] || continue
  platform_record="$(jq -ce --arg id "$fund_id" '[.records[] | select(.fundClassId == $id)][0] // empty' "$source_snapshot")"
  published="$(curl --fail --silent --show-error "$api_url/fund-classes/$fund_id")"
  interpretation="$(curl --fail --silent --show-error "$api_url/fund-classes/$fund_id/interpretation")"

  if ! jq -e \
    --argjson disclosure "$disclosure" \
    --argjson platform "$platform_record" \
    --argjson published "$published" \
    '
      .provenance as $p
      | ($p.equity.fundSourceUrl == $disclosure.factSheetUrl)
        and ($p.equity.fundDocumentAsOf == $disclosure.factSheetAsOf)
        and ($p.equity.fundFieldAsOf == ($published.mappedAllocation.asOf // null))
        and ($p.top10Concentration.fundSourceUrl == $disclosure.factSheetUrl)
        and ($p.top10Concentration.fundDocumentAsOf == $disclosure.factSheetAsOf)
        and ($p.top10Concentration.fundFieldAsOf == (if $disclosure.temporalScopes.topHoldings.kind == "point-in-time" then $disclosure.temporalScopes.topHoldings.asOf else null end))
        and ($p.volatility3y.fundSourceUrl == $platform.sourceUrl)
        and ($p.volatility3y.fundFieldAsOf == $platform.dataAsOf)
        and ($p.equity.groupSourceLabel == "同組已核實基金便覽樣本（來源各異）")
        and ($p.top10Concentration.groupSourceLabel == "同組已核實基金便覽樣本（來源各異）")
        and ($p.volatility3y.groupSourceLabel == "積金局基金平台快照")
        and ([ $p.equity, $p.top10Concentration, $p.volatility3y ] | all(.[];
          (.groupSampleCount | type) == "number"
          and (.groupMemberCount | type) == "number"
          and .groupSampleCount <= .groupMemberCount
          and (.groupSampleDates | type) == "object"
          and (.groupSampleDates.undatedCount | type) == "number"
          and .groupSampleDates.undatedCount <= .groupSampleCount
        ))
    ' <<<"$interpretation" >/dev/null; then
    echo "Interpretation provenance does not match the published payload or source files for $fund_id." >&2
    jq '{provenance}' <<<"$interpretation" >&2
    exit 1
  fi

  printf 'Interpretation provenance passed: fund=%s platformAsOf=%s factsheetAsOf=%s\n' \
    "$fund_id" \
    "$(jq -r '.dataAsOf' <<<"$platform_record")" \
    "$(jq -r '.factSheetAsOf' <<<"$disclosure")"
  checked_interpretations=$((checked_interpretations + 1))
  if ((checked_interpretations == 3)); then
    break
  fi
done < <(jq -r '.rankings[].fundClassId' <<<"$response")

if ((checked_interpretations < 3)); then
  echo "Expected 3 ranked funds with factsheets for interpretation provenance checks; found $checked_interpretations." >&2
  exit 1
fi

printf 'Publication seed passed: source=%s returnObservations=%s dataAsOf=%s rankingRows=%s excludedStaleCount=%s\n' \
  "$source_label" "$return_label" "$source_as_of" "$ranking_count" "$excluded_count"
