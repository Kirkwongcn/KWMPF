export type LipperFund = {
  category: string;
  sourceName: string;
  seq: number;
};

export type PlatformFundClass = {
  fundClassId: string;
  identity: {
    schemeName: string;
    constituentFundName: string;
    fundClassName: string;
  };
  fundType: string;
};

export type CategoryMapEntry = {
  fundClassId: string;
  lipperCategory: string;
  platformFundType: string;
  matchMethod: "auto" | "alias" | "manual";
  lipperSourceName: string;
  score: number;
};

export type UnmappedFundClass = {
  fundClassId: string;
  schemeName: string;
  constituentFundName: string;
  fundClassName: string;
  platformFundType: string;
  reason: "scheme_not_in_source" | "no_match";
};

export type UnmatchedLipperFund = {
  sourceName: string;
  lipperCategory: string;
  reason: "unknown_scheme" | "no_match";
};

export type CategoryMapResult = {
  entries: CategoryMapEntry[];
  unmappedFundClasses: UnmappedFundClass[];
  unmatchedLipperFunds: UnmatchedLipperFund[];
  reviewRequired: CategoryMapEntry[];
};

export type CategoryMapDiff = {
  added: { fundClassId: string; lipperCategory: string }[];
  removed: { fundClassId: string; lipperCategory: string }[];
  recategorized: { fundClassId: string; from: string; to: string }[];
};

export const ACCEPT_SCORE = 0.55;
export const REVIEW_SCORE = 0.75;

export const schemeAliases: Record<string, string> = {
  "AIA MPF-Prime Value Choice": "AIA MPF - Prime Value Choice",
  "AMTD MPF": "AMTD MPF Scheme",
  "BCOM Joyful Ret MPF": "BCOM Joyful Retirement MPF Scheme",
  "BCT (MPF) Industry Choice": "BCT (MPF) Industry Choice",
  "BCT (MPF) Pro Choice": "BCT (MPF) Pro Choice",
  "BCT MPF S800": "BCT MPF Scheme Series 800",
  "BCT MPF-Simple": "BCT MPF - Simple Plan",
  "BCT MPF-Smart": "BCT MPF - Smart Plan",
  "BCT Strategic MPF": "BCT Strategic MPF Scheme",
  "BEA (MPF) Industry": "BEA (MPF) Industry Scheme",
  "BEA (MPF) MT": "BEA (MPF) Master Trust Scheme",
  "BEA (MPF) Value": "BEA (MPF) Value Scheme",
  "BOC-Pru Easy-Choice MPF": "BOC-Prudential Easy-Choice Mandatory Provident Fund Scheme",
  "China Life MPF MT": "China Life MPF Master Trust Scheme",
  "Fidelity Retirement MT": "Fidelity Retirement Master Trust",
  "HSBC MPF-SuperTrust Plus": "HSBC Mandatory Provident Fund - SuperTrust Plus",
  "Haitong MPF Retire Fd": "Haitong MPF Retirement Fund",
  "Hang Seng MPF-SuperTrust Plus": "Hang Seng Mandatory Provident Fund - SuperTrust Plus",
  "MASS MPF": "MASS Mandatory Provident Fund Scheme",
  "Manulife GS (MPF)": "Manulife Global Select (MPF) Scheme",
  "Manulife RC (MPF)": "Manulife RetireChoice (MPF) Scheme",
  "My Choice MPF": "My Choice Mandatory Provident Fund Scheme",
  "Sun Life Rainbow MPF": "Sun Life Rainbow MPF Scheme",
};

const phraseReplacements: [RegExp, string][] = [
  [/\bn am(er)?\b/g, "north america"],
  [/\bus and hong kong\b/g, "united states hong kong"],
  [/\bhk\b/g, "hong kong"],
  [/\bhs\b/g, "hang seng"],
  [/\bmmkt\b/g, "money market"],
  [/\bmny mkt\b/g, "money market"],
  [/\basiapac\b/g, "asia pacific"],
  [/\bas ?pc\b/g, "asia pacific"],
  [/\bmulti sec\b/g, "multi sector"],
  [/\bretire fd\b/g, "retirement fund"],
  [/\bind s\b/g, "industry"],
  [/\bpol bk\b/g, "policy bank"],
  [/\bstb gr\b/g, "stable growth"],
  [/\bdyn asset allo\b/g, "dynamic asset allocation"],
];

const tokenReplacements: Record<string, string> = {
  eq: "equity",
  equities: "equity",
  bd: "bond",
  bds: "bond",
  gr: "greater",
  gl: "global",
  acc: "accumulation",
  idx: "index",
  trk: "tracking",
  trkg: "tracking",
  tracker: "tracking",
  amer: "america",
  americas: "america",
  europn: "european",
  europe: "european",
  diversif: "diversification",
  pru: "prudential",
  crbon: "carbon",
  ret: "retirement",
  sec: "sector",
  us: "united states",
  mgd: "managed",
  intl: "international",
  cons: "conservative",
  consv: "conservative",
  eqty: "equity",
  grtr: "greater",
  ind: "industry",
  valchce: "valuechoice",
  trkr: "tracking",
  trck: "tracking",
  etprs: "enterprises",
  eu: "european",
  euro: "european",
  mix: "mixed",
  asst: "asset",
  pf: "portfolio",
  gv: "government",
  cn: "china",
};

const stopWords = new Set(["fund", "funds", "scheme", "plan", "the", "of", "and"]);

export function normalizeFundName(value: string) {
  const base = value
    .normalize("NFKC")
    .replace(/&/g, " and ")
    .replace(/[^0-9a-zA-Z]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
  const phrased = phraseReplacements.reduce((text, [pattern, value]) => text.replace(pattern, value), base);
  return phrased
    .split(" ")
    .flatMap((token) => (tokenReplacements[token] ?? token).split(" "))
    .filter((token) => token.length > 0 && !stopWords.has(token) && !/^[a-z]$/.test(token));
}

function tokensMatch(left: string, right: string) {
  if (left === right) return true;
  const [short, long] = left.length <= right.length ? [left, right] : [right, left];
  return short.length >= 4 && long.startsWith(short);
}

export function nameSimilarity(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) return 0;
  const available = [...right];
  let matched = 0;
  for (const token of left) {
    const index = available.findIndex((candidate) => tokensMatch(token, candidate));
    if (index >= 0) {
      matched += 1;
      available.splice(index, 1);
    }
  }
  return (2 * matched) / (left.length + right.length);
}

export function splitLipperName(sourceName: string) {
  const scheme = Object.keys(schemeAliases)
    .filter((label) => sourceName === label || sourceName.startsWith(`${label}-`))
    .sort((left, right) => right.length - left.length)[0];
  if (!scheme) return undefined;
  const remainder = sourceName.slice(scheme.length).replace(/^-/, "");
  const classMatch = remainder.match(/\s([A-Z])$/);
  return {
    schemeLabel: scheme,
    platformSchemeName: schemeAliases[scheme]!,
    fundName: classMatch ? remainder.slice(0, -2) : remainder,
    classLetter: classMatch?.[1],
  };
}

export function platformClassLetter(fundClassName: string) {
  const match = fundClassName.match(/(?:unit\s+)?class\s+([A-Z])$/i);
  return match?.[1]?.toLocaleUpperCase();
}

export type CategoryMapOptions = {
  fundAliases?: Record<string, string>;
  manualOverrides?: Record<string, string>;
};

export function buildLipperCategoryMap(
  lipperFunds: LipperFund[],
  fundClasses: PlatformFundClass[],
  options: CategoryMapOptions = {},
): CategoryMapResult {
  const fundAliases = options.fundAliases ?? {};
  const manualOverrides = options.manualOverrides ?? {};
  const byId = new Map(fundClasses.map((fundClass) => [fundClass.fundClassId, fundClass]));
  const entries: CategoryMapEntry[] = [];
  const unmatchedLipperFunds: UnmatchedLipperFund[] = [];
  const claimed = new Set<string>();
  const pending: {
    fund: LipperFund;
    tokens: string[];
    classLetter?: string;
    platformSchemeName: string;
    matchMethod: "auto" | "alias";
  }[] = [];

  for (const fund of lipperFunds) {
    const overrideId = manualOverrides[fund.sourceName];
    if (overrideId) {
      const fundClass = byId.get(overrideId);
      if (!fundClass) throw new Error(`manual override points at unknown fundClassId: ${overrideId}`);
      if (claimed.has(overrideId)) throw new Error(`manual override reuses fundClassId: ${overrideId}`);
      claimed.add(overrideId);
      entries.push({
        fundClassId: overrideId,
        lipperCategory: fund.category,
        platformFundType: fundClass.fundType,
        matchMethod: "manual",
        lipperSourceName: fund.sourceName,
        score: 1,
      });
      continue;
    }
    const split = splitLipperName(fund.sourceName);
    if (!split) {
      unmatchedLipperFunds.push({
        sourceName: fund.sourceName,
        lipperCategory: fund.category,
        reason: "unknown_scheme",
      });
      continue;
    }
    const alias = fundAliases[fund.sourceName];
    pending.push({
      fund,
      tokens: normalizeFundName(alias ?? split.fundName),
      classLetter: split.classLetter,
      platformSchemeName: split.platformSchemeName,
      matchMethod: alias ? "alias" : "auto",
    });
  }

  const candidates = pending.flatMap((item, index) =>
    fundClasses
      .filter(
        (fundClass) =>
          fundClass.identity.schemeName === item.platformSchemeName &&
          platformClassLetter(fundClass.identity.fundClassName) === item.classLetter,
      )
      .map((fundClass) => ({
        index,
        fundClass,
        score: nameSimilarity(item.tokens, normalizeFundName(fundClass.identity.constituentFundName)),
      })),
  );

  const assigned = new Set<number>();
  for (const candidate of candidates.sort((left, right) => right.score - left.score)) {
    if (candidate.score < ACCEPT_SCORE) break;
    if (assigned.has(candidate.index) || claimed.has(candidate.fundClass.fundClassId)) continue;
    const item = pending[candidate.index]!;
    assigned.add(candidate.index);
    claimed.add(candidate.fundClass.fundClassId);
    entries.push({
      fundClassId: candidate.fundClass.fundClassId,
      lipperCategory: item.fund.category,
      platformFundType: candidate.fundClass.fundType,
      matchMethod: item.matchMethod,
      lipperSourceName: item.fund.sourceName,
      score: Number(candidate.score.toFixed(4)),
    });
  }

  for (const [index, item] of pending.entries()) {
    if (assigned.has(index)) continue;
    unmatchedLipperFunds.push({
      sourceName: item.fund.sourceName,
      lipperCategory: item.fund.category,
      reason: "no_match",
    });
  }

  const knownSchemes = new Set(Object.values(schemeAliases));
  const unmappedFundClasses = fundClasses
    .filter((fundClass) => !claimed.has(fundClass.fundClassId))
    .map((fundClass) => ({
      fundClassId: fundClass.fundClassId,
      schemeName: fundClass.identity.schemeName,
      constituentFundName: fundClass.identity.constituentFundName,
      fundClassName: fundClass.identity.fundClassName,
      platformFundType: fundClass.fundType,
      reason: knownSchemes.has(fundClass.identity.schemeName)
        ? ("no_match" as const)
        : ("scheme_not_in_source" as const),
    }));

  return {
    entries: entries.sort((left, right) => left.fundClassId.localeCompare(right.fundClassId)),
    unmappedFundClasses,
    unmatchedLipperFunds,
    reviewRequired: entries.filter((entry) => entry.matchMethod === "auto" && entry.score < REVIEW_SCORE),
  };
}

export function diffCategoryMaps(previous: CategoryMapEntry[], next: CategoryMapEntry[]): CategoryMapDiff {
  const before = new Map(previous.map((entry) => [entry.fundClassId, entry]));
  const after = new Map(next.map((entry) => [entry.fundClassId, entry]));
  return {
    added: next
      .filter((entry) => !before.has(entry.fundClassId))
      .map((entry) => ({ fundClassId: entry.fundClassId, lipperCategory: entry.lipperCategory })),
    removed: previous
      .filter((entry) => !after.has(entry.fundClassId))
      .map((entry) => ({ fundClassId: entry.fundClassId, lipperCategory: entry.lipperCategory })),
    recategorized: next.flatMap((entry) => {
      const earlier = before.get(entry.fundClassId);
      if (!earlier || earlier.lipperCategory === entry.lipperCategory) return [];
      return [{ fundClassId: entry.fundClassId, from: earlier.lipperCategory, to: entry.lipperCategory }];
    }),
  };
}

export function categoryMapRequiresReview(result: CategoryMapResult, diff: CategoryMapDiff) {
  return (
    result.unmatchedLipperFunds.length > 0 ||
    result.reviewRequired.length > 0 ||
    diff.added.length > 0 ||
    diff.removed.length > 0 ||
    diff.recategorized.length > 0
  );
}
