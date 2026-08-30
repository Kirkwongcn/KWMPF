import type { FactSheetDisclosure } from "./fact-sheet-allocation";

/**
 * 把便覽抽到的披露逐隻配對平台的成分基金。
 *
 * 配對只做大小寫、彎引號同破折號的正規化，唔會做模糊比對：便覽同平台用的是同一批
 * 官方名稱，夾硬撮合只會把兩隻唔同的基金撈埋一齊。配對唔到就列入報告，
 * 由呼叫者決定係報錯定係當官方未提供。
 */

/** 平台上的一隻成分基金，連同共用同一份便覽披露的全部基金類別。 */
export type PlatformFund = {
  schemeName: string;
  constituentFundName: string;
  fundClassIds: string[];
};

export type PairedFund = {
  fundClassIds: string[];
  schemeName: string;
  constituentFundName: string;
  factSheetAsOf: string;
  allocationDimensions: number;
  topHoldings: number;
  unavailableFields: string[];
  unavailableReasons: Record<string, string>;
};

export type UnpairedPlatformFund = PlatformFund & { reason: string };
export type UnpairedDisclosure = {
  schemeName: string;
  constituentFundName: string;
  reason: string;
};

/** 配對到的披露原文，供發布 payload 使用；覆蓋報告只收數目，唔會帶住成份披露。 */
export type PairedDisclosure = {
  fundClassIds: string[];
  disclosure: FactSheetDisclosure;
};

export type PairingResult = {
  paired: PairedFund[];
  pairedDisclosures: PairedDisclosure[];
  unpairedPlatformFunds: UnpairedPlatformFund[];
  unpairedDisclosures: UnpairedDisclosure[];
};

export function normalizeFundName(value: string) {
  return value
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

export function pairFactSheetDisclosures(
  platformFunds: PlatformFund[],
  disclosures: FactSheetDisclosure[],
  platformNamePrefix?: RegExp,
): PairingResult {
  const paired: PairedFund[] = [];
  const pairedDisclosures: PairedDisclosure[] = [];
  const unpairedPlatformFunds: UnpairedPlatformFund[] = [];
  const unpairedDisclosures: UnpairedDisclosure[] = [];
  const used = new Set<FactSheetDisclosure>();

  for (const fund of platformFunds) {
    const key = normalizeFundName(
      platformNamePrefix
        ? fund.constituentFundName.replace(platformNamePrefix, "")
        : fund.constituentFundName,
    );
    const matches = disclosures.filter(
      (disclosure) =>
        disclosure.schemeName === fund.schemeName &&
        normalizeFundName(disclosure.constituentFundName) === key,
    );

    if (matches.length === 0) {
      unpairedPlatformFunds.push({
        ...fund,
        reason: "no section with this fund name in the scheme fact sheet",
      });
      continue;
    }
    // 同一隻成分基金在便覽出現多過一次（例如中英兩版），代表區段切錯，
    // 唔可以隨便揀一個，否則配置同持倉可能來自另一隻基金。
    if (matches.length > 1) {
      unpairedPlatformFunds.push({
        ...fund,
        reason: `${matches.length} sections share this fund name in the scheme fact sheet`,
      });
      continue;
    }

    const disclosure = matches[0]!;
    used.add(disclosure);
    pairedDisclosures.push({ fundClassIds: fund.fundClassIds, disclosure });
    paired.push({
      fundClassIds: fund.fundClassIds,
      schemeName: fund.schemeName,
      constituentFundName: fund.constituentFundName,
      factSheetAsOf: disclosure.factSheetAsOf,
      allocationDimensions: disclosure.allocations.length,
      topHoldings: disclosure.topHoldings.length,
      unavailableFields: disclosure.unavailableFields,
      unavailableReasons: disclosure.unavailableReasons,
    });
  }

  for (const disclosure of disclosures) {
    if (used.has(disclosure)) continue;
    unpairedDisclosures.push({
      schemeName: disclosure.schemeName,
      constituentFundName: disclosure.constituentFundName,
      reason: "no constituent fund with this name on the official platform",
    });
  }

  return { paired, pairedDisclosures, unpairedPlatformFunds, unpairedDisclosures };
}
