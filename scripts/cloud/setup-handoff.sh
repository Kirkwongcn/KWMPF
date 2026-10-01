#!/usr/bin/env bash
# Prepared for review; not executed. R2 secrets belong in encrypted setup secrets.
set -euo pipefail
set +x
: "${KWMPF_HANDOFF_COMMIT:?Set the final full handoff commit from the GitHub receipt}"
[[ "$KWMPF_HANDOFF_COMMIT" =~ ^[0-9a-f]{40}$ ]] || exit 1
repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"
[[ "$(git remote get-url origin)" == *Kirkwongcn/KWMPF* ]] || exit 1
git fetch origin docs/claude-handoff-20261001-safe
git checkout --detach "$KWMPF_HANDOFF_COMMIT"
[[ "$(git rev-parse HEAD)" == "$KWMPF_HANDOFF_COMMIT" ]] || exit 1

if ! command -v bun >/dev/null || [[ "$(bun --version)" != 1.3.11 ]]; then
  curl -fsSL https://bun.sh/install | bash -s -- bun-v1.3.11
fi
export PATH="$HOME/.bun/bin:$PATH"
if ! command -v pdftotext >/dev/null; then
  sudo apt-get update
  sudo apt-get install -y --no-install-recommends poppler-utils
fi
bash scripts/prepare-cloud-workspace.sh

private_root=/workspace/kwmpf-private
python3 scripts/restore-private-handoff.py \
  --index-key independence/2026-10-01/snapshot-20261001-153225/preservation-index.json \
  --index-sha256 d17b0602e064a1e91c8a6ea60b0fdfb101877bbba87a67294c998c083720cb72 \
  --index-bytes 2976331 \
  --destination "$private_root"
unset R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY
# No test/build, remote mutation, push, merge or deployment.
