import type { HkifaLipperRow } from "./hkifa-lipper-mpf-table-parser";

/**
 * Lipper 表行名 → 積金局基金類別嘅對照表（ADR 0015）。
 *
 * Lipper 行名係「計劃縮寫-基金縮寫」，例如「Manulife RC (MPF)-Allianz MPF Core Acc A」。呢度唔做模糊配對：
 * 計劃縮寫用下面寫死嘅前綴表；基金只喺以下兩個條件同時成立先入對照表：
 *
 * 1. 計劃入面剛好得一個類別，積金局平台同期一年累積回報同 Lipper 一年 % Growth 完全相等；
 * 2. Lipper 基金名每個詞（經下面寫死嘅縮寫表展開）都喺嗰個類別嘅英文名加類別名入面出現。
 *
 * 產生出嚟嘅對照表逐行寫入 `data/reference/hkifa-lipper-fund-map.json`，人手覆核後先用；
 * 每月建候選時只按對照表精確查行名，唔會再推斷。
 */

export const HKIFA_LIPPER_SCHEME_PREFIXES: Record<string, string> = {
  "AIA MPF-Prime Value Choice-": "AIA MPF - Prime Value Choice",
  "AMTD MPF-": "AMTD MPF Scheme",
  "BCOM Joyful Ret MPF-": "BCOM Joyful Retirement MPF Scheme",
  "BCT (MPF) Industry Choice-": "BCT (MPF) Industry Choice",
  "BCT (MPF) Pro Choice-": "BCT (MPF) Pro Choice",
  "BCT MPF-Simple-": "BCT MPF - Simple Plan",
  "BCT MPF-Smart-": "BCT MPF - Smart Plan",
  "BCT MPF S800-": "BCT MPF Scheme Series 800",
  "BCT Strategic MPF-": "BCT Strategic MPF Scheme",
  "BEA (MPF) Industry-": "BEA (MPF) Industry Scheme",
  "BEA (MPF) MT-": "BEA (MPF) Master Trust Scheme",
  "BEA (MPF) Value-": "BEA (MPF) Value Scheme",
  "BOC-Pru Easy-Choice MPF-": "BOC-Prudential Easy-Choice Mandatory Provident Fund Scheme",
  "China Life MPF MT-": "China Life MPF Master Trust Scheme",
  "Fidelity Retirement MT-": "Fidelity Retirement Master Trust",
  "HSBC MPF-SuperTrust Plus-": "HSBC Mandatory Provident Fund - SuperTrust Plus",
  "Hang Seng MPF-SuperTrust Plus-": "Hang Seng Mandatory Provident Fund - SuperTrust Plus",
  "Haitong MPF Retire Fd-": "Haitong MPF Retirement Fund",
  "MASS MPF-": "MASS Mandatory Provident Fund Scheme",
  "Manulife GS (MPF)-": "Manulife Global Select (MPF) Scheme",
  "Manulife RC (MPF)-": "Manulife RetireChoice (MPF) Scheme",
  "My Choice MPF-": "My Choice Mandatory Provident Fund Scheme",
  "Sun Life Rainbow MPF-": "Sun Life Rainbow MPF Scheme",
};

/** Lipper 縮寫可以代表嘅完整詞（有歧義嘅列晒，例如「Gr」= Growth 或 Greater）。 */
const ABBREVIATIONS: Record<string, string[]> = {
  acc: ["accumulation"],
  allo: ["allocation"],
  am: ["america"],
  amer: ["america"],
  asiapac: ["asia pacific"],
  aspac: ["asia pacific"],
  aspc: ["asia pacific"],
  asst: ["asset"],
  bd: ["bond"],
  cn: ["china"],
  consv: ["conservative"],
  crbon: ["carbon"],
  diversif: ["diversified"],
  dyn: ["dynamic"],
  entpr: ["enterprises"],
  eq: ["equity"],
  eqty: ["equity"],
  etprs: ["enterprises"],
  eu: ["europe"],
  euro: ["europe"],
  europn: ["european"],
  fd: ["fund"],
  gl: ["global"],
  glbl: ["global"],
  gr: ["growth", "greater"],
  grtr: ["greater"],
  gteed: ["guaranteed"],
  hk: ["hong kong"],
  hs: ["hang seng"],
  idx: ["index"],
  inc: ["income"],
  ind: ["industry"],
  mix: ["mixed"],
  mkt: ["market"],
  mmkt: ["money market"],
  mny: ["money"],
  n: ["north"],
  nam: ["north america"],
  pac: ["pacific"],
  pf: ["portfolio"],
  pru: ["prudential"],
  ret: ["retirement"],
  retire: ["retirement"],
  s: ["scheme"],
  sec: ["sector"],
  stb: ["stable"],
  sust: ["sustainable"],
  track: ["tracking"],
  trck: ["tracking"],
  trk: ["tracker"],
  trkg: ["tracking"],
  trkr: ["tracker"],
  "us&hong": ["us & hong"],
  valchce: ["valuechoice"],
  "&": ["and"],
};

function words(text: string) {
  return text.toLowerCase().replace(/[-(),]/gu, " ").split(/\s+/u).filter(Boolean);
}

/** Lipper 基金名入面喺目標名搵唔到嘅詞（經縮寫表展開後）。 */
export function uncoveredWords(lipperFund: string, target: string) {
  const available = new Set(words(target));
  return words(lipperFund).filter(
    (word) => ![word, ...(ABBREVIATIONS[word] ?? [])].some((option) => option.split(" ").every((part) => available.has(part))),
  );
}

export type HkifaLipperMapEntry = {
  lipperName: string;
  fundClassId: string;
  schemeName: string;
  constituentFundName: string;
  fundClassName: string;
  /** 產生對照表時核對過嘅一年值同日期（覆核用）。 */
  verifiedOneYear: number;
  verifiedAsOf: string;
};

export type HkifaLipperMapRejection = { lipperName: string; reason: string };

type PlatformRecord = {
  fundClassId: string;
  identity: { schemeName: string; constituentFundName: string; fundClassName: string };
  returns?: Partial<Record<1 | 3 | 5 | 10, { cumulative?: number; dataAsOf: string }>>;
};

export function proposeHkifaLipperMap(
  rows: HkifaLipperRow[],
  records: PlatformRecord[],
  dataAsOf: string,
): { entries: HkifaLipperMapEntry[]; rejected: HkifaLipperMapRejection[] } {
  const entries: HkifaLipperMapEntry[] = [];
  const rejected: HkifaLipperMapRejection[] = [];
  for (const row of rows) {
    const prefixes = Object.keys(HKIFA_LIPPER_SCHEME_PREFIXES).filter((prefix) => row.name.startsWith(prefix));
    if (prefixes.length !== 1) {
      // 組別標題、平均、基準唔係基金行；其餘有數值嘅行（例如前綴表未有嘅計劃）要記低，唔好靜靜跌咗。
      const hasValues = row.oneYear.length > 0 || row.threeYears.length > 0;
      const notFund = /Average \(\d+\)$/u.test(row.name) || !row.name.includes("-");
      if (hasValues && !notFund)
        rejected.push({ lipperName: row.name, reason: `${prefixes.length} scheme prefixes match` });
      continue;
    }
    const schemeName = HKIFA_LIPPER_SCHEME_PREFIXES[prefixes[0]!]!;
    const fund = row.name.slice(prefixes[0]!.length);
    if (row.oneYear.length !== 1 || !/^-?\d+\.\d{2}$/u.test(row.oneYear[0]!)) {
      rejected.push({ lipperName: row.name, reason: "no two-decimal one-year cell" });
      continue;
    }
    const oneYear = Number(row.oneYear[0]);
    const sameValue = records.filter(
      (record) =>
        record.identity.schemeName === schemeName &&
        record.returns?.[1]?.dataAsOf === dataAsOf &&
        record.returns[1].cumulative === oneYear,
    );
    const named = sameValue.filter(
      (record) =>
        uncoveredWords(fund, `${record.identity.constituentFundName} ${record.identity.fundClassName.replace("n.a.", "")}`).length === 0,
    );
    if (named.length !== 1) {
      rejected.push({
        lipperName: row.name,
        reason:
          sameValue.length === 0
            ? `no ${schemeName} class has platform one-year ${row.oneYear[0]} at ${dataAsOf}`
            : `${sameValue.length} class(es) share one-year ${row.oneYear[0]}, ${named.length} match the name`,
      });
      continue;
    }
    const record = named[0]!;
    entries.push({
      lipperName: row.name,
      fundClassId: record.fundClassId,
      schemeName,
      constituentFundName: record.identity.constituentFundName,
      fundClassName: record.identity.fundClassName,
      verifiedOneYear: oneYear,
      verifiedAsOf: dataAsOf,
    });
  }
  const ids = entries.map((entry) => entry.fundClassId);
  const twice = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (twice.length > 0) throw new Error(`HKIFA Lipper map assigns ${twice.join(", ")} to more than one row`);
  return { entries, rejected };
}
