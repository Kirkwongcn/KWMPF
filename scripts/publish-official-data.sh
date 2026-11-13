#!/usr/bin/env bash
set -euo pipefail

root=$(git rev-parse --show-toplevel)
cd "$root"
state="${RUNNER_TEMP:?}/kwmpf-official-publish"
mkdir -p "$state"
db=kwmpf-production
bucket=kwmpf-production-raw
api="${PUBLIC_API:-https://kwmpf-api-production.kw-screener.workers.dev}"

wrangler() {
  (cd apps/api && bash ../../scripts/run-wrangler-redacted.sh bunx --no-install wrangler "$@" --config wrangler.production.json)
}

archive() {
  local key="$1" file="$2" mime="$3"
  wrangler r2 object put "$bucket/$key" --remote --file "$file" --content-type "$mime"
  wrangler r2 object get "$bucket/$key" --remote --file "$state/object-readback"
  cmp "$file" "$state/object-readback"
}

public_check() {
  local expected="$1" snapshot fund_id period seed='-'
  snapshot=$(jq -er .snapshot "$expected")
  fund_id=$(jq -er '.sample.id | select(test("^mpfa-cf-[0-9]+$"))' "$expected")
  if [[ "$snapshot" != "$(jq -er .snapshot "$state/before.json")" ]]; then
    seed="$state/seed.sql"
  fi
  for attempt in 1 2 3 4 5; do
    if curl -fsS --max-time 20 "$api/summary" -o "$state/summary.json" &&
       jq -e --slurpfile x "$expected" '.snapshotId == $x[0].snapshot and .fundClassCount == $x[0].fundCount' "$state/summary.json" >/dev/null &&
       curl -fsS --max-time 20 "$api/fund-classes/$fund_id" -o "$state/sample.json" &&
       jq -e --slurpfile x "$expected" '.snapshotId == $x[0].snapshot and .fundClass == $x[0].sample' "$state/sample.json" >/dev/null; then
      local matched=true
      for period in 1 3 5 10; do
        if ! bun scripts/publish-official-rankings.mjs "$state/before.sql" "$seed" "$period" > "$state/expected-rankings.json" ||
           ! curl -fsS --max-time 20 "$api/rankings?metric=return&period=$period" -o "$state/rankings.json" ||
           ! jq -e --slurpfile expected "$state/expected-rankings.json" --arg period "$period" '
             def ordered: .rankings |= sort_by(.comparisonGroup, .rank, .fundClassId);
             (ordered == ($expected[0] | ordered)) and ($period != "3" or (.rankings | length) > 0)
           ' "$state/rankings.json" >/dev/null; then
          matched=false
          break
        fi
      done
      if [[ "$matched" == true ]]; then return 0; fi
    fi
    sleep 3
  done
  echo "Public API does not serve the expected snapshot, counts, sample and ranking." >&2
  return 1
}

build_seed() {
  bun run --filter @kwmpf/coverage publication-seed -- --source "$1" --return-observations "$2" --snapshot "$3" --output "$4"
}

compatible_worker() {
  local worker
  worker=$(curl -fsS --retry 3 --max-time 20 "$api/health" |
    jq -er 'select(.status == "ok" and .bindings.d1 and .bindings.r2) | .version | select(test("^[a-f0-9]{40}$"))')
  git merge-base --is-ancestor "$worker" HEAD
  git diff --quiet "$worker" HEAD -- apps/api/src apps/api/migrations apps/api/wrangler.jsonc apps/api/package.json bun.lock \
    packages/coverage/src/{mpfa-fund-type,fund-interpretation,interpretation-thresholds,comparison-group-stats,fact-sheet-temporal}.ts
  printf '%s\n' "$worker" > "$state/worker"
}

prepare() {
  local source overlay date snapshot parent_source parent_overlay
  source=$(bash scripts/resolve-previous-snapshot.sh)
  overlay=$(bash scripts/resolve-latest-return-candidate.sh)
  bun scripts/check-production-source-review.mjs "${source#data/sources/}" false
  date=$(jq -er .sourceDataAsOf "$source")
  snapshot="snapshot-mpfa-platform-$date-${GITHUB_SHA:0:12}"
  build_seed "$root/$source" "$root/$overlay" "$snapshot" "$state/seed.sql"
  # Admission permits changes only to the generated platform or return candidate
  # and its report. The seed generator and other datasource files are identical.
  git ls-tree -r --name-only HEAD^ -- data > "$state/parent-paths"
  parent_source=$(grep -E '^data/sources/[0-9]{4}-[0-9]{2}-[0-9]{2}/mpf-fund-platform\.json$' "$state/parent-paths" | LC_ALL=C sort | tail -1)
  parent_overlay=$(grep -E '^data/coverage/[0-9]{4}-[0-9]{2}-[0-9]{2}-official-return-observations-candidate\.json$' "$state/parent-paths" | LC_ALL=C sort | tail -1)
  git show "HEAD^:$parent_source" > "$state/parent-platform.json"
  git show "HEAD^:$parent_overlay" > "$state/parent-overlay.json"
  build_seed "$state/parent-platform.json" "$state/parent-overlay.json" "$snapshot" "$state/parent.sql"
  printf '%s\n' "$source" > "$state/source-path"
  printf '%s\n' "$overlay" > "$state/overlay-path"
}

baseline() {
  # Read-only acceptance against today's main. All rehearsal SQL stays in memory.
  local source overlay source_as_of
  source=$(bash scripts/resolve-previous-snapshot.sh)
  overlay=$(bash scripts/resolve-latest-return-candidate.sh)
  source_as_of=$(jq -er .sourceDataAsOf "$source")
  bun scripts/check-production-source-review.mjs "${source#data/sources/}" false
  build_seed "$root/$source" "$root/$overlay" "snapshot-mpfa-platform-$source_as_of-${GITHUB_SHA:0:12}" "$state/seed.sql"
  cp "$state/seed.sql" "$state/parent.sql"
  bash scripts/render-worker-config.sh production "$D1_DATABASE_ID" apps/api/wrangler.production.json
  compatible_worker
  wrangler d1 export "$db" --remote --skip-confirmation --output "$state/before.sql"
  python3 scripts/publish-official-check.py "$state" compare
  cmp "$state/before.json" "$state/after.json"
  public_check "$state/before.json"
  echo "Main seed, live D1, public summary, sample and four ranking periods agree." >> "$GITHUB_STEP_SUMMARY"
}

backup() {
  local before after backup_id source overlay
  bash scripts/render-worker-config.sh production "$D1_DATABASE_ID" apps/api/wrangler.production.json
  compatible_worker
  wrangler d1 export "$db" --remote --skip-confirmation --output "$state/before.sql"
  python3 scripts/publish-official-check.py "$state" compare
  before=$(jq -er .digest "$state/before.json")
  after=$(jq -er .digest "$state/after.json")
  if [[ "$before" == "$after" ]]; then
    echo 'changed=false' >> "$GITHUB_OUTPUT"
    echo 'Exact dataset already live. Verifying public and database readback.' >> "$GITHUB_STEP_SUMMARY"
    return
  fi
  wrangler d1 time-travel info "$db" --json > "$state/time-travel.json"
  jq -er '.bookmark | select(type == "string" and length > 0)' "$state/time-travel.json" > "$state/bookmark"
  backup_id="d1-$(date -u +%Y-%m-%dT%H-%M-%SZ)-run-$GITHUB_RUN_ID"
  echo "$backup_id" > "$state/backup-id"
  jq -n --arg backupId "$backup_id" --arg db "$db" --arg commit "$GITHUB_SHA" \
    --arg id "$(jq -er .snapshot "$state/before.json")" --arg bookmark "$(cat "$state/bookmark")" \
    --arg sha "$(sha256sum "$state/before.sql" | cut -d' ' -f1)" --argjson bytes "$(wc -c < "$state/before.sql")" \
    '{backupId:$backupId,databaseName:$db,snapshotId:$id,commit:$commit,bookmark:$bookmark,files:[{key:"d1.sql",bytes:$bytes,sha256:$sha}]}' > "$state/backup-manifest.json"
  archive "backups/$backup_id/d1.sql" "$state/before.sql" application/sql
  archive "backups/$backup_id/manifest.json" "$state/backup-manifest.json" application/json
  echo "Previous D1 verified in backups/$backup_id. Bookmark $(cat "$state/bookmark")." >> "$GITHUB_STEP_SUMMARY"
  source=$(cat "$state/source-path")
  overlay=$(cat "$state/overlay-path")
  archive "candidates/$GITHUB_SHA/source.json" "$root/$source" application/json
  archive "candidates/$GITHUB_SHA/return-observations.json" "$root/$overlay" application/json
  echo 'changed=true' >> "$GITHUB_OUTPUT"
}

readback() {
  local output
  output=$(mktemp -d "$state/export.XXXXXX") || return 1
  wrangler d1 export "$db" --remote --skip-confirmation --output "$output/readback.sql" || return 1
  python3 scripts/publish-official-check.py "$state" "$1" "$output/readback.sql"
}

case "${1:-}" in
  baseline) baseline ;;
  prepare) prepare ;;
  backup) backup ;;
  apply)
    readback recover
    compatible_worker
    touch "$state/import-attempted"
    wrangler d1 execute "$db" --remote --file "$state/seed.sql" --yes
    ;;
  verify)
    readback verify
    public_check "$state/after.json"
    if [[ -e "$state/import-attempted" ]]; then
      source=$(cat "$state/source-path")
      overlay=$(cat "$state/overlay-path")
      jq -n --slurpfile before "$state/before.json" --slurpfile after "$state/after.json" \
        --arg commit "$GITHUB_SHA" --arg worker "$(cat "$state/worker")" --arg backup "$(cat "$state/backup-id")" \
        --arg source "$source" --arg overlay "$overlay" --arg sourceHash "$(sha256sum "$source" | cut -d' ' -f1)" \
        --arg overlayHash "$(sha256sum "$overlay" | cut -d' ' -f1)" --arg run "$GITHUB_RUN_ID" \
        '{schemaVersion:1,commit:$commit,workerVersion:$worker,runId:$run,backupId:$backup,
          source:{path:$source,sha256:$sourceHash},overlay:{path:$overlay,sha256:$overlayHash},
          before:($before[0]|del(.sample)),after:($after[0]|del(.sample))}' > "$state/receipt.json"
      archive "data-publications/run-$GITHUB_RUN_ID-attempt-$GITHUB_RUN_ATTEMPT/manifest.json" "$state/receipt.json" application/json
    fi
    echo "Verified production dataset $(jq -r '.snapshot + " / SHA-256 " + .digest' "$state/after.json")." >> "$GITHUB_STEP_SUMMARY"
    ;;
  recover)
    [[ -e "$state/import-attempted" ]] || exit 0
    if ! readback recover; then
      wrangler d1 time-travel restore "$db" --bookmark "$(cat "$state/bookmark")" --json > "$state/restore.json"
      readback recover
    fi
    public_check "$state/before.json"
    echo "Previous D1 dataset and public snapshot verified after failure." >> "$GITHUB_STEP_SUMMARY"
    ;;
  *) exit 2 ;;
esac
