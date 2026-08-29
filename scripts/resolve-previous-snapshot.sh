#!/usr/bin/env bash

set -euo pipefail

# 印出最近一個真正帶有平台快照的來源批次路徑。
# data/sources 之下同時有非日期目錄（例如 lipper/）及只放其他官方檔案的
# 日期目錄（例如只有 fund-fact-sheet-links.json 的批次），兩者都不是
# 上一個平台批次，必須略過而不是靜默失敗。

sources_root="${1:-data/sources}"

if [ ! -d "$sources_root" ]; then
  echo "找不到來源目錄 ${sources_root}。" >&2
  exit 1
fi

while read -r candidate; do
  if [ -f "${sources_root}/${candidate}/mpf-fund-platform.json" ]; then
    printf '%s\n' "${sources_root}/${candidate}/mpf-fund-platform.json"
    exit 0
  fi
done < <(ls "$sources_root" | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' | sort -r)

echo "${sources_root} 之下沒有帶 mpf-fund-platform.json 的日期目錄，無法決定上一個批次。" >&2
exit 1
