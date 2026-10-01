#!/usr/bin/env bash
# Prepared for review; no credentials needed after the verified setup download.
set -euo pipefail
set +x
cd "$(git rev-parse --show-toplevel)"
bash scripts/prepare-cloud-workspace.sh
python3 scripts/restore-private-handoff.py \
  --index-file /workspace/kwmpf-private/downloads/preservation-index.json \
  --archives-dir /workspace/kwmpf-private/downloads \
  --verify-only
