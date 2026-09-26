#!/usr/bin/env bash
set -euo pipefail
if (($# != 8)); then
  echo "Usage: package-trustee-fact-sheet-archive.sh ARTIFACT_DIR SOURCE_BATCH RUN_ID HEAD_SHA ARTIFACT_NAME CREATED_AT ARCHIVE_FILE INDEX_FILE" >&2
  exit 2
fi
artifact_dir=$1
source_batch=$2
source_run_id=$3
source_head_sha=$4
source_artifact_name=$5
archive_created_at=$6
archive_file=$7
index_file=$8

[[ "$source_batch" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "Invalid factsheet source batch date" >&2; exit 2; }
batch_year=$((10#${source_batch:0:4}))
batch_month=$((10#${source_batch:5:2}))
batch_day=$((10#${source_batch:8:2}))
((batch_year >= 1 && batch_month >= 1 && batch_month <= 12 && batch_day >= 1)) || { echo "Invalid factsheet source batch calendar date" >&2; exit 2; }
case "$batch_month" in
  1|3|5|7|8|10|12) max_batch_day=31 ;;
  4|6|9|11) max_batch_day=30 ;;
  2)
    max_batch_day=28
    if ((batch_year % 400 == 0 || (batch_year % 4 == 0 && batch_year % 100 != 0))); then
      max_batch_day=29
    fi
    ;;
esac
((batch_day <= max_batch_day)) || { echo "Invalid factsheet source batch calendar date" >&2; exit 2; }
[[ "$source_run_id" =~ ^[0-9]+$ ]] || { echo "Invalid source workflow run ID" >&2; exit 2; }
[[ "$source_head_sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid source workflow commit SHA" >&2; exit 2; }
[[ "$source_artifact_name" == "trustee-fact-sheets-"$source_batch"-"$source_run_id ]] || { echo "Unexpected trustee factsheet artifact name" >&2; exit 2; }
[[ -n "$source_created_at" ]] || { echo "Missing source workflow creation time" >&2; exit 2; }

source_manifest="$artifact_dir/manifest.json"
[[ -d "$artifact_dir" && -f "$source_manifest" && ! -L "$source_manifest" ]] || { echo "Trustee factsheet artifact is missing its manifest" >&2; exit 1; }
if find "$artifact_dir" -type l -print -quit | grep -q .; then
  echo "Trustee factsheet artifact contains a symbolic link" >&2
  exit 1
fi

jq -e --arg batch "$source_batch" --arg sha "$source_head_sha" 'type == "object" and .schemaVersion == 1 and .sourceBatch == $batch and .sourceCommitSha == $sha and .sourceLinkManifestPath == ("data/sources/" + $batch + "/trustee-fact-sheet-links.json") and (.sourceLinkManifestSha256 | type == "string" and test("^[a-f0-9]{64}$")) and (.entries | type == "array" and length > 0) and (.plannedCount == (.entries | length)) and (.downloadedCount | type == "number" and . >= 0) and (.failedCount | type == "number" and . >= 0) and (.downloadedCount + .failedCount == .plannedCount) and ([.entries[].id] | length == (unique | length))' "$source_manifest" >/dev/null || { echo "Trustee factsheet source manifest is invalid" >&2; exit 1; }

planned_count=$(jq -r '.plannedCount' "$source_manifest")
declared_downloaded=$(jq -r '.downloadedCount' "$source_manifest")
declared_failed=$(jq -r '.failedCount' "$source_manifest")
downloaded_count=0
failed_count=0

while IFS= read -r entry; do
  source_id=$(jq -r '.id // empty' <<<"$entry")
  scheme=$(jq -r '.scheme // empty' <<<"$entry")
  constituent_fund=$(jq -r '.constituentFund // empty' <<<"$entry")
  source_file=$(jq -r '.sourceFile // empty' <<<"$entry")
  source_url=$(jq -r '.factSheetUrl // empty' <<<"$entry")
  relative_path=$(jq -r '.file // empty' <<<"$entry")
  status=$(jq -r '.status // empty' <<<"$entry")
  expected_bytes=$(jq -r '.bytes // empty' <<<"$entry")
  expected_sha=$(jq -r '.sha256 // empty' <<<"$entry")
  error_message=$(jq -r '.error // empty' <<<"$entry")

  [[ "$source_id" =~ ^[a-f0-9]{64}$ && -n "$scheme" ]] || { echo "Trustee factsheet manifest contains an invalid source identity" >&2; exit 1; }
  [[ "$source_file" != */* && "$source_file" != *\\* && "$source_file" == *.pdf ]] || { echo "Trustee factsheet manifest contains an invalid source filename" >&2; exit 1; }
  [[ "$source_url" == https://* ]] || { echo "Trustee factsheet manifest contains a non-HTTPS source URL" >&2; exit 1; }
  expected_id=$(printf '%s\0%s\0%s' "$scheme" "$constituent_fund" "$source_file" | sha256sum | cut -d' ' -f1)
  [[ "$source_id" == "$expected_id" && "$relative_path" == "pdf/"$source_id".pdf" ]] || { echo "Trustee factsheet source path does not match its deterministic identity" >&2; exit 1; }
  source_path="$artifact_dir/$relative_path"

  case "$status" in
    downloaded)
      [[ "$expected_bytes" =~ ^[0-9]+$ && "$expected_bytes" -gt 0 ]] || { echo "Downloaded factsheet has an invalid byte count" >&2; exit 1; }
      [[ "$expected_sha" =~ ^[a-f0-9]{64}$ && -z "$error_message" ]] || { echo "Downloaded factsheet has invalid checksum metadata" >&2; exit 1; }
      [[ -f "$source_path" && ! -L "$source_path" ]] || { echo "A downloaded factsheet is missing from the artifact" >&2; exit 1; }
      actual_bytes=$(wc -c <"$source_path" | tr -d '[:space:]')
      actual_sha=$(sha256sum "$source_path" | cut -d' ' -f1)
      [[ "$actual_bytes" == "$expected_bytes" && "$actual_sha" == "$expected_sha" ]] || { echo "A trustee factsheet failed its byte count or SHA-256 check" >&2; exit 1; }
      [[ "$(head -c 5 "$source_path")" == "%PDF-" ]] || { echo "A downloaded source does not contain a PDF signature" >&2; exit 1; }
      downloaded_count=$((downloaded_count + 1))
      ;;
    failed)
      [[ "$expected_bytes" == "0" && -n "$error_message" && -z "$expected_sha" ]] || { echo "Failed factsheet entry contains inconsistent download metadata" >&2; exit 1; }
      [[ ! -e "$source_path" && ! -L "$source_path" ]] || { echo "A failed factsheet entry unexpectedly has a file" >&2; exit 1; }
      failed_count=$((failed_count + 1))
      ;;
    *)
      echo "Trustee factsheet manifest contains an unknown download status" >&2
      exit 1
      ;;
  esac
done < <(jq -c '.entries[]' "$source_manifest")

[[ "$downloaded_count" -gt 0 ]] || { echo "No trustee factsheet PDF was available to archive" >&2; exit 1; }
[[ "$downloaded_count" == "$declared_downloaded" && "$failed_count" == "$declared_failed" ]] || { echo "Trustee factsheet manifest counts do not match its entries" >&2; exit 1; }
actual_files=$(find "$artifact_dir" -type f | wc -l | tr -d '[:space:]')
expected_files=$((downloaded_count + 1))
[[ "$actual_files" == "$expected_files" ]] || { echo "Trustee factsheet artifact contains files absent from its manifest" >&2; exit 1; }
shopt -s nullglob
for entry in "$artifact_dir"/*; do
  [[ "$(basename "$entry")" == "manifest.json" || "$(basename "$entry")" == "pdf" ]] || { echo "Trustee factsheet artifact contains an unexpected top-level path" >&2; exit 1; }
done

mkdir -p "$(dirname "$archive_file")" "$(dirname "$index_file")"
tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner --format=gnu -C "$artifact_dir" -cf - manifest.json pdf | gzip -n >"$archive_file"

archive_bytes=$(wc -c <"$archive_file" | tr -d '[:space:]')
archive_sha=$(sha256sum "$archive_file" | cut -d' ' -f1)
source_manifest_sha=$(sha256sum "$source_manifest" | cut -d' ' -f1)
object_prefix="source-archives/trustee-fact-sheets/$source_batch/run-$source_run_id"
archive_key="$object_prefix/trustee-fact-sheets.tar.gz"
source_link_path=$(jq -r '.sourceLinkManifestPath' "$source_manifest")
source_link_sha=$(jq -r '.sourceLinkManifestSha256' "$source_manifest")

jq -n --arg sourceWorkflow "Archive trustee fact sheets" --arg sourceRunId "$source_run_id" --arg archiveCreatedAt "$archive_created_at" --arg sourceHeadSha "$source_head_sha" --arg sourceArtifactName "$source_artifact_name" --arg sourceBatch "$source_batch" --arg sourceLinkManifestPath "$source_link_path" --arg sourceLinkManifestSha256 "$source_link_sha" --arg sourceManifestSha256 "$source_manifest_sha" --arg sourceManifestPath "manifest.json" --arg objectPrefix "$object_prefix" --arg archiveKey "$archive_key" --arg archiveSha256 "$archive_sha" --argjson archiveBytes "$archive_bytes" --argjson plannedCount "$planned_count" --argjson downloadedCount "$downloaded_count" --argjson failedCount "$failed_count" '{
  schemaVersion: 1,
  sourceType: "trustee_factsheet_pdf",
  sourceWorkflow: $sourceWorkflow,
  sourceRunId: $sourceRunId,
  archiveCreatedAt: $archiveCreatedAt,
  sourceHeadSha: $sourceHeadSha,
  sourceArtifactName: $sourceArtifactName,
  sourceBatch: $sourceBatch,
  sourceLinkManifest: {path: $sourceLinkManifestPath, sha256: $sourceLinkManifestSha256},
  sourceManifest: {path: $sourceManifestPath, sha256: $sourceManifestSha256},
  counts: {planned: $plannedCount, downloaded: $downloadedCount, failed: $failedCount},
  objectPrefix: $objectPrefix,
  archive: {key: $archiveKey, bytes: $archiveBytes, sha256: $archiveSha256, contentType: "application/gzip"}
}' >"$index_file"

echo "Prepared trustee factsheet batch $source_batch: $downloaded_count/$planned_count PDFs, $failed_count failures, $archive_bytes compressed bytes."
