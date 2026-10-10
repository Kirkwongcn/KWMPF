#!/usr/bin/env bash
set -euo pipefail

# 下載受託人每月官方回報來源（ADR 0014），供 build-monthly-summary-returns 讀取。
#
# 用法：scripts/fetch-trustee-monthly-returns.sh <data-as-of YYYY-MM-DD> <output-dir>
#
# - 滙豐／恒生《每月基金表現摘要》：網址按月份命名，只下載目標月份那一份。
# - 銀聯信託（BCT）官網基金表現接口：只提供最新一期；回應的 performanceDate
#   同目標日期唔一樣（例如受託人未更新，或者已經去咗下一個月）就唔用。
#
# 每份成功下載而且日期對得上的來源，喺 <output-dir>/arguments.txt 寫一行
# `--summary <值>` 或 `--bct <值>`。其餘寫入 <output-dir>/skipped.txt（以 tab 分隔：
# 計劃、網址、原因代號、說明），原因代號：
#   download-failed   下載失敗或者唔係 PDF；
#   invalid-response  BCT 回應唔係有效基金表現資料；
#   source-behind     BCT 仲未更新到目標日期（正常，等下次）；
#   source-ahead      BCT 已經去咗下一期，目標日期嗰期接口再攞唔返（要跟進）。
# 呢度唔讀數字，數字全部交由讀取器同交叉核對把關。

data_as_of="${1:-}"
output_dir="${2:-}"
if [[ ! "$data_as_of" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || [ -z "$output_dir" ]; then
  echo "用法：scripts/fetch-trustee-monthly-returns.sh <YYYY-MM-DD> <output-dir>" >&2
  exit 2
fi

mkdir -p "$output_dir"
: >"$output_dir/arguments.txt"
: >"$output_dir/skipped.txt"

year="${data_as_of:0:4}"
month="${data_as_of:5:2}"
months=(jan feb mar apr may jun jul aug sep oct nov dec)
month_name="${months[$((10#$month - 1))]}"
user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

fetch() {
  local url="$1" target="$2"
  curl --fail --silent --show-error --location --max-time 120 \
    --user-agent "$user_agent" --output "$target" "$url"
}

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

pdf_sources=(
  "HSBC Mandatory Provident Fund - SuperTrust Plus|https://www.hsbc.com.hk/content/dam/hsbc/hk/docs/mpf/monthly-fund-performance-summary/${year}${month}.pdf|hsbc-${year}${month}.pdf"
  "Hang Seng Mandatory Provident Fund - SuperTrust Plus|https://cms.hangseng.com/cms/cbd/eMPF/monthly_${month_name}${year}.pdf|hang-seng-${year}${month}.pdf"
)
for entry in "${pdf_sources[@]}"; do
  IFS='|' read -r scheme url file <<<"$entry"
  target="$output_dir/$file"
  retrieved_at="$(now)"
  if fetch "$url" "$target" && [ "$(head -c 5 "$target")" = "%PDF-" ]; then
    printf -- '--summary\t%s|%s|%s|%s\n' "$scheme" "$url" "$target" "$retrieved_at" >>"$output_dir/arguments.txt"
  else
    printf '%s\t%s\tdownload-failed\tdownload failed or not a PDF\n' "$scheme" "$url" >>"$output_dir/skipped.txt"
    rm -f "$target"
  fi
done

# `date` 參數只影響單位價格日期（冇當日價格會用之前最近一日）；回報永遠係最新一期，
# 所以要逐份核對 performanceDate。用前一日避免當日價格未公布。
bct_schemes=(
  "pro-choice|BCT (MPF) Pro Choice"
  "industry-choice|BCT (MPF) Industry Choice"
  "strategic-mpf|BCT Strategic MPF Scheme"
  "series-800|BCT MPF Scheme Series 800"
  "smart-plan|BCT MPF - Smart Plan"
  "simple-plan|BCT MPF - Simple Plan"
)
price_date="$(date -u -d yesterday +%F)"
for entry in "${bct_schemes[@]}"; do
  IFS='|' read -r scheme_id scheme <<<"$entry"
  url="https://www.bcthk.com/bin/servlet/fundInformation?lang=en&schemaInfoId=${scheme_id}&date=${price_date}"
  target="$output_dir/bct-${scheme_id}.json"
  retrieved_at="$(now)"
  if ! fetch "$url" "$target"; then
    printf '%s\t%s\tdownload-failed\tdownload failed\n' "$scheme" "$url" >>"$output_dir/skipped.txt"
    rm -f "$target"
    continue
  fi
  dates="$(jq -r '[.data.fundInformationList[]?.fundPerformanceDetail.fundPerformance.performanceDate] | unique | join(",")' "$target" 2>/dev/null || true)"
  if [[ ! "$dates" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    printf '%s\t%s\tinvalid-response\tperformance dates "%s"\n' "$scheme" "$url" "$dates" >>"$output_dir/skipped.txt"
    continue
  fi
  if [ "$dates" != "$data_as_of" ]; then
    reason="source-behind"
    [[ "$dates" > "$data_as_of" ]] && reason="source-ahead"
    printf '%s\t%s\t%s\tperformance date %s, not %s\n' "$scheme" "$url" "$reason" "$dates" "$data_as_of" >>"$output_dir/skipped.txt"
    continue
  fi
  printf -- '--bct\t%s|%s|%s|%s\n' "$scheme" "$url" "$target" "$retrieved_at" >>"$output_dir/arguments.txt"
done

echo "Fetched $(wc -l <"$output_dir/arguments.txt") source(s); skipped $(wc -l <"$output_dir/skipped.txt")."
