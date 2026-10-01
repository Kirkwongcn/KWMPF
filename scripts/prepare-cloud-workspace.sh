#!/usr/bin/env bash
set -euo pipefail

# Development setup only. No cloud credentials, remote D1 or deployment command.
root="$(git rev-parse --show-toplevel)"
cd "$root"
expected_bun="$(python3 -c 'import json; print(json.load(open("package.json"))["packageManager"].split("@")[1])')"
for command in git bash python3 node bun; do
  command -v "$command" >/dev/null || { echo "Missing required tool: $command" >&2; exit 1; }
done
actual_bun="$(bun --version)"
if [[ "$actual_bun" != "$expected_bun" ]]; then
  echo "Bun version mismatch; install the package.json version before continuing." >&2
  exit 1
fi
bun install --frozen-lockfile
python3 - <<'PY'
import json, subprocess
from pathlib import Path
names = ["git", "bash", "python3", "node", "bun"]
versions = {name: subprocess.check_output([name, "--version"], text=True).splitlines()[0] for name in names}
report = {"gitCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
          "tools": versions, "dependencyInstallation": "frozen-lockfile-completed",
          "applicationTestsExecuted": False, "buildExecuted": False, "productionModified": False}
Path(".tmp-cloud-workspace-receipt.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report))
PY
