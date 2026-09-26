#!/usr/bin/env bash
set -euo pipefail

if (($# == 0)); then
  echo "Usage: run-wrangler-redacted.sh COMMAND [ARG ...]" >&2
  exit 2
fi

output_file="$(mktemp)"
trap 'rm -f "$output_file"' EXIT

set +e
"$@" >"$output_file" 2>&1
command_status=$?
set -e

python3 - "$output_file" <<'PY'
from pathlib import Path
import re
import sys

output = Path(sys.argv[1]).read_text(errors="replace")
if re.search(r"X-Amz-", output, re.IGNORECASE):
    print("Wrangler output omitted because it contained a temporary signed URL.")
else:
    sys.stdout.write(output)
PY

exit "$command_status"
