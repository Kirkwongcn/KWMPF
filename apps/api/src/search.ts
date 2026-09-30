/** 搜尋別名屬查詢便利措施，不修改官方名稱或基金身分配對契約。 */
export const SEARCH_ALIASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/滙豐|匯豐/gu, "hsbc"],
  [/富達/gu, "fidelity"],
  [/友邦/gu, "aia"],
  [/宏利/gu, "manulife"],
  [/永明/gu, "sun life"],
  [/中銀保誠/gu, "boc prudential"],
  [/交通銀行/gu, "bank of communications"],
  [/中國人壽/gu, "china life"],
  [/保守/gu, "conservative"],
  [/核心累積/gu, "core accumulation"],
  [/65\s*歲後/gu, "age 65 plus"],
  [/港股/gu, "hong kong"],
  [/基金/gu, " fund "],
];

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function searchTokens(query: string): string[] {
  return normalizeSearch(expandSearchAliases(query))
    .split(/\s+/u)
    .filter(Boolean);
}

function expandSearchAliases(query: string): string {
  let expanded = query.normalize("NFKC").toLowerCase();
  for (const [pattern, replacement] of SEARCH_ALIASES)
    expanded = expanded.replace(pattern, ` ${replacement} `);
  return expanded;
}

export function matchesSearch(query: string, fields: string[]): boolean {
  const haystack = fields
    .map((field) => normalizeSearch(expandSearchAliases(field)))
    .join(" ");
  return searchTokens(query).every((token) => haystack.includes(token));
}

export function positiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
): number | null {
  if (value === undefined) return fallback;
  if (!/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum
    ? parsed
    : null;
}
