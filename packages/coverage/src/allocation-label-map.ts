import { CJK, NUMERIC_FRAGMENT } from "./pdf-xml";
import type { FactSheetUnavailableKind } from "./fact-sheet-allocation";

/**
 * 把便覽配置標籤映射到三個資產類別桶。映射是編輯判斷，不是官方分類。
 *
 * 鍵用正規化後的標籤（插入中英空格、摺疊空白、去掉註腳符號），值是目標桶或
 * `not_asset_class`。未出現在對照表、又唔係抽取垃圾的標籤會報錯，不可靜默丟進「其他」。
 */

export const ASSET_BUCKETS = ["equity", "bond", "cash_and_other"] as const;
export type AssetBucket = (typeof ASSET_BUCKETS)[number];
export type LabelBucket = AssetBucket | "not_asset_class";

export type AllocationLabelMapEntry = {
  key: string;
  bucket: LabelBucket;
  examples: string[];
};

export type AllocationLabelMapFile = {
  generatedAt: string;
  version: number;
  source: string;
  buckets: typeof ASSET_BUCKETS;
  entries: AllocationLabelMapEntry[];
};

export type AllocationLabelMapDiff = {
  added: { key: string; bucket: LabelBucket }[];
  removed: { key: string; bucket: LabelBucket }[];
  recategorized: { key: string; from: LabelBucket; to: LabelBucket }[];
};

export type MappedAllocationUnavailableReason = FactSheetUnavailableKind | "not-asset-class";

export type MappedAllocationBuckets = {
  official: false;
  mapVersion: string;
  asOf: string;
  sourceHeading: string;
  buckets: { equity: number; bond: number; cashAndOther: number };
};

export type MappedAllocationUnavailable = {
  official: false;
  mapVersion: string;
  asOf?: string;
  unavailable: true;
  reason: MappedAllocationUnavailableReason;
};

export type MappedAllocation = MappedAllocationBuckets | MappedAllocationUnavailable;

export type AllocationDimensionInput = {
  heading: string;
  entries: { label: string; percent: number }[];
};

export type MapAllocationInput = {
  allocations: AllocationDimensionInput[];
  unavailableFields?: string[];
  unavailableKinds?: Partial<Record<string, FactSheetUnavailableKind>>;
  factSheetAsOf?: string;
};

const EQUITY =
  /股票|股份|equit|stock|reit|房地產信託|房地產投資信託|\breits?\b/;
const BOND =
  /債券|債權|主權債|\bbonds?\b|fixed income|定息|固定收益|債務證券|debt securities|debenture|sukuk/;
const CASH =
  /現金|bank (?:deposit|balance)|銀行存款|定期存款|term deposit|deposits?|money market|貨幣市場|流動資金|liquidity|short[- ]term|短至中期證券|short-medium term/;
const CASH_WORD = /\bcash\b/;
const OTHERS_RESIDUAL =
  /^(?:others?|其他)(?:\s+(?:others?|其他|assets?|資產|及其他|and others?))*$/i;
const FUND_NAME = /\bfunds?\b|基金/;
const RATING =
  /信貸評級|credit rating|crediting rating|\/moody|標準普爾|s&p\/|^aa\/aa|^bbb\/baa|^aaa\b|^aa[+-]?\b|^a[+-]?\b|^bbb\b|^bb[+-]?\b|^nr\b|^not rated|^unrated/;
const CURRENCY_CODE =
  /^(?:usd|hkd|cny|cnh|eur|gbp|jpy|aud|cad|sgd|nzd|chf|rmb|us dollar|hong kong dollar|chinese yuan)/;
const COMMENTARY =
  /[。！？]|抵制|報升|報跌|持續貶值|第[一二三四]季|地緣政治|通脹|加息|失業率|人工智慧|人工智能|升幅|跌幅|市場視之|勞動市場|英倫銀行|金邊債券|維持利率/;

/** 映射後三桶絕對值合計低於此數，當抽取唔完整，不可當成官方資產比例。 */
export const COMPLETE_ALLOCATION_MINIMUM = 80;
/** 合計明顯超過 100，多數是同一張表重覆明細同摘要，不可把兩層加埋。 */
export const COMPLETE_ALLOCATION_MAXIMUM = 120;
const RETURN_LEAK =
  /參考投資組合|(?<![日])本基金|\bthis fund\b|latest fund expense ratio|year to date|年初至今|top 10 portfolio holdings|投資組合內十大資產|\bpsr[0-9]\b/;
const STDEV = /standard deviation|標準差/;

export function normalizeLabel(raw: string): string {
  let text = raw.normalize("NFKC").replaceAll("巿", "市");
  text = insertScriptSpaces(text).replace(/\s+/g, " ").trim();
  text = text.replace(/^[A-Za-z]\s*[:：]\s*/, "");
  text = text.replace(/^(?:\d+\s+)+/, "");
  text = text.replace(/[#*<>]+/g, " ").replace(/\s+/g, " ").trim();
  if (/(現金|其他|others?|cash)/i.test(text)) {
    text = text.replace(/\s+[1-9]\d?\s*$/, "").trim();
  }
  return text.toLowerCase();
}

function insertScriptSpaces(text: string): string {
  let output = "";
  for (const current of text) {
    const previous = output.at(-1);
    if (
      previous &&
      !/\s/.test(previous) &&
      !/\s/.test(current) &&
      isCjk(previous) !== isCjk(current) &&
      !(NUMERIC_FRAGMENT.test(previous) && NUMERIC_FRAGMENT.test(current))
    ) {
      output += " ";
    }
    output += current;
  }
  return output;
}

function isCjk(character: string): boolean {
  return CJK.test(character);
}

export function isIgnorableLabel(raw: string): boolean {
  const text = normalizeLabel(raw);
  if (!text || /^[:：]+$/.test(text)) return true;
  if (/^(?:n\/a|不適用)(?:\s+(?:n\/a|不適用))*$/.test(text)) return true;
  if (STDEV.test(text)) return true;
  if (COMMENTARY.test(raw) || COMMENTARY.test(text)) return true;
  if (RETURN_LEAK.test(text)) return true;
  if (/-?\d+(?:\.\d+)?%/.test(text)) return true;
  const percents = text.match(/-?\d+(?:\.\d+)?%/g) ?? [];
  if (percents.length >= 2) return true;
  if (/^-?\d+(?:\.\d+)?%\s/.test(text) && percents.length >= 1 && !EQUITY.test(text) && !BOND.test(text) && !CASH.test(text) && !CASH_WORD.test(text)) {
    return true;
  }
  return false;
}

export function proposeBucket(raw: string): LabelBucket | "ignore" {
  if (isIgnorableLabel(raw)) return "ignore";
  const text = normalizeLabel(raw);
  const hasEquity = EQUITY.test(text);
  const hasBond = BOND.test(text);
  const hasCash = CASH.test(text) || CASH_WORD.test(text);
  if ((hasEquity && hasBond) || (hasEquity && hasCash) || (hasBond && hasCash)) return "not_asset_class";
  if (FUND_NAME.test(text) && !hasEquity && !hasBond && !hasCash) return "not_asset_class";
  if (hasEquity) return "equity";
  if (hasBond) return "bond";
  if (hasCash) return "cash_and_other";
  if (OTHERS_RESIDUAL.test(text)) return "cash_and_other";
  if (RATING.test(text) || CURRENCY_CODE.test(text)) return "not_asset_class";
  return "not_asset_class";
}

export function lookupBucket(
  raw: string,
  entries: ReadonlyMap<string, LabelBucket>,
): LabelBucket | "ignore" {
  if (isIgnorableLabel(raw)) return "ignore";
  const key = normalizeLabel(raw);
  const bucket = entries.get(key);
  if (!bucket) {
    throw new Error(`Allocation label map has no entry for ${JSON.stringify(raw)} (key ${JSON.stringify(key)})`);
  }
  return bucket;
}

export function toLabelLookup(file: AllocationLabelMapFile): Map<string, LabelBucket> {
  const lookup = new Map<string, LabelBucket>();
  for (const entry of file.entries) {
    if (lookup.has(entry.key)) {
      throw new Error(`Allocation label map repeats key ${JSON.stringify(entry.key)}`);
    }
    lookup.set(entry.key, entry.bucket);
  }
  return lookup;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

export function mapDisclosureAllocation(
  input: MapAllocationInput,
  lookup: ReadonlyMap<string, LabelBucket>,
  mapVersion: string,
): MappedAllocation {
  const officialKind = input.unavailableKinds?.allocation;
  if ((input.allocations?.length ?? 0) === 0) {
    return {
      official: false,
      mapVersion,
      asOf: input.factSheetAsOf,
      unavailable: true,
      reason: officialKind ?? "not-disclosed",
    };
  }

  const usable: { heading: string; buckets: MappedAllocationBuckets["buckets"] }[] = [];
  for (const dimension of input.allocations) {
    const mapped = mapDimension(dimension, lookup);
    if (mapped) usable.push({ heading: dimension.heading, buckets: mapped });
  }

  if (usable.length === 0) {
    return {
      official: false,
      mapVersion,
      asOf: input.factSheetAsOf,
      unavailable: true,
      reason: "not-asset-class",
    };
  }

  const chosen = pickAssetDimension(usable);
  return {
    official: false,
    mapVersion,
    asOf: input.factSheetAsOf ?? "",
    sourceHeading: chosen.heading,
    buckets: chosen.buckets,
  };
}

function mapDimension(
  dimension: AllocationDimensionInput,
  lookup: ReadonlyMap<string, LabelBucket>,
): MappedAllocationBuckets["buckets"] | undefined {
  const totals = { equity: 0, bond: 0, cashAndOther: 0 };
  let mappedRows = 0;
  for (const entry of dimension.entries) {
    const bucket = lookupBucket(entry.label, lookup);
    if (bucket === "ignore") {
      if (ignoredRowDropsAsset(entry.label)) return undefined;
      continue;
    }
    if (bucket === "not_asset_class") return undefined;
    mappedRows += 1;
    if (bucket === "equity") totals.equity += entry.percent;
    else if (bucket === "bond") totals.bond += entry.percent;
    else totals.cashAndOther += entry.percent;
  }
  if (mappedRows === 0) return undefined;
  const complete =
    Math.abs(totals.equity) + Math.abs(totals.bond) + Math.abs(totals.cashAndOther);
  if (complete < COMPLETE_ALLOCATION_MINIMUM || complete > COMPLETE_ALLOCATION_MAXIMUM) {
    return undefined;
  }
  return {
    equity: roundPercent(totals.equity),
    bond: roundPercent(totals.bond),
    cashAndOther: roundPercent(totals.cashAndOther),
  };
}

function ignoredRowDropsAsset(raw: string): boolean {
  const text = normalizeLabel(raw);
  return EQUITY.test(text) || BOND.test(text) || CASH.test(text) || CASH_WORD.test(text);
}

function pickAssetDimension(usable: { heading: string; buckets: MappedAllocationBuckets["buckets"] }[]) {
  if (usable.length === 1) return usable[0]!;
  const preferred = usable.filter((item) => /asset class|資產類別/i.test(item.heading));
  if (preferred.length === 1) return preferred[0]!;
  if (preferred.length > 1) {
    throw new Error(
      `Multiple asset-class allocation tables: ${preferred.map((item) => item.heading).join("; ")}`,
    );
  }
  throw new Error(
    `Multiple mappable allocation tables: ${usable.map((item) => item.heading).join("; ")}`,
  );
}

export function collectLabelKeys(
  allocations: AllocationDimensionInput[],
): { key: string; example: string; proposed: LabelBucket }[] {
  const byKey = new Map<string, { example: string; proposed: LabelBucket }>();
  for (const dimension of allocations) {
    for (const entry of dimension.entries) {
      if (isIgnorableLabel(entry.label)) continue;
      const key = normalizeLabel(entry.label);
      const proposed = proposeBucket(entry.label);
      if (proposed === "ignore") continue;
      const existing = byKey.get(key);
      if (!existing) byKey.set(key, { example: entry.label, proposed });
      else if (!existing.example.includes(entry.label) && existing.example.length < 80) {
        existing.example = entry.label;
      }
    }
  }
  return [...byKey.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({ key, example: value.example, proposed: value.proposed }));
}

export function buildAllocationLabelMap(
  allocations: AllocationDimensionInput[],
  previous?: AllocationLabelMapFile,
): { file: Omit<AllocationLabelMapFile, "generatedAt" | "source">; diff: AllocationLabelMapDiff } {
  const collected = collectLabelKeys(allocations);
  const previousByKey = new Map((previous?.entries ?? []).map((entry) => [entry.key, entry]));
  const entries: AllocationLabelMapEntry[] = collected.map((item) => {
    const earlier = previousByKey.get(item.key);
    if (earlier) {
      return {
        key: item.key,
        bucket: earlier.bucket,
        examples: uniqueExamples([...earlier.examples, item.example]),
      };
    }
    return { key: item.key, bucket: item.proposed, examples: [item.example] };
  });
  const diff = diffAllocationLabelMaps(previous?.entries ?? [], entries);
  return {
    file: {
      version: previous?.version ?? 1,
      buckets: ASSET_BUCKETS,
      entries,
    },
    diff,
  };
}

export function diffAllocationLabelMaps(
  previous: AllocationLabelMapEntry[],
  next: AllocationLabelMapEntry[],
): AllocationLabelMapDiff {
  const before = new Map(previous.map((entry) => [entry.key, entry]));
  const after = new Map(next.map((entry) => [entry.key, entry]));
  return {
    added: next
      .filter((entry) => !before.has(entry.key))
      .map((entry) => ({ key: entry.key, bucket: entry.bucket })),
    removed: previous
      .filter((entry) => !after.has(entry.key))
      .map((entry) => ({ key: entry.key, bucket: entry.bucket })),
    recategorized: next.flatMap((entry) => {
      const earlier = before.get(entry.key);
      if (!earlier || earlier.bucket === entry.bucket) return [];
      return [{ key: entry.key, from: earlier.bucket, to: entry.bucket }];
    }),
  };
}

export function allocationMapRequiresReview(diff: AllocationLabelMapDiff): boolean {
  return diff.added.length > 0 || diff.removed.length > 0 || diff.recategorized.length > 0;
}

function uniqueExamples(values: string[]): string[] {
  return [...new Set(values)].slice(0, 5);
}

export function isMappedAllocationUnavailable(
  value: MappedAllocation,
): value is MappedAllocationUnavailable {
  return "unavailable" in value && value.unavailable === true;
}
