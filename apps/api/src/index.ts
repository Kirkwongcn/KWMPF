import { Hono } from "hono";
import { cors } from "hono/cors";
import { publicationCache } from "./caching";
import {
  classificationOf,
  comparisonGroupFor,
  comparisonGroupSourceOf,
  type Classification,
} from "./comparison-group";
import {
  evaluateFreshness,
  fundOverviewGraceDays,
  returnsGraceDays,
  type FreshnessPolicy,
} from "./freshness";
import type { PublicationBindings } from "./publication";

type Bindings = PublicationBindings & {
  RELEASE_VERSION: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const SEARCH_RESULT_LIMIT = 50;

app.use("*", cors({ origin: "*", exposeHeaders: ["X-Total-Matches"] }));
app.use("*", publicationCache());

app.get("/health", (context) =>
  context.json({
    status: "ok",
    version: context.env.RELEASE_VERSION,
    bindings: {
      d1: Boolean(context.env.DB),
      r2: Boolean(context.env.RAW_ARCHIVE),
    },
  }),
);

app.get("/fund-classes/:id", async (context) => {
  const row = await context.env.DB.prepare(
    `SELECT f.payload
     FROM current_publication c
     JOIN fund_class_versions f ON f.snapshot_id = c.snapshot_id
     WHERE c.singleton = 1 AND f.fund_class_id = ?`,
  )
    .bind(context.req.param("id"))
    .first<{ payload: string }>();

  if (!row) return context.json({ error: "Fund class not found" }, 404);
  const published = JSON.parse(row.payload) as {
    fundClass: BrowseFundClass;
    provenance: { dataAsOf: string; freshnessPolicy?: FreshnessPolicy };
    // 便覽的配置及十大持倉原文照錄，帶住自己的 `factSheetAsOf`（比平台快照落後幾個月）。
    // 配對唔到或者官方以圖表披露的基金冇呢一段，唔可以留白當零。
    factSheetDisclosure?: FactSheetDisclosure;
  };
  const group = comparisonGroupFor(published.fundClass);
  const fundSizeAsOf = published.fundClass.fundSizeAsOf;
  return context.json({
    ...published,
    comparisonGroup: group.name,
    comparisonGroupSource: group.source,
    freshness: evaluateFreshness(
      published.provenance.dataAsOf,
      returnsGraceDays(published.provenance.freshnessPolicy),
    ),
    // 基金規模按月披露，沿用回報的月度寬限期；成立日期是靜態事實，不設過期。
    ...(fundSizeAsOf
      ? {
          fundSizeFreshness: evaluateFreshness(
            fundSizeAsOf,
            returnsGraceDays(published.provenance.freshnessPolicy),
          ),
        }
      : {}),
  });
});

type FactSheetDisclosure = {
  schemeName: string;
  constituentFundName: string;
  factSheetFile: string;
  factSheetUrl: string;
  // `trustee` 係受託人官網最新一期，`mpfa-registry` 係退回積金局副本，兩者期別唔同。
  factSheetSource: "trustee" | "mpfa-registry";
  factSheetAsOf: string;
  allocations: {
    heading: string;
    entries: { label: string; percent: number }[];
  }[];
  // 官方只列名次同證券名、冇披露持有量時 `percent` 會缺席，唔可以當成 0。
  topHoldings: { rank: number; security: string; percent?: number }[];
  unavailableFields: string[];
  unavailableReasons: Record<string, string>;
  // 原因文字係診斷用的英文長句，網站唔可以靠字串比對反推分類，所以另附代號。
  unavailableKinds: Record<
    string,
    | "not-disclosed"
    | "chart-only"
    | "values-without-names"
    | "overlaid-text-layer"
  >;
};

type BrowseFundClass = {
  id: string;
  fundClassName: string;
  constituentFundName: string;
  schemeName: string;
  trusteeName: string;
  fundType: string;
  fundCategory?: string;
  lipperCategory?: string;
  riskClass?: number;
  fundRiskIndicator?: number;
  annualizedReturn1y?: number;
  managementFee?: number;
  latestFer?: number;
  dataAsOf?: string;
  fundSizeHkdMillion?: number;
  fundSizeAsOf?: string;
  returnsAsOf?: string;
  launchDate?: string;
};

async function loadPublishedFundClasses(
  db: PublicationBindings["DB"],
): Promise<BrowseFundClass[]> {
  const rows = await db
    .prepare(
      `SELECT f.payload
     FROM current_publication c
     JOIN fund_class_versions f ON f.snapshot_id = c.snapshot_id
     WHERE c.singleton = 1`,
    )
    .all<{ payload: string }>();

  return rows.results.map(
    (row) =>
      (JSON.parse(row.payload) as { fundClass: BrowseFundClass }).fundClass,
  );
}

async function loadClassification(
  db: PublicationBindings["DB"],
): Promise<Classification | null> {
  const row = await db
    .prepare(
      `SELECT f.payload
     FROM current_publication c
     JOIN fund_class_versions f ON f.snapshot_id = c.snapshot_id
     WHERE c.singleton = 1
     LIMIT 1`,
    )
    .first<{ payload: string }>();

  return row
    ? classificationOf(
        JSON.parse(row.payload) as { classification?: Classification },
      )
    : null;
}

function knownReturn(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

app.get("/search", async (context) => {
  const query = context.req.query("q")?.trim().toLocaleLowerCase();
  const category = context.req.query("category")?.trim();
  const fundType = context.req.query("fundType")?.trim();
  const fundCategory = context.req.query("fundCategory")?.trim();
  const trustee = context.req.query("trustee")?.trim();
  const riskClassParam = context.req.query("riskClass")?.trim();
  const riskClass = riskClassParam ? Number(riskClassParam) : undefined;

  const hasFilter = Boolean(
    category ||
    fundType ||
    fundCategory ||
    trustee ||
    (riskClass !== undefined && Number.isFinite(riskClass)),
  );
  if (!query && !hasFilter) {
    return context.json([], { headers: { "X-Total-Matches": "0" } });
  }

  const matches = (await loadPublishedFundClasses(context.env.DB)).filter(
    (fundClass) => {
      if (
        query &&
        ![
          fundClass.fundClassName,
          fundClass.constituentFundName,
          fundClass.schemeName,
          fundClass.trusteeName,
        ].some((value) => value.toLocaleLowerCase().includes(query))
      )
        return false;
      if (category && comparisonGroupFor(fundClass).name !== category)
        return false;
      if (fundType && fundClass.fundType !== fundType) return false;
      if (fundCategory && fundClass.fundCategory !== fundCategory) return false;
      if (trustee && fundClass.trusteeName !== trustee) return false;
      if (
        riskClass !== undefined &&
        Number.isFinite(riskClass) &&
        fundClass.riskClass !== riskClass
      )
        return false;
      return true;
    },
  );

  // 先按官方一年年率化回報由高至低排序，讓被截斷的結果仍然是表現最好的一批；
  // 官方未提供回報的基金排在最後，同值再以識別碼穩定排序。
  matches.sort((a, b) => {
    const left = knownReturn(a.annualizedReturn1y);
    const right = knownReturn(b.annualizedReturn1y);
    if (left !== undefined && right !== undefined && left !== right)
      return right - left;
    if ((left === undefined) !== (right === undefined))
      return left === undefined ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  const results = matches.slice(0, SEARCH_RESULT_LIMIT).map((fundClass) => {
    const group = comparisonGroupFor(fundClass);
    return {
      id: fundClass.id,
      fundClassName: fundClass.fundClassName,
      constituentFundName: fundClass.constituentFundName,
      schemeName: fundClass.schemeName,
      trusteeName: fundClass.trusteeName,
      fundType: fundClass.fundType,
      fundCategory: fundClass.fundCategory,
      comparisonGroup: group.name,
      comparisonGroupSource: group.source,
      riskClass: fundClass.riskClass,
      fundRiskIndicator: fundClass.fundRiskIndicator,
      annualizedReturn1y: fundClass.annualizedReturn1y,
      managementFee: fundClass.managementFee,
      latestFer: fundClass.latestFer,
      dataAsOf: fundClass.dataAsOf,
    };
  });

  return context.json(results, {
    headers: { "X-Total-Matches": String(matches.length) },
  });
});

app.get("/filters", async (context) => {
  const current = await context.env.DB.prepare(
    `SELECT snapshot_id FROM current_publication WHERE singleton = 1`,
  ).first<{ snapshot_id: string }>();

  if (!current)
    return context.json({
      snapshotId: null,
      categories: [],
      classification: null,
      fundTypes: [],
      trustees: [],
      riskClasses: [],
    });

  const fundClasses = await loadPublishedFundClasses(context.env.DB);
  const categories = new Set<string>();
  const fundTypes = new Set<string>();
  const trustees = new Set<string>();
  const riskClasses = new Set<number>();

  for (const fundClass of fundClasses) {
    categories.add(comparisonGroupFor(fundClass).name);
    if (fundClass.fundType) fundTypes.add(fundClass.fundType);
    if (fundClass.trusteeName) trustees.add(fundClass.trusteeName);
    if (typeof fundClass.riskClass === "number")
      riskClasses.add(fundClass.riskClass);
  }

  return context.json({
    snapshotId: current.snapshot_id,
    categories: [...categories].sort((a, b) => a.localeCompare(b)),
    classification: await loadClassification(context.env.DB),
    fundTypes: [...fundTypes].sort((a, b) => a.localeCompare(b)),
    trustees: [...trustees].sort((a, b) => a.localeCompare(b)),
    riskClasses: [...riskClasses].sort((a, b) => a - b),
  });
});

app.get("/summary", async (context) => {
  const current = await context.env.DB.prepare(
    `SELECT snapshot_id FROM current_publication WHERE singleton = 1`,
  ).first<{ snapshot_id: string }>();

  if (!current)
    return context.json({
      snapshotId: null,
      fundClassCount: 0,
      schemeCount: 0,
      trusteeCount: 0,
      dataAsOf: null,
    });

  const rows = await context.env.DB.prepare(
    `SELECT payload FROM fund_class_versions WHERE snapshot_id = ?`,
  )
    .bind(current.snapshot_id)
    .all<{ payload: string }>();

  const schemes = new Set<string>();
  const trustees = new Set<string>();
  const dates: string[] = [];
  let fundClassCount = 0;

  for (const row of rows.results) {
    const { fundClass } = JSON.parse(row.payload) as {
      fundClass: {
        schemeName: string;
        trusteeName: string;
        dataAsOf?: string;
        verificationStatus: string;
      };
    };
    if (fundClass.verificationStatus !== "verified") continue;
    fundClassCount += 1;
    schemes.add(fundClass.schemeName);
    trustees.add(fundClass.trusteeName);
    if (fundClass.dataAsOf) dates.push(fundClass.dataAsOf);
  }

  dates.sort();
  return context.json({
    snapshotId: current.snapshot_id,
    fundClassCount,
    schemeCount: schemes.size,
    trusteeCount: trustees.size,
    dataAsOf:
      dates.length > 0
        ? { earliest: dates[0], latest: dates[dates.length - 1] }
        : null,
  });
});

app.get("/schemes", async (context) => {
  const rows = await context.env.DB.prepare(
    `SELECT f.payload
     FROM current_publication c
     JOIN fund_class_versions f ON f.snapshot_id = c.snapshot_id
     WHERE c.singleton = 1`,
  ).all<{ payload: string }>();
  const schemes = new Map<
    string,
    {
      schemeName: string;
      trusteeName: string;
      fundClassCount: number;
      categories: string[];
      fundTypes: string[];
      riskClassDistribution: Record<string, number>;
      managementFees: number[];
      dataAsOfDates: string[];
      factSheet: {
        url: string;
        capturedAt: string;
        registerUrl: string;
      } | null;
      funds: {
        id: string;
        constituentFundName: string;
        fundClassName: string;
        fundType: string;
        comparisonGroup: string;
        riskClass?: number;
        dataAsOf?: string;
        sourceUrl?: string;
        annualizedReturn1y?: number;
        annualizedReturn5y?: number;
        annualizedReturn10y?: number;
      }[];
    }
  >();

  for (const row of rows.results) {
    const { fundClass, provenance, schemeFactSheet } = JSON.parse(
      row.payload,
    ) as {
      provenance?: { sourceUrl?: string };
      schemeFactSheet?: {
        url?: string;
        capturedAt?: string;
        registerUrl?: string;
      };
      fundClass: {
        id: string;
        schemeName: string;
        trusteeName: string;
        constituentFundName: string;
        fundClassName: string;
        fundType: string;
        fundCategory?: string;
        lipperCategory?: string;
        riskClass?: number;
        managementFee?: number;
        dataAsOf?: string;
        annualizedReturn1y?: number;
        annualizedReturn5y?: number;
        annualizedReturn10y?: number;
        verificationStatus: string;
      };
    };
    if (fundClass.verificationStatus !== "verified") continue;
    const scheme = schemes.get(fundClass.schemeName) ?? {
      schemeName: fundClass.schemeName,
      trusteeName: fundClass.trusteeName,
      fundClassCount: 0,
      categories: [],
      fundTypes: [],
      riskClassDistribution: {},
      managementFees: [],
      dataAsOfDates: [],
      factSheet:
        schemeFactSheet?.url &&
        schemeFactSheet.capturedAt &&
        schemeFactSheet.registerUrl
          ? {
              url: schemeFactSheet.url,
              capturedAt: schemeFactSheet.capturedAt,
              registerUrl: schemeFactSheet.registerUrl,
            }
          : null,
      funds: [],
    };
    const comparisonGroup = comparisonGroupFor(fundClass).name;
    scheme.fundClassCount += 1;
    if (!scheme.categories.includes(comparisonGroup))
      scheme.categories.push(comparisonGroup);
    if (!scheme.fundTypes.includes(fundClass.fundType))
      scheme.fundTypes.push(fundClass.fundType);
    if (typeof fundClass.riskClass === "number") {
      const risk = String(fundClass.riskClass);
      scheme.riskClassDistribution[risk] =
        (scheme.riskClassDistribution[risk] ?? 0) + 1;
    }
    if (typeof fundClass.managementFee === "number")
      scheme.managementFees.push(fundClass.managementFee);
    if (fundClass.dataAsOf) scheme.dataAsOfDates.push(fundClass.dataAsOf);
    scheme.funds.push({
      id: fundClass.id,
      constituentFundName: fundClass.constituentFundName,
      fundClassName: fundClass.fundClassName,
      fundType: fundClass.fundType,
      comparisonGroup,
      ...(typeof fundClass.riskClass === "number"
        ? { riskClass: fundClass.riskClass }
        : {}),
      ...(fundClass.dataAsOf ? { dataAsOf: fundClass.dataAsOf } : {}),
      ...(provenance?.sourceUrl ? { sourceUrl: provenance.sourceUrl } : {}),
      ...definedReturns(fundClass),
    });
    schemes.set(fundClass.schemeName, scheme);
  }
  return context.json(
    [...schemes.values()].map(
      ({ managementFees, dataAsOfDates, ...scheme }) => ({
        ...scheme,
        managementFee: summarizeFees(managementFees),
        dataAsOf: summarizeDates(dataAsOfDates),
      }),
    ),
  );
});

function summarizeDates(dates: string[]) {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  return { earliest: sorted[0]!, latest: sorted[sorted.length - 1]! };
}

function definedReturns(fundClass: {
  annualizedReturn1y?: number;
  annualizedReturn5y?: number;
  annualizedReturn10y?: number;
}) {
  return {
    ...(typeof fundClass.annualizedReturn1y === "number"
      ? { annualizedReturn1y: fundClass.annualizedReturn1y }
      : {}),
    ...(typeof fundClass.annualizedReturn5y === "number"
      ? { annualizedReturn5y: fundClass.annualizedReturn5y }
      : {}),
    ...(typeof fundClass.annualizedReturn10y === "number"
      ? { annualizedReturn10y: fundClass.annualizedReturn10y }
      : {}),
  };
}

function summarizeFees(fees: number[]) {
  if (fees.length === 0) return null;
  const sorted = [...fees].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    min: sorted[0]!,
    median:
      sorted.length % 2 === 0
        ? (sorted[middle - 1]! + sorted[middle]!) / 2
        : sorted[middle]!,
    max: sorted[sorted.length - 1]!,
    fundCount: sorted.length,
  };
}

const rankingReturnFields = {
  1: "annualizedReturn1y",
  5: "annualizedReturn5y",
  10: "annualizedReturn10y",
} as const;

type RankingPeriod = keyof typeof rankingReturnFields;

const defaultRankingPeriod = 1 satisfies RankingPeriod;

const rankingMetrics = {
  fee: {
    field: "managementFee",
    methodology: "management_fee",
    sortDirection: "ascending",
    displayPrecision: 2,
    unit: "%",
  },
  // 波幅排序用官方的基金風險指標（年度化標準差），不用風險級別。風險級別只有 1 至 7 級，
  // 451 隻基金擠在 7 個值裡，同組大量並列，達不到 CONTEXT.md 對「較低波幅排序」的定義。
  // 風險級別仍然保留作 `/search?riskClass=` 的篩選條件。
  risk: {
    field: "fundRiskIndicator",
    methodology: "fund_risk_indicator",
    sortDirection: "ascending",
    displayPrecision: 2,
    unit: "%",
  },
} as const;

type RankingMetric = "return" | keyof typeof rankingMetrics;

app.get("/rankings", async (context) => {
  const metric = (context.req.query("metric") ?? "return") as RankingMetric;
  if (metric !== "return" && !(metric in rankingMetrics)) {
    return context.json(
      {
        error: "Unsupported ranking metric",
        supportedMetrics: ["return", "fee", "risk"],
        reason: "回報、費用及風險級別分開排序，網站不會合成單一推薦總分。",
      },
      400,
    );
  }
  const periodParam = context.req.query("period");
  const requested =
    periodParam === undefined ? defaultRankingPeriod : Number(periodParam);
  if (metric === "return" && !(requested in rankingReturnFields)) {
    return context.json(
      {
        error: "Unsupported ranking period",
        supportedPeriods: [1, 5, 10],
        reason:
          "官方強積金基金平台沒有提供三年年率化回報，網站不會自行由其他期間推算。",
      },
      400,
    );
  }
  const periodYears = metric === "return" ? (requested as RankingPeriod) : null;
  const selected =
    metric === "return"
      ? {
          field: rankingReturnFields[periodYears as RankingPeriod],
          methodology: "annualized_return",
          sortDirection: "descending" as const,
          displayPrecision: 2,
          unit: "%",
        }
      : rankingMetrics[metric];
  const valueField = selected.field;
  const rows = await context.env.DB.prepare(
    `SELECT c.snapshot_id, f.payload
     FROM current_publication c
     JOIN fund_class_versions f ON f.snapshot_id = c.snapshot_id
     WHERE c.singleton = 1`,
  ).all<{ snapshot_id: string; payload: string }>();
  const parsed = rows.results.map((row) => ({
    snapshotId: row.snapshot_id,
    publication: JSON.parse(row.payload) as {
      classification?: Classification;
      fundClass: {
        id: string;
        fundClassName: string;
        constituentFundName: string;
        schemeName: string;
        trusteeName: string;
        fundType?: string;
        fundCategory: string;
        lipperCategory?: string;
        annualizedReturn1y?: number;
        annualizedReturn5y?: number;
        annualizedReturn10y?: number;
        managementFee?: number;
        riskClass?: number;
        fundRiskIndicator?: number;
        dataAsOf: string;
        verificationStatus: string;
      };
      provenance: {
        sourceUrl: string;
        dataAsOf: string;
        verificationStatus: string;
        freshnessPolicy?: FreshnessPolicy;
      };
    },
  }));
  const policy = parsed[0]?.publication.provenance.freshnessPolicy;
  const graceDays =
    metric === "return"
      ? returnsGraceDays(policy)
      : fundOverviewGraceDays(policy);
  const evaluatedAt = new Date();
  let excludedStaleCount = 0;
  const eligible = parsed.flatMap(({ snapshotId, publication }) => {
    const value = publication.fundClass[valueField];
    if (
      publication.fundClass.verificationStatus !== "verified" ||
      publication.provenance.verificationStatus !== "verified" ||
      typeof value !== "number" ||
      !Number.isFinite(value)
    ) {
      return [];
    }
    if (
      evaluateFreshness(publication.provenance.dataAsOf, graceDays, evaluatedAt)
        .status !== "verified"
    ) {
      excludedStaleCount += 1;
      return [];
    }
    return [{ snapshotId, publication, value }];
  });
  const groups = Map.groupBy(
    eligible,
    ({ publication }) => comparisonGroupFor(publication.fundClass).name,
  );
  const precision = selected.displayPrecision;
  const direction = selected.sortDirection === "ascending" ? 1 : -1;
  const rankings = [...groups.entries()].flatMap(([comparisonGroup, funds]) => {
    funds.sort((a, b) => {
      const ordered =
        direction *
        (Number(a.value.toFixed(precision)) -
          Number(b.value.toFixed(precision)));
      return ordered !== 0
        ? ordered
        : a.publication.fundClass.id.localeCompare(b.publication.fundClass.id);
    });
    let previousValue: number | undefined;
    let previousRank = 0;
    return funds.map(({ publication, value }, index) => {
      const displayed = Number(value.toFixed(precision));
      const rank = displayed === previousValue ? previousRank : index + 1;
      previousValue = displayed;
      previousRank = rank;
      return {
        fundClassId: publication.fundClass.id,
        fundClassName: publication.fundClass.fundClassName,
        constituentFundName: publication.fundClass.constituentFundName,
        schemeName: publication.fundClass.schemeName,
        trusteeName: publication.fundClass.trusteeName,
        comparisonGroup,
        comparisonGroupSource: comparisonGroupSourceOf(comparisonGroup),
        value,
        displayValue: `${value.toFixed(precision)}${selected.unit}`,
        rank,
        dataAsOf: publication.provenance.dataAsOf,
        sourceUrl: publication.provenance.sourceUrl,
      };
    });
  });

  return context.json({
    snapshotId: rows.results[0]?.snapshot_id ?? null,
    comparisonGroups: [
      ...new Set(
        parsed.map(
          ({ publication }) => comparisonGroupFor(publication.fundClass).name,
        ),
      ),
    ].sort((a, b) => a.localeCompare(b)),
    metric,
    periodYears,
    excludedStaleCount,
    methodology: {
      metric: selected.methodology,
      grouping: "comparison_group",
      classification: classificationOf(parsed[0]?.publication),
      sortDirection: selected.sortDirection,
      displayPrecision: precision,
      freshness: {
        graceDays,
        evaluatedOn: evaluatedAt.toISOString().slice(0, 10),
        rule: "資料截至日期超出官方披露寬限期的數值不參與排名，但仍可在基金詳情頁連同原截至日期查看。",
      },
    },
    rankings,
  });
});

app.notFound((context) => context.json({ error: "Not found" }, 404));

export default app;
