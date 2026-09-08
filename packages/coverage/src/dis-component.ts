import { normalizeFundName } from "./fact-sheet-allocation-pairing";

/**
 * 辨識預設投資策略（DIS）的兩隻成分基金：核心累積基金／65歲後基金。
 *
 * 只對 `constituentFundName` 做完全匹配（大小寫、引號、破折號正規化），
 * 唔用 `fundClassName`——嗰欄係 Class A／Class T／n.a.。
 * 唔做包含、前綴或模糊比對：未列明的新名稱要人手加進名單，不可猜。
 *
 * 官方平台 `fundType` 目前同呢份名單一致，發布時會對照；對唔上就報錯，
 * 唔會用基金種類去補位或覆蓋名稱匹配。
 */

export type DisComponent = "core_accumulation" | "age65_plus";

export const DIS_CORE_FUND_TYPE =
  "Mixed Assets Fund - Default Investment Strategy - Core Accumulation Fund";
export const DIS_AGE65_FUND_TYPE =
  "Mixed Assets Fund - Default Investment Strategy - Age 65 Plus Fund";

const CORE_NAMES = [
  "Core Accumulation Fund",
  "核心累積基金",
  "AMTD Invesco Core Accumulation Fund",
  "Allianz MPF Core Accumulation Fund",
  "BCOM Core Accumulation Fund",
  "BCT (Industry) Core Accumulation Fund",
  "BCT (Pro) Core Accumulation Fund",
  "BEA (Industry Scheme) Core Accumulation Fund",
  "BEA (MPF) Core Accumulation Fund",
  "BEA Core Accumulation Fund",
  "BOC-Prudential Core Accumulation Fund",
  "China Life Core Accumulation Fund",
  "Haitong Core Accumulation Fund",
  "Invesco Core Accumulation Fund",
  "Manulife MPF Core Accumulation Fund",
  "My Choice Core Accumulation Fund",
  "Principal Core Accumulation Fund",
  "Schroder MPF Core Accumulation Fund",
  "Sun Life MPF Core Accumulation Fund",
] as const;

const AGE65_NAMES = [
  "Age 65 Plus Fund",
  "65歲後基金",
  "65 歲後基金",
  "AMTD Invesco Age 65 Plus Fund",
  "Allianz MPF Age 65 Plus Fund",
  "BCOM Age 65 Plus Fund",
  "BCT (Industry) Age 65 Plus Fund",
  "BCT (Pro) Age 65 Plus Fund",
  "BEA (Industry Scheme) Age 65 Plus Fund",
  "BEA (MPF) Age 65 Plus Fund",
  "BEA Age 65 Plus Fund",
  "BOC-Prudential Age 65 Plus Fund",
  "China Life Age 65 Plus Fund",
  "Haitong Age 65 Plus Fund",
  "Invesco Age 65 Plus Fund",
  "Manulife MPF Age 65 Plus Fund",
  "My Choice Age 65 Plus Fund",
  "Principal Age 65 Plus Fund",
  "Schroder MPF Age 65 Plus Fund",
  "Sun Life MPF Age 65 Plus Fund",
] as const;

const CORE_KEYS = new Set(CORE_NAMES.map(normalizeFundName));
const AGE65_KEYS = new Set(AGE65_NAMES.map(normalizeFundName));

export type DisFund = {
  fundClassId: string;
  schemeName: string;
  constituentFundName: string;
  fundType?: string;
};

export type DisSchemeReport = {
  schemeName: string;
  coreFundClassIds: string[];
  age65FundClassIds: string[];
  status: "complete" | "unavailable";
  missing: DisComponent[];
  reason?: string;
};

export function disComponentOf(constituentFundName: string): DisComponent | undefined {
  const key = normalizeFundName(constituentFundName);
  if (CORE_KEYS.has(key)) return "core_accumulation";
  if (AGE65_KEYS.has(key)) return "age65_plus";
  return undefined;
}

export function tagDisComponents(funds: DisFund[]): Map<string, DisComponent> {
  const tagged = new Map<string, DisComponent>();
  for (const fund of funds) {
    const tag = disComponentOf(fund.constituentFundName);
    if (tag) tagged.set(fund.fundClassId, tag);
  }
  return tagged;
}

function officialDisType(fundType: string | undefined): DisComponent | undefined {
  if (fundType === DIS_CORE_FUND_TYPE) return "core_accumulation";
  if (fundType === DIS_AGE65_FUND_TYPE) return "age65_plus";
  return undefined;
}

export function assertDisNameTypeAgreement(funds: DisFund[]): void {
  const conflicts: string[] = [];
  for (const fund of funds) {
    const byName = disComponentOf(fund.constituentFundName);
    const byType = officialDisType(fund.fundType);
    if (byName && byType && byName !== byType) {
      conflicts.push(
        `${fund.schemeName} / ${fund.constituentFundName}: name=${byName} fundType=${byType}`,
      );
    } else if (byName && !byType) {
      conflicts.push(
        `${fund.schemeName} / ${fund.constituentFundName}: name tags ${byName} but fundType is ${fund.fundType ?? "(missing)"}`,
      );
    } else if (!byName && byType) {
      conflicts.push(
        `${fund.schemeName} / ${fund.constituentFundName}: official fundType is DIS ${byType} but the constituent name is not in the exact-name list`,
      );
    }
  }
  if (conflicts.length > 0) {
    throw new Error(
      `DIS name list disagrees with official fundType; add or correct exact names before publishing:\n${conflicts.join("\n")}`,
    );
  }
}

export function reportSchemeDisCoverage(funds: DisFund[]): DisSchemeReport[] {
  const schemes = new Map<string, DisFund[]>();
  for (const fund of funds) {
    const list = schemes.get(fund.schemeName) ?? [];
    list.push(fund);
    schemes.set(fund.schemeName, list);
  }

  return [...schemes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([schemeName, members]) => {
      const coreFundClassIds = members
        .filter((fund) => disComponentOf(fund.constituentFundName) === "core_accumulation")
        .map((fund) => fund.fundClassId);
      const age65FundClassIds = members
        .filter((fund) => disComponentOf(fund.constituentFundName) === "age65_plus")
        .map((fund) => fund.fundClassId);
      const missing: DisComponent[] = [];
      if (coreFundClassIds.length === 0) missing.push("core_accumulation");
      if (age65FundClassIds.length === 0) missing.push("age65_plus");
      if (missing.length === 0) {
        return {
          schemeName,
          coreFundClassIds,
          age65FundClassIds,
          status: "complete" as const,
          missing,
        };
      }
      return {
        schemeName,
        coreFundClassIds,
        age65FundClassIds,
        status: "unavailable" as const,
        missing,
        reason: "no exact constituent-fund name match",
      };
    });
}
