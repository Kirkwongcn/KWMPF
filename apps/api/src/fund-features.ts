/**
 * 基金特色的「同類位置」（ADR 0012 第 6 點）：一隻基金喺同一積金局基金類型入面，
 * 規模、成立年期、波幅、管理費排喺邊個位置。全部係本站計算，官方冇呢個排位。
 *
 * 只講位置，唔講好壞：規模大、成立耐、波幅低、收費低都唔等於較好，網站唔撰寫推銷
 * 字眼，亦唔合成總分。四分位按同類隻數計，少過 `MIN_PEERS` 隻唔分位。
 */

export const FEATURE_KEYS = [
  "fundSize",
  "fundAge",
  "volatility",
  "managementFee",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** 少過呢個數目，四分位冇意思（一隻佔成個四分之一），只列排位唔分位。 */
export const MIN_PEERS = 4;

export type FeaturePeer = { fundClassId: string; value: number };

export type FeaturePosition = {
  key: FeatureKey;
  /** 本基金的官方值；冇值或者過期就冇呢一欄，並且 `excludedReason` 講原因。 */
  value?: number;
  /** 本基金數值的截至日期（成立年期係成立日期）。 */
  asOf?: string;
  excludedReason?: "missing" | "stale" | "unverified";
  /** 同類合資格隻數（包括本基金，如果本基金合資格）。 */
  peerCount: number;
  /** 由 `order` 嘅一端數起，第幾個；同值同名次。 */
  rank?: number;
  /** 1 = `order` 嘅一端（最大、最早、最低），4 = 另一端；樣本不足冇呢一欄。 */
  quartile?: 1 | 2 | 3 | 4;
  /** 本站計算的中位數。 */
  median?: number;
  min?: number;
  max?: number;
  /** 排位方向：規模由大到細，成立由早到遲，波幅及管理費由低到高。 */
  order: "descending" | "ascending";
};

export const FEATURE_ORDER: Record<FeatureKey, FeaturePosition["order"]> = {
  fundSize: "descending",
  // 成立年期以成立至今的日數計，數值越大越早成立。
  fundAge: "descending",
  volatility: "ascending",
  managementFee: "ascending",
};

function medianOf(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/**
 * 同類位置。`peers` 已經剔走冇值同過期的基金，可以包括或者唔包括本基金；
 * 本基金唔喺入面（冇值或過期）就只交同類統計，唔排位。
 */
export function featurePosition(
  key: FeatureKey,
  fundClassId: string,
  peers: FeaturePeer[],
  own: {
    value?: number;
    asOf?: string;
    excludedReason?: "missing" | "stale" | "unverified";
  },
): FeaturePosition {
  const order = FEATURE_ORDER[key];
  const values = peers.map((peer) => peer.value);
  const base: FeaturePosition = {
    key,
    order,
    peerCount: peers.length,
    ...(own.asOf ? { asOf: own.asOf } : {}),
    ...(values.length > 0
      ? {
          median: medianOf(values),
          min: Math.min(...values),
          max: Math.max(...values),
        }
      : {}),
  };
  const self = peers.find((peer) => peer.fundClassId === fundClassId);
  if (!self) {
    return { ...base, excludedReason: own.excludedReason ?? "missing" };
  }
  const ahead = peers.filter((peer) =>
    order === "descending" ? peer.value > self.value : peer.value < self.value,
  ).length;
  const tied = peers.filter((peer) => peer.value === self.value).length;
  // 同值同名次（顯示最好嗰個名次），但四分位按並列一組的中間位置計，否則 12 隻
  // 有 9 隻收費一樣時，9 隻全部會變成「首四分之一」，誇大咗位置。
  const rank = ahead + 1;
  const middleRank = ahead + (tied + 1) / 2;
  return {
    ...base,
    value: self.value,
    rank,
    ...(peers.length >= MIN_PEERS
      ? {
          quartile: Math.min(
            4,
            Math.ceil((middleRank / peers.length) * 4),
          ) as FeaturePosition["quartile"],
        }
      : {}),
  };
}

/**
 * 成立至評估日的日數（本站計算）。用日數而唔係整年排位，否則同一年成立的基金全部
 * 並列；網站顯示時再折算成年。日期唔完整或者喺評估日之後就冇值。
 */
export function daysSinceLaunch(launchDate: string, on: Date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(launchDate)) return undefined;
  const start = Date.parse(`${launchDate}T00:00:00Z`);
  if (Number.isNaN(start)) return undefined;
  const days = Math.floor((on.getTime() - start) / 86_400_000);
  return days >= 0 ? days : undefined;
}
