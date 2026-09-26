#!/usr/bin/env bash
set -euo pipefail

if (($# != 8)); then
  echo "Usage: package-source-snapshot-archive.sh ARTIFACT_DIR RUN_ID HEAD_SHA ARTIFACT_ID CREATED_AT CONCLUSION ARCHIVE_FILE INDEX_FILE" >&2
  exit 2
fi

artifact_dir=$1
source_run_id=$2
source_head_sha=$3
source_artifact_id=$4
source_created_at=$5
source_conclusion=$6
archive_file=$7
index_file=$8

[[ "$source_run_id" =~ ^[0-9]+$ ]] || { echo "Invalid source workflow run ID" >&2; exit 2; }
[[ "$source_artifact_id" =~ ^[0-9]+$ ]] || { echo "Invalid source artifact ID" >&2; exit 2; }
[[ "$source_head_sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid source workflow commit SHA" >&2; exit 2; }
[[ -n "$source_created_at" ]] || { echo "Missing source workflow creation time" >&2; exit 2; }

raw_root="$artifact_dir/$source_run_id"
source_manifest="$raw_root/manifest.json"
[[ -d "$raw_root" && -f "$source_manifest" && ! -L "$source_manifest" ]] || {
  echo "Source artifact does not contain the expected run manifest" >&2
  exit 1
}

jq -e --arg run_id "$source_run_id" '
  type == "object" and
  (.runId | tostring) == $run_id and
  (.artifacts | type == "array") and
  (.artifacts | length > 0)
' "$source_manifest" >/dev/null || {
  echo "Source run manifest is invalid or empty" >&2
  exit 1
}

if find "$raw_root" -type l -print -quit | grep -q .; then
  echo "Source artifact contains a symbolic link" >&2
  exit 1
fi

declared_files=0
artifact_count=0
while IFS= read -r entry; do
  artifact_count=$((artifact_count + 1))
  relative_path=$(jq -r '.path // empty' <<<"$entry")
  expected_bytes=$(jq -r '.bytes // empty' <<<"$entry")
  expected_sha=$(jq -r '.sha256 // empty' <<<"$entry")
  parse_status=$(jq -r '.parseStatus // empty' <<<"$entry")

  [[ "$relative_path" =~ ^(fund-information-table\.html|details/[0-9]+\.html)(\.attempt-[1-4](\.html|\.fetch-failed))?$ ]] || {
    echo "Source manifest contains an unexpected path" >&2
    exit 1
  }
  [[ "$expected_bytes" =~ ^[0-9]+$ ]] || {
    echo "Source manifest contains an invalid byte count" >&2
    exit 1
  }

  source_file="$raw_root/$relative_path"
  if [[ -n "$expected_sha" ]]; then
    [[ "$expected_sha" =~ ^[0-9a-f]{64}$ && -f "$source_file" && ! -L "$source_file" ]] || {
      echo "A declared source file is missing or has invalid metadata" >&2
      exit 1
    }
    actual_bytes=$(wc -c <"$source_file" | tr -d '[:space:]')
    actual_sha=$(sha256sum "$source_file" | cut -d' ' -f1)
    [[ "$actual_bytes" == "$expected_bytes" && "$actual_sha" == "$expected_sha" ]] || {
      echo "A source file failed its manifest integrity check" >&2
      exit 1
    }
    declared_files=$((declared_files + 1))
  else
    [[ "$parse_status" == "fetch_failed" && "$expected_bytes" == "0" && ! -e "$source_file" && ! -L "$source_file" ]] || {
      echo "A source failure entry has no matching archived body or valid empty-fetch metadata" >&2
      exit 1
    }
  fi
done < <(jq -c '.artifacts[]' "$source_manifest")

actual_files=$(find "$raw_root" -type f | wc -l | tr -d '[:space:]')
expected_files=$((declared_files + 1))
[[ "$actual_files" == "$expected_files" ]] || {
  echo "Source artifact contains files that are absent from its manifest" >&2
  exit 1
}

mkdir -p "$(dirname "$archive_file")" "$(dirname "$index_file")"
tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner --format=gnu \
  -C "$artifact_dir" -cf - "$source_run_id" | gzip -n >"$archive_file"

archive_bytes=$(wc -c <"$archive_file" | tr -d '[:space:]')
archive_sha=$(sha256sum "$archive_file" | cut -d' ' -f1)
source_manifest_sha=$(sha256sum "$source_manifest" | cut -d' ' -f1)
source_dates=$(jq -c '[.artifacts[].dataAsOf? // empty] | unique' "$source_manifest")
object_prefix="source-archives/refresh-source-snapshot/run-$source_run_id"

jq -n \
  --arg sourceWorkflow "Refresh source snapshot" \
  --arg sourceRunId "$source_run_id" \
  --arg sourceRunCreatedAt "$source_created_at" \
  --arg sourceRunConclusion "$source_conclusion" \
  --arg sourceHeadSha "$source_head_sha" \
  --arg sourceArtifactId "$source_artifact_id" \
  --arg sourceManifestSha256 "$source_manifest_sha" \
  --arg sourceManifestPath "$source_run_id/manifest.json" \
  --arg objectPrefix "$object_prefix" \
  --arg archiveKey "$object_prefix/raw-source.tar.gz" \
  --arg archiveSha256 "$archive_sha" \
  --argjson archiveBytes "$archive_bytes" \
  --argjson artifactCount "$artifact_count" \
  --argjson archivedBodyCount "$declared_files" \
  --argjson sourceDataAsOfs "$source_dates" \
  '{
    schemaVersion: 1,
    sourceWorkflow: $sourceWorkflow,
    sourceRunId: $sourceRunId,
    sourceRunCreatedAt: $sourceRunCreatedAt,
    sourceRunConclusion: $sourceRunConclusion,
    sourceHeadSha: $sourceHeadSha,
    sourceArtifactId: $sourceArtifactId,
    sourceManifest: {path: $sourceManifestPath, sha256: $sourceManifestSha256},
    sourceDataAsOfs: $sourceDataAsOfs,
    artifactCount: $artifactCount,
    archivedBodyCount: $archivedBodyCount,
    objectPrefix: $objectPrefix,
    archive: {
      key: $archiveKey,
      bytes: $archiveBytes,
      sha256: $archiveSha256,
      contentType: "application/gzip"
    }
  }' >"$index_file"

echo "Prepared source run $source_run_id: $artifact_count manifest entries, $declared_files archived bodies, $archive_bytes compressed bytes."
