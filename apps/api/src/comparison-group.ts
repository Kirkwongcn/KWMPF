import {
  mpfaFundTypeOf,
  MPFA_FUND_TYPE_SOURCE,
} from "../../../packages/coverage/src/mpfa-fund-type";

export type ComparisonGroupSource = "mpfa";

export type ComparisonGroup = {
  name: string;
  source: ComparisonGroupSource;
  family: string | null;
};

export type ClassifiableFundClass = {
  fundType?: string;
};

/** 平台快照冇基金類型、或者類型唔喺積金局清單入面時的組別名；呢啲基金唔參與同組排名。 */
export const UNCLASSIFIED_GROUP = "積金局未提供基金類型";

/**
 * 比較組別只用積金局基金類型（ADR 0011）：組名係積金局中文基金類型原文，
 * 例如「股票基金 - 大中華股票基金」。唔再用 Lipper 或任何編輯歸類。
 */
export function comparisonGroupFor(
  fundClass: ClassifiableFundClass,
): ComparisonGroup {
  const type = mpfaFundTypeOf(fundClass.fundType);
  return type
    ? { name: type.zh, source: "mpfa", family: type.family.zh }
    : { name: UNCLASSIFIED_GROUP, source: "mpfa", family: null };
}

export function comparisonGroupSourceOf(_name: string): ComparisonGroupSource {
  return "mpfa";
}

export type Classification = {
  provider: string;
  urls: readonly string[];
  capturedAt: string;
  official: true;
};

/** 分類來源：積金局強積金基金平台的基金類型。 */
export function classificationOf(): Classification {
  return { ...MPFA_FUND_TYPE_SOURCE };
}
