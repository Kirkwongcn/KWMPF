import { Hono } from "hono";
import { cors } from "hono/cors";
import { publicationCache } from "./caching";
import { matchesSearch, positiveInteger } from "./search";
import { buildDataQuality } from "./data-quality";
import {
  classificationOf,
  comparisonGroupFor,
  comparisonGroupSourceOf,
  UNCLASSIFIED_GROUP,
} from "./comparison-group";
import {
  MPFA_FUND_TYPES,
  mpfaFundTypeByName,
} from "../../../packages/coverage/src/mpfa-fund-type";
import {
  evaluateFreshness,
  fundOverviewGraceDays,
  returnsGraceDays,
  returnGraceDaysForPeriod,
  type FreshnessPolicy,
  type PublishedFreshness,
} from "./freshness";
import type { PublicationBindings } from "./publication";
import {
  FEATURE_KEYS,
  MIN_PEERS,
  daysSinceLaunch,
  featurePosition,
  type FeatureKey,
  type FeaturePeer,
} from "./fund-features";
import { interpretFund } from "../../../packages/coverage/src/fund-interpretation";
import type { ComparisonGroupSourceDates } from "../../../packages/coverage/src/comparison-group-stats";
import type { PublishedFactSheetPayload } from "../../../packages/coverage/src/fact-sheet-published";

type Bindings = PublicationBindings & {
  RELEASE_VERSION: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const SEARCH_RESULT_LIMIT = 50;

app.use(
  "*",
  cors({
    origin: "*",
    exposeHeaders: [
      "X-Total-Matches",
      "X-Page",
      "X-Page-Size",
      "X-Snapshot-Id",
      "X-Search-Sort",
      "ETag",
      "Cache-Control",
    ],
  }),
);
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
  // 基金分類只用積金局基金類型（ADR 0011）：舊快照可能仍帶 Lipper 分類或三桶歸類，一律唔再輸出。
  const {
    mappedAllocation: _mappedAllocation,
    classification: _classification,
    ...publication
  } = published as typeof published & {
    mappedAllocation?: unknown;
    classification?: unknown;
  };
  const { lipperCategory: _lipperCategory, ...fundClass } =
    published.fundClass as BrowseFundClass & {
      lipperCategory?: string;
    };
  const group = comparisonGroupFor(published.fundClass);
  const fundSizeAsOf = published.fundClass.fundSizeAsOf;
  return context.json({
    ...publication,
    fundClass,
    comparisonGroup: group.name,
    comparisonGroupSource: group.source,
    comparisonGroupFamily: group.family,
    classification: classificationOf(),
    freshness: evaluateFreshness(
      published.fundClass.returnSources?.["1"]?.dataAsOf ??
        published.fundClass.returnsAsOf ??
        published.provenance.dataAsOf,
      returnsGraceDays(published.provenance.freshnessPolicy),
    ),
    returnsFreshness: returnsFreshnessOf(
      published.fundClass,
      published.provenance,
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

type FactSheetDisclosure = PublishedFactSheetPayload;

type FundFreshnessProvenance = {
  dataAsOf?: string;
  freshnessPolicy?: FreshnessPolicy;
};

const RETURN_PERIODS = [1, 3, 5, 10] as const;

// 每個回報期間按自己的截至日期及寬限期判斷時效，唔可以用一年期日期代表全部。
function returnsFreshnessOf(
  fundClass: BrowseFundClass,
  provenance: FundFreshnessProvenance | undefined,
  evaluatedAt?: Date,
) {
  return Object.fromEntries(
    RETURN_PERIODS.flatMap((period) => {
      const field = `annualizedReturn${period}y` as const;
      if (typeof fundClass[field] !== "number") return [];
      const dataAsOf =
        fundClass.returnSources?.[String(period)]?.dataAsOf ??
        fundClass.returnsAsOf ??
        provenance?.dataAsOf;
      if (!dataAsOf) return [];
      return [
        [
          String(period),
          evaluateFreshness(
            dataAsOf,
            returnGraceDaysForPeriod(provenance?.freshnessPolicy, period),
            evaluatedAt,
          ),
        ],
      ];
    }),
  );
}

type BrowseFundClass = {
  id: string;
  fundClassName: string;
  constituentFundName: string;
  schemeName: string;
  trusteeName: string;
  fundType: string;
  fundCategory?: string;
  riskClass?: number;
  fundRiskIndicator?: number;
  annualizedReturn1y?: number;
  annualizedReturn3y?: number;
  annualizedReturn5y?: number;
  annualizedReturn10y?: number;
  managementFee?: number;
  feeCaps?: string[];
  latestFer?: number;
  dataAsOf?: string;
  fundSizeHkdMillion?: number;
  fundSizeAsOf?: string;
  returnsAsOf?: string;
  returnSources?: Record<string, { dataAsOf: string; sourceUrl: string }>;
  launchDate?: string;
  isDisComponent?: "core_accumulation" | "age65_plus";
  verificationStatus: string;
};

type PublishedFundPayload = {
  fundClass: BrowseFundClass & { unavailableFields?: string[] };
  factSheetDisclosure?: FactSheetDisclosure;
  provenance: { sourceUrl: string; dataAsOf: string };
};

function top10Concentration(
  disclosure: FactSheetDisclosure | undefined,
): number | undefined {
  if (
    !disclosure ||
    disclosure.unavailableFields.includes("topHoldings") ||
    disclosure.topHoldings.length === 0 ||
    disclosure.topHoldings.some(
      (holding) =>
        typeof holding.percent !== "number" ||
        !Number.isFinite(holding.percent),
    )
  ) {
    return undefined;
  }
  return Number(
    disclosure.topHoldings
      .reduce((sum, holding) => sum + holding.percent!, 0)
      .toFixed(2),
  );
}

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

type PublishedSearchFund = {
  fundClass: BrowseFundClass;
  provenance?: {
    sourceUrl?: string;
    dataAsOf?: string;
    retrievedAt?: string;
    verificationStatus?: string;
    freshnessPolicy?: FreshnessPolicy;
  };
};

async function loadPublishedSearchFunds(
  db: PublicationBindings["DB"],
): Promise<PublishedSearchFund[]> {
  const rows = await db
    .prepare(
      `SELECT f.payload
       FROM current_publication c
       JOIN fund_class_versions f ON f.snapshot_id = c.snapshot_id
       WHERE c.singleton = 1`,
    )
    .all<{ payload: string }>();

  return rows.results.map(
    (row) => JSON.parse(row.payload) as PublishedSearchFund,
  );
}

function knownReturn(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

type NumericFundField =
  | "annualizedReturn1y"
  | "annualizedReturn3y"
  | "annualizedReturn5y"
  | "annualizedReturn10y"
  | "managementFee"
  | "latestFer"
  | "fundRiskIndicator"
  | "riskClass"
  | "fundSizeHkdMillion";

// 每個排序鍵的預設方向：回報及規模由高至低，收費、波幅及風險級別由低至高。
// 方向只係排列次序，唔代表好壞。
const SEARCH_SORTS: Record<
  string,
  { field: NumericFundField; order: "asc" | "desc"; period?: number }
> = {
  return: { field: "annualizedReturn1y", order: "desc", period: 1 },
  return3y: { field: "annualizedReturn3y", order: "desc", period: 3 },
  return5y: { field: "annualizedReturn5y", order: "desc", period: 5 },
  return10y: { field: "annualizedReturn10y", order: "desc", period: 10 },
  fee: { field: "managementFee", order: "asc" },
  fer: { field: "latestFer", order: "asc" },
  volatility: { field: "fundRiskIndicator", order: "asc" },
  risk: { field: "riskClass", order: "asc" },
  size: { field: "fundSizeHkdMillion", order: "desc" },
};

app.get("/search", async (context) => {
  const query = context.req.query("q")?.trim() ?? "";
  const page = positiveInteger(context.req.query("page"), 1, 10000);
  const pageSize = positiveInteger(
    context.req.query("pageSize"),
    SEARCH_RESULT_LIMIT,
    100,
  );
  const sort = context.req.query("sort") ?? "name";
  const orderParam = context.req.query("order");
  if (
    query.length > 120 ||
    page === null ||
    pageSize === null ||
    !(sort === "name" || Object.hasOwn(SEARCH_SORTS, sort)) ||
    (orderParam !== undefined && orderParam !== "asc" && orderParam !== "desc")
  )
    return context.json(
      {
        error: "Invalid search parameters",
        reason: "請使用 120 字以內關鍵字、有效頁碼及排序方式。",
      },
      400,
    );
  const category = context.req.query("category")?.trim();
  const family = context.req.query("family")?.trim();
  const fundType = context.req.query("fundType")?.trim();
  const fundCategory = context.req.query("fundCategory")?.trim();
  const trustee = context.req.query("trustee")?.trim();
  const riskClassParam = context.req.query("riskClass")?.trim();
  const riskClass = riskClassParam ? Number(riskClassParam) : undefined;
  if (
    riskClass !== undefined &&
    (!Number.isInteger(riskClass) || riskClass < 1 || riskClass > 7)
  )
    return context.json({ error: "Invalid risk class" }, 400);

  const evaluatedAt = new Date();
  const matches = (await loadPublishedSearchFunds(context.env.DB))
    .filter(
      (published) =>
        published.fundClass.verificationStatus === "verified" &&
        published.provenance?.verificationStatus === "verified",
    )
    .map((published) => {
      const dataAsOf =
        published.fundClass.returnSources?.["1"]?.dataAsOf ??
        published.fundClass.returnsAsOf ??
        published.provenance?.dataAsOf ??
        published.fundClass.dataAsOf;
      return {
        fundClass: published.fundClass,
        freshness: dataAsOf
          ? evaluateFreshness(
              dataAsOf,
              returnsGraceDays(published.provenance?.freshnessPolicy),
              evaluatedAt,
            )
          : undefined,
        returnsFreshness: returnsFreshnessOf(
          published.fundClass,
          published.provenance,
          evaluatedAt,
        ),
        // 基金規模按月披露，沿用回報的月度寬限期（ADR 0010）。
        fundSizeFreshness: published.fundClass.fundSizeAsOf
          ? evaluateFreshness(
              published.fundClass.fundSizeAsOf,
              returnsGraceDays(published.provenance?.freshnessPolicy),
              evaluatedAt,
            )
          : undefined,
      };
    })
    .filter(({ fundClass }) => {
      if (
        query &&
        !matchesSearch(query, [
          fundClass.fundClassName,
          fundClass.constituentFundName,
          fundClass.schemeName,
          fundClass.trusteeName,
        ])
      )
        return false;
      if (category && comparisonGroupFor(fundClass).name !== category)
        return false;
      if (family && comparisonGroupFor(fundClass).family !== family)
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
    });

  // 名稱是中性的預設排序；指標排序由使用者選擇，搜尋不構成跨組推薦。
  // 指標排序：符合時效的數值先排，過期數值其次，官方未提供排最後。
  const sortSpec = sort === "name" ? undefined : SEARCH_SORTS[sort];
  const descending =
    sortSpec !== undefined &&
    (orderParam ? orderParam === "desc" : sortSpec.order === "desc");
  const tierOf = (entry: (typeof matches)[number]) => {
    if (!sortSpec) return 0;
    if (knownReturn(entry.fundClass[sortSpec.field]) === undefined) return 2;
    if (sortSpec.field === "fundSizeHkdMillion")
      return entry.fundSizeFreshness?.status === "verified" ? 0 : 1;
    return sortSpec.period !== undefined &&
      entry.returnsFreshness[String(sortSpec.period)]?.status !== "verified"
      ? 1
      : 0;
  };
  matches.sort((a, b) => {
    if (sortSpec) {
      const tier = tierOf(a) - tierOf(b);
      if (tier !== 0) return tier;
      const left = knownReturn(a.fundClass[sortSpec.field]);
      const right = knownReturn(b.fundClass[sortSpec.field]);
      if (left !== undefined && right !== undefined && left !== right)
        return descending ? right - left : left - right;
    }
    const byName = a.fundClass.constituentFundName.localeCompare(
      b.fundClass.constituentFundName,
    );
    if (byName !== 0) return byName;
    return a.fundClass.id.localeCompare(b.fundClass.id);
  });

  const results = matches
    .slice((page - 1) * pageSize, page * pageSize)
    .map(({ fundClass, freshness, returnsFreshness, fundSizeFreshness }) => {
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
        comparisonGroupFamily: group.family,
        riskClass: fundClass.riskClass,
        fundRiskIndicator: fundClass.fundRiskIndicator,
        annualizedReturn1y: fundClass.annualizedReturn1y,
        annualizedReturn3y: fundClass.annualizedReturn3y,
        annualizedReturn5y: fundClass.annualizedReturn5y,
        annualizedReturn10y: fundClass.annualizedReturn10y,
        returnsFreshness,
        managementFee: fundClass.managementFee,
        feeCaps: fundClass.feeCaps,
        latestFer: fundClass.latestFer,
        fundSizeHkdMillion: fundClass.fundSizeHkdMillion,
        fundSizeAsOf: fundClass.fundSizeAsOf,
        ...(fundSizeFreshness ? { fundSizeFreshness } : {}),
        launchDate: fundClass.launchDate,
        dataAsOf: fundClass.dataAsOf,
        ...(freshness ? { freshness } : {}),
      };
    });

  return context.json(results, {
    headers: {
      "X-Total-Matches": String(matches.length),
      "X-Page": String(page),
      "X-Page-Size": String(pageSize),
      "X-Search-Sort": sort,
    },
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
      families: [],
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
    const group = comparisonGroupFor(fundClass).name;
    if (group !== UNCLASSIFIED_GROUP) categories.add(group);
    if (fundClass.fundType) fundTypes.add(fundClass.fundType);
    if (fundClass.trusteeName) trustees.add(fundClass.trusteeName);
    if (typeof fundClass.riskClass === "number")
      riskClasses.add(fundClass.riskClass);
  }

  return context.json({
    snapshotId: current.snapshot_id,
    // 積金局基金平台自己的次序（股票、債券、混合資產、保證、貨幣市場）。
    categories: MPFA_FUND_TYPES.map((type) => type.zh).filter((name) =>
      categories.has(name),
    ),
    families: [
      ...new Set(
        MPFA_FUND_TYPES.filter((type) => categories.has(type.zh)).map(
          (type) => type.family.zh,
        ),
      ),
    ],
    classification: classificationOf(),
    fundTypes: [...fundTypes].sort(),
    trustees: [...trustees].sort(),
    riskClasses: [...riskClasses].sort((a, b) => a - b),
  });
});

type ComparisonGroupStatsRow = {
  comparison_group: string;
  avg_allocation: string | null;
  avg_top10_concentration: number | null;
  avg_volatility_3y: number | null;
  fund_count: number;
  allocation_count: number;
  top10_count: number;
  volatility_count: number;
  insufficient_sample: number;
  source_dates: string | null;
};

function publishedComparisonGroupStats(row: ComparisonGroupStatsRow) {
  const sourceDates = row.source_dates
    ? (JSON.parse(row.source_dates) as Partial<ComparisonGroupSourceDates>)
    : null;
  const completeSourceDates =
    sourceDates?.top10Concentration && sourceDates.volatility3y
      ? {
          top10Concentration: sourceDates.top10Concentration,
          volatility3y: sourceDates.volatility3y,
        }
      : null;
  return {
    comparisonGroup: row.comparison_group,
    comparisonGroupSource: comparisonGroupSourceOf(row.comparison_group),
    avgTop10Concentration: row.avg_top10_concentration,
    avgVolatility3y: row.avg_volatility_3y,
    fundCount: row.fund_count,
    top10Count: row.top10_count,
    volatilityCount: row.volatility_count,
    insufficientSample: row.insufficient_sample === 1,
    ...(completeSourceDates ? { sourceDates: completeSourceDates } : {}),
  };
}

app.get("/fund-classes/:id/interpretation", async (context) => {
  if (
    context.req.query("period") !== undefined ||
    context.req.query("startMonth") !== undefined ||
    context.req.query("endMonth") !== undefined
  ) {
    return context.json(
      {
        error: "Interpretation periods are not supported",
        reason:
          "十大持倉集中度及三年波幅均為發布快照當期資料，不會隨回報期間改變。",
      },
      400,
    );
  }
  const row = await context.env.DB.prepare(
    `SELECT c.snapshot_id, f.payload
     FROM current_publication c
     JOIN fund_class_versions f ON f.snapshot_id = c.snapshot_id
     WHERE c.singleton = 1 AND f.fund_class_id = ?`,
  )
    .bind(context.req.param("id"))
    .first<{ snapshot_id: string; payload: string }>();

  if (!row) return context.json({ error: "Fund class not found" }, 404);

  const published = JSON.parse(row.payload) as PublishedFundPayload;
  const comparisonGroup = comparisonGroupFor(published.fundClass);
  const stats = await context.env.DB.prepare(
    `SELECT comparison_group, avg_allocation, avg_top10_concentration, avg_volatility_3y,
            fund_count, allocation_count, top10_count, volatility_count, insufficient_sample, source_dates
     FROM comparison_group_stats
     WHERE snapshot_id = ? AND comparison_group = ?`,
  )
    .bind(row.snapshot_id, comparisonGroup.name)
    .first<ComparisonGroupStatsRow>();

  if (!stats) {
    return context.json(
      { error: "Comparison group statistics not found" },
      404,
    );
  }

  const group = publishedComparisonGroupStats(stats);
  const values = {
    top10Concentration: top10Concentration(published.factSheetDisclosure),
    volatility3y: published.fundClass.unavailableFields?.includes(
      "fundRiskIndicator",
    )
      ? undefined
      : published.fundClass.fundRiskIndicator,
  };
  const interpretation = interpretFund(values, {
    comparisonGroup: group.comparisonGroup,
    avgTop10Concentration: group.avgTop10Concentration,
    avgVolatility3y: group.avgVolatility3y,
    fundCount: group.fundCount,
    top10Count: group.top10Count,
    volatilityCount: group.volatilityCount,
    insufficientSample: group.insufficientSample,
  });
  const disclosure = published.factSheetDisclosure;
  const factsheetSourceLabel =
    disclosure?.factSheetSource === "trustee"
      ? "受託人基金便覽"
      : disclosure?.factSheetSource === "mpfa-registry"
        ? "積金局登記冊基金便覽"
        : "基金便覽來源未提供";
  const groupSourceDates = group.sourceDates;

  return context.json({
    snapshotId: row.snapshot_id,
    fundClassId: published.fundClass.id,
    comparisonGroup: comparisonGroup.name,
    comparisonGroupSource: comparisonGroup.source,
    values: {
      top10Concentration: {
        fund: values.top10Concentration ?? null,
        groupAverage: group.avgTop10Concentration,
      },
      volatility3y: {
        fund: values.volatility3y ?? null,
        groupAverage: group.avgVolatility3y,
      },
    },
    provenance: {
      top10Concentration: {
        fundSourceLabel: factsheetSourceLabel,
        fundSourceUrl: disclosure?.factSheetUrl ?? null,
        fundFieldAsOf:
          disclosure?.temporalScopes?.topHoldings?.kind === "point-in-time"
            ? disclosure.temporalScopes.topHoldings.asOf
            : null,
        fundDocumentAsOf: disclosure?.factSheetAsOf ?? null,
        groupSourceLabel: "同組已核實基金便覽樣本（來源各異）",
        groupSampleCount: group.top10Count,
        groupMemberCount: group.fundCount,
        groupSampleDates: groupSourceDates?.top10Concentration ?? null,
      },
      volatility3y: {
        fundSourceLabel: "積金局基金平台",
        fundSourceUrl: published.provenance.sourceUrl,
        fundFieldAsOf: published.provenance.dataAsOf,
        fundDocumentAsOf: null,
        groupSourceLabel: "積金局基金平台快照",
        groupSampleCount: group.volatilityCount,
        groupMemberCount: group.fundCount,
        groupSampleDates: groupSourceDates?.volatility3y ?? null,
      },
    },
    interpretation,
  });
});

app.get("/comparison-group-stats", async (context) => {
  const current = await context.env.DB.prepare(
    `SELECT snapshot_id FROM current_publication WHERE singleton = 1`,
  ).first<{ snapshot_id: string }>();

  if (!current) {
    return context.json({ snapshotId: null, groups: [] });
  }

  const requested = context.req.query("comparisonGroup")?.trim();
  const rows = await context.env.DB.prepare(
    requested
      ? `SELECT comparison_group, avg_allocation, avg_top10_concentration, avg_volatility_3y,
                fund_count, allocation_count, top10_count, volatility_count, insufficient_sample, source_dates
         FROM comparison_group_stats
         WHERE snapshot_id = ? AND comparison_group = ?
         ORDER BY comparison_group`
      : `SELECT comparison_group, avg_allocation, avg_top10_concentration, avg_volatility_3y,
                fund_count, allocation_count, top10_count, volatility_count, insufficient_sample, source_dates
         FROM comparison_group_stats
         WHERE snapshot_id = ?
         ORDER BY comparison_group`,
  )
    .bind(
      ...(requested ? [current.snapshot_id, requested] : [current.snapshot_id]),
    )
    .all<ComparisonGroupStatsRow>();

  // 依積金局基金平台的類型次序，而唔係字碼次序。
  const order = new Map(MPFA_FUND_TYPES.map((type, index) => [type.zh, index]));
  // 舊快照可能仍有 Lipper／「平台分類：」組別的統計；只輸出積金局基金類型，避免把非官方分類標成官方。
  const groups = rows.results
    .filter((row) => mpfaFundTypeByName(row.comparison_group) !== undefined)
    .map(publishedComparisonGroupStats)
    .sort(
      (left, right) =>
        (order.get(left.comparisonGroup) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right.comparisonGroup) ?? Number.MAX_SAFE_INTEGER),
    );
  if (requested && groups.length === 0) {
    return context.json({ error: "Comparison group not found" }, 404);
  }
  return context.json({ snapshotId: current.snapshot_id, groups });
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

app.get("/data-quality", async (context) => {
  const rows = await context.env.DB.prepare(
    `SELECT c.snapshot_id, f.payload FROM current_publication c JOIN fund_class_versions f ON f.snapshot_id = c.snapshot_id WHERE c.singleton = 1`,
  ).all<{ snapshot_id: string; payload: string }>();
  return context.json(
    buildDataQuality(
      rows.results.map((row) => JSON.parse(row.payload) as PublishedSearchFund),
      rows.results[0]?.snapshot_id ?? null,
    ),
  );
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
      latestFers: number[];
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
        fundRiskIndicator?: number;
        managementFee?: number;
        feeCaps?: string[];
        latestFer?: number;
        dataAsOf?: string;
        sourceUrl?: string;
        annualizedReturn1y?: number;
        annualizedReturn3y?: number;
        annualizedReturn5y?: number;
        annualizedReturn10y?: number;
        returnSources?: Record<
          string,
          { dataAsOf: string; sourceUrl?: string; retrievedAt?: string }
        >;
        returnsFreshness?: Record<string, PublishedFreshness>;
      }[];
    }
  >();
  const evaluatedAt = new Date();

  for (const row of rows.results) {
    const { fundClass, provenance, schemeFactSheet } = JSON.parse(
      row.payload,
    ) as {
      provenance?: {
        sourceUrl?: string;
        freshnessPolicy?: FreshnessPolicy;
      };
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
        riskClass?: number;
        fundRiskIndicator?: number;
        managementFee?: number;
        feeCaps?: string[];
        latestFer?: number;
        dataAsOf?: string;
        annualizedReturn1y?: number;
        annualizedReturn3y?: number;
        annualizedReturn5y?: number;
        annualizedReturn10y?: number;
        returnsAsOf?: string;
        returnSources?: Record<
          string,
          { dataAsOf: string; sourceUrl?: string; retrievedAt?: string }
        >;
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
      latestFers: [],
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
    if (typeof fundClass.latestFer === "number")
      scheme.latestFers.push(fundClass.latestFer);
    if (fundClass.dataAsOf) scheme.dataAsOfDates.push(fundClass.dataAsOf);
    const returnValues = {
      "1": fundClass.annualizedReturn1y,
      "3": fundClass.annualizedReturn3y,
      "5": fundClass.annualizedReturn5y,
      "10": fundClass.annualizedReturn10y,
    };
    const returnsFreshness = Object.fromEntries(
      Object.entries(returnValues).flatMap(([period, value]) => {
        if (typeof value !== "number") return [];
        const dataAsOf =
          fundClass.returnSources?.[period]?.dataAsOf ??
          fundClass.returnsAsOf ??
          fundClass.dataAsOf;
        return dataAsOf
          ? [
              [
                period,
                evaluateFreshness(
                  dataAsOf,
                  returnGraceDaysForPeriod(
                    provenance?.freshnessPolicy,
                    Number(period),
                  ),
                  evaluatedAt,
                ),
              ],
            ]
          : [];
      }),
    );
    scheme.funds.push({
      id: fundClass.id,
      constituentFundName: fundClass.constituentFundName,
      fundClassName: fundClass.fundClassName,
      fundType: fundClass.fundType,
      comparisonGroup,
      ...(typeof fundClass.riskClass === "number"
        ? { riskClass: fundClass.riskClass }
        : {}),
      ...(typeof fundClass.fundRiskIndicator === "number"
        ? { fundRiskIndicator: fundClass.fundRiskIndicator }
        : {}),
      ...(typeof fundClass.managementFee === "number"
        ? {
            managementFee: fundClass.managementFee,
            ...(fundClass.feeCaps ? { feeCaps: fundClass.feeCaps } : {}),
          }
        : {}),
      ...(typeof fundClass.latestFer === "number"
        ? { latestFer: fundClass.latestFer }
        : {}),
      ...(fundClass.dataAsOf ? { dataAsOf: fundClass.dataAsOf } : {}),
      ...(provenance?.sourceUrl ? { sourceUrl: provenance.sourceUrl } : {}),
      ...(fundClass.returnSources
        ? { returnSources: fundClass.returnSources }
        : {}),
      ...(Object.keys(returnsFreshness).length > 0 ? { returnsFreshness } : {}),
      ...definedReturns(fundClass),
    });
    schemes.set(fundClass.schemeName, scheme);
  }
  return context.json(
    [...schemes.values()].map(
      ({ managementFees, latestFers, dataAsOfDates, ...scheme }) => ({
        ...scheme,
        managementFee: summarizeFees(managementFees),
        latestFer: summarizeFees(latestFers),
        dataAsOf: summarizeDates(dataAsOfDates),
      }),
    ),
  );
});

type SchemeComparisonFund = BrowseFundClass & {
  provenance?: PublishedSearchFund["provenance"];
};

function summarizeDisReturns(funds: SchemeComparisonFund[]) {
  const values = (period: 1 | 3 | 5 | 10) => {
    const field = `annualizedReturn${period}y` as
      | "annualizedReturn1y"
      | "annualizedReturn3y"
      | "annualizedReturn5y"
      | "annualizedReturn10y";
    return funds.flatMap((fund) => {
      const value = fund[field];
      return typeof value === "number" && Number.isFinite(value) ? [value] : [];
    });
  };
  return Object.fromEntries(
    ([1, 3, 5, 10] as const).map((period) => {
      const published = values(period);
      return [
        `${period}y`,
        published.length === 0
          ? null
          : {
              min: Math.min(...published),
              max: Math.max(...published),
              fundClassCount: published.length,
            },
      ];
    }),
  );
}

function disComponentSummary(
  funds: SchemeComparisonFund[],
  component: "core_accumulation" | "age65_plus",
) {
  const matches = funds.filter((fund) => fund.isDisComponent === component);
  if (matches.length === 0) return null;
  return {
    constituentFundName: matches[0]!.constituentFundName,
    returns: summarizeDisReturns(matches),
    fundClasses: matches.map((fund) => ({
      id: fund.id,
      fundClassName: fund.fundClassName,
      ...definedReturns(fund),
      observations: Object.fromEntries(
        ([1, 3, 5, 10] as const).map((period) => {
          const value = fund[`annualizedReturn${period}y`];
          const source = fund.returnSources?.[String(period)];
          const dataAsOf =
            source?.dataAsOf ??
            fund.returnsAsOf ??
            fund.provenance?.dataAsOf ??
            fund.dataAsOf ??
            null;
          const sourceUrl =
            source?.sourceUrl ?? fund.provenance?.sourceUrl ?? null;
          const graceDays = returnGraceDaysForPeriod(
            fund.provenance?.freshnessPolicy,
            period,
          );
          const freshness = evaluateFreshness(dataAsOf ?? "", graceDays);
          return [
            `${period}y`,
            {
              value:
                typeof value === "number" && Number.isFinite(value)
                  ? value
                  : null,
              dataAsOf,
              sourceUrl,
              graceDays,
              status:
                typeof value !== "number" || !Number.isFinite(value)
                  ? "missing"
                  : fund.provenance?.verificationStatus !== "verified" ||
                      !sourceUrl
                    ? "unverified"
                    : freshness.status,
            },
          ];
        }),
      ),
    })),
  };
}

function schemeComparison(schemeName: string, funds: SchemeComparisonFund[]) {
  const coreAccumulation = disComponentSummary(funds, "core_accumulation");
  const age65Plus = disComponentSummary(funds, "age65_plus");
  const ferValues = funds.flatMap((fund) =>
    typeof fund.latestFer === "number" && Number.isFinite(fund.latestFer)
      ? [fund.latestFer]
      : [],
  );
  return {
    id: schemeName,
    schemeName,
    trusteeName: funds[0]!.trusteeName,
    fundChoiceCount: new Set(funds.map((fund) => fund.constituentFundName))
      .size,
    fundClassCount: funds.length,
    fer: summarizeFees(ferValues),
    disPerformance: {
      status:
        coreAccumulation && age65Plus
          ? ("complete" as const)
          : ("incomplete" as const),
      missing: [
        ...(coreAccumulation ? [] : ["core_accumulation" as const]),
        ...(age65Plus ? [] : ["age65_plus" as const]),
      ],
      coreAccumulation,
      age65Plus,
    },
    administrationScore: null,
  };
}

app.get("/schemes/compare", async (context) => {
  const rawIds = context.req.query("ids");
  const ids = rawIds
    ?.split(",")
    .map((id) => id.trim())
    .filter((id, index, all) => id.length > 0 && all.indexOf(id) === index);
  if (!ids?.length) {
    return context.json({ error: "Provide between 1 and 4 scheme ids" }, 400);
  }
  if (ids.length > 4) {
    return context.json(
      { error: "A maximum of 4 schemes can be compared", maximum: 4 },
      400,
    );
  }

  const current = await context.env.DB.prepare(
    `SELECT snapshot_id FROM current_publication WHERE singleton = 1`,
  ).first<{ snapshot_id: string }>();
  if (!current) return context.json({ snapshotId: null, schemes: [] });

  const published = await loadPublishedSearchFunds(context.env.DB);
  const grouped = new Map<string, SchemeComparisonFund[]>();
  for (const item of published) {
    const fund = { ...item.fundClass, provenance: item.provenance };
    if (fund.verificationStatus !== "verified") continue;
    const members = grouped.get(fund.schemeName) ?? [];
    members.push(fund);
    grouped.set(fund.schemeName, members);
  }
  const missingIds = ids.filter((id) => !grouped.has(id));
  if (missingIds.length > 0) {
    return context.json({ error: "Scheme not found", missingIds }, 404);
  }

  return context.json({
    snapshotId: current.snapshot_id,
    schemes: ids.map((id) => schemeComparison(id, grouped.get(id)!)),
  });
});

function summarizeDates(dates: string[]) {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  return { earliest: sorted[0]!, latest: sorted[sorted.length - 1]! };
}

function definedReturns(fundClass: {
  annualizedReturn1y?: number;
  annualizedReturn3y?: number;
  annualizedReturn5y?: number;
  annualizedReturn10y?: number;
}) {
  return {
    ...(typeof fundClass.annualizedReturn1y === "number"
      ? { annualizedReturn1y: fundClass.annualizedReturn1y }
      : {}),
    ...(typeof fundClass.annualizedReturn3y === "number"
      ? { annualizedReturn3y: fundClass.annualizedReturn3y }
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
  3: "annualizedReturn3y",
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
    displayPrecision: "source",
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
        supportedPeriods: [1, 3, 5, 10],
        reason:
          "回報排名只接受官方已披露的年率化期間：一年、三年、五年、十年。",
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
      fundClass: {
        id: string;
        fundClassName: string;
        constituentFundName: string;
        schemeName: string;
        trusteeName: string;
        fundType?: string;
        fundCategory: string;
        annualizedReturn1y?: number;
        annualizedReturn3y?: number;
        annualizedReturn5y?: number;
        annualizedReturn10y?: number;
        returnSources?: Record<
          string,
          { dataAsOf: string; sourceUrl: string; retrievedAt?: string }
        >;
        managementFee?: number;
        feeCaps?: string[];
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
  const evaluatedAt = new Date();
  let excludedStaleCount = 0;
  // 寬限日數逐個基金類別計，唔可以淨係用第一隻基金嘅 freshnessPolicy 代表全部——
  // fundOverviewGraceDays 而家按各計劃財政年結日各自唔同（見 #192）。落嚟 methodology
  // 顯示嘅 graceDays 淨係取第一隻基金做代表，只作參考，實際篩選一律用逐隻基金自己嗰個。
  const methodologyGraceDays =
    metric === "return"
      ? returnGraceDaysForPeriod(
          parsed[0]?.publication.provenance.freshnessPolicy,
          periodYears ?? defaultRankingPeriod,
        )
      : fundOverviewGraceDays(
          parsed[0]?.publication.provenance.freshnessPolicy,
        );
  const eligible = parsed.flatMap(({ snapshotId, publication }) => {
    const value = publication.fundClass[valueField];
    const returnSource =
      metric === "return"
        ? publication.fundClass.returnSources?.[String(periodYears)]
        : undefined;
    const dataAsOf = returnSource?.dataAsOf ?? publication.provenance.dataAsOf;
    const sourceUrl =
      returnSource?.sourceUrl ?? publication.provenance.sourceUrl;
    if (
      publication.fundClass.verificationStatus !== "verified" ||
      publication.provenance.verificationStatus !== "verified" ||
      typeof value !== "number" ||
      !Number.isFinite(value)
    ) {
      return [];
    }
    const graceDays =
      metric === "return"
        ? returnGraceDaysForPeriod(
            publication.provenance.freshnessPolicy,
            periodYears ?? defaultRankingPeriod,
          )
        : fundOverviewGraceDays(publication.provenance.freshnessPolicy);
    if (
      evaluateFreshness(dataAsOf, graceDays, evaluatedAt).status !== "verified"
    ) {
      excludedStaleCount += 1;
      return [];
    }
    return [{ snapshotId, publication, value, dataAsOf, sourceUrl }];
  });
  // 冇積金局基金類型的基金唔可以同人同組排名。
  const groups = Map.groupBy(
    eligible.filter(
      ({ publication }) =>
        comparisonGroupFor(publication.fundClass).name !== UNCLASSIFIED_GROUP,
    ),
    ({ publication }) => comparisonGroupFor(publication.fundClass).name,
  );
  const precision = selected.displayPrecision;
  const rankValue = (value: number) =>
    precision === "source" ? value : Number(value.toFixed(precision));
  const displayValue = (value: number) =>
    precision === "source" ? String(value) : value.toFixed(precision);
  const direction = selected.sortDirection === "ascending" ? 1 : -1;
  const rankings = [...groups.entries()].flatMap(([comparisonGroup, funds]) => {
    funds.sort((a, b) => {
      const ordered = direction * (rankValue(a.value) - rankValue(b.value));
      return ordered !== 0
        ? ordered
        : a.publication.fundClass.id.localeCompare(b.publication.fundClass.id);
    });
    let previousValue: number | undefined;
    let previousRank = 0;
    return funds.map(({ publication, value, dataAsOf, sourceUrl }, index) => {
      const rankingValue = rankValue(value);
      const rank = rankingValue === previousValue ? previousRank : index + 1;
      previousValue = rankingValue;
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
        displayValue: `${displayValue(value)}${selected.unit}`,
        ...(metric === "fee" &&
        publication.fundClass.feeCaps?.includes("managementFee")
          ? { feeCap: true }
          : {}),
        rank,
        dataAsOf,
        sourceUrl,
      };
    });
  });

  return context.json({
    snapshotId: rows.results[0]?.snapshot_id ?? null,
    comparisonGroups: (() => {
      const present = new Set(
        parsed.map(
          ({ publication }) => comparisonGroupFor(publication.fundClass).name,
        ),
      );
      return MPFA_FUND_TYPES.map((type) => type.zh).filter((name) =>
        present.has(name),
      );
    })(),
    metric,
    periodYears,
    excludedStaleCount,
    methodology: {
      metric: selected.methodology,
      grouping: "comparison_group",
      classification: classificationOf(),
      sortDirection: selected.sortDirection,
      displayPrecision: precision,
      freshness: {
        graceDays: methodologyGraceDays,
        evaluatedOn: evaluatedAt.toISOString().slice(0, 10),
        rule: "資料截至日期超出網站時效門檻的數值不參與排名，但仍可在基金詳情頁連同原截至日期查看。",
      },
    },
    rankings,
  });
});

/**
 * 基金特色的同類位置（ADR 0012 第 6 點）：規模、成立年期、波幅、管理費喺同一積金局
 * 基金類型入面的位置。只用同一快照、已核實、未過期的官方數值；全部係本站計算。
 */
app.get("/fund-classes/:id/features", async (context) => {
  const fundClassId = context.req.param("id");
  const rows = await context.env.DB.prepare(
    `SELECT c.snapshot_id, f.payload
     FROM current_publication c
     JOIN fund_class_versions f ON f.snapshot_id = c.snapshot_id
     WHERE c.singleton = 1`,
  ).all<{ snapshot_id: string; payload: string }>();
  type FeaturePayload = {
    fundClass: BrowseFundClass & { fundCategory: string };
    provenance: {
      dataAsOf: string;
      verificationStatus?: string;
      freshnessPolicy?: FreshnessPolicy;
    };
  };
  const parsed = rows.results.map(
    (row) => JSON.parse(row.payload) as FeaturePayload,
  );
  const own = parsed.find(
    (publication) => publication.fundClass.id === fundClassId,
  );
  if (!own) return context.json({ error: "Fund class not found" }, 404);
  const group = comparisonGroupFor(own.fundClass);
  const evaluatedAt = new Date();

  // 每隻基金每個項目的官方值同截至日期；過期唔參與比較（同排名一樣），冇值就冇值。
  type Reading = {
    value?: number;
    asOf?: string;
    excludedReason?: "missing" | "stale" | "unverified";
  };
  const read = (publication: FeaturePayload, key: FeatureKey): Reading => {
    const fund = publication.fundClass;
    const policy = publication.provenance.freshnessPolicy;
    const verified =
      fund.verificationStatus === "verified" &&
      publication.provenance.verificationStatus === "verified";
    // 同排名一樣：平台同來源兩邊都要已核實，否則唔入同類，亦唔排位。
    if (!verified) return { excludedReason: "unverified" };
    if (key === "fundAge") {
      // 成立日期是靜態事實，不設過期。
      const days = fund.launchDate
        ? daysSinceLaunch(fund.launchDate, evaluatedAt)
        : undefined;
      return days === undefined
        ? { excludedReason: "missing" }
        : { value: days, asOf: fund.launchDate };
    }
    const [value, asOf, graceDays] =
      key === "fundSize"
        ? [fund.fundSizeHkdMillion, fund.fundSizeAsOf, returnsGraceDays(policy)]
        : key === "volatility"
          ? [
              fund.fundRiskIndicator,
              publication.provenance.dataAsOf,
              fundOverviewGraceDays(policy),
            ]
          : [
              fund.managementFee,
              publication.provenance.dataAsOf,
              fundOverviewGraceDays(policy),
            ];
    if (typeof value !== "number" || !Number.isFinite(value) || !asOf) {
      return { excludedReason: "missing" };
    }
    if (evaluateFreshness(asOf, graceDays, evaluatedAt).status !== "verified") {
      return { value, asOf, excludedReason: "stale" };
    }
    return { value, asOf };
  };

  const peers =
    group.name === UNCLASSIFIED_GROUP
      ? []
      : parsed.filter(
          (publication) =>
            comparisonGroupFor(publication.fundClass).name === group.name,
        );
  const positions = FEATURE_KEYS.map((key) => {
    const eligible: FeaturePeer[] = peers.flatMap((publication) => {
      const reading = read(publication, key);
      return reading.value !== undefined && !reading.excludedReason
        ? [{ fundClassId: publication.fundClass.id, value: reading.value }]
        : [];
    });
    const ownReading = read(own, key);
    return {
      ...featurePosition(key, fundClassId, eligible, ownReading),
      // 過期的本基金數值照樣交返（連截至日期），網站講明點解唔比較。
      ...(ownReading.excludedReason === "stale"
        ? { staleValue: ownReading.value }
        : {}),
      ...(key === "managementFee" &&
      own.fundClass.feeCaps?.includes("managementFee")
        ? { feeCap: true }
        : {}),
    };
  });

  return context.json({
    snapshotId: rows.results[0]?.snapshot_id ?? null,
    fundClassId,
    comparisonGroup: group.name,
    comparisonGroupSource: group.source,
    groupMemberCount: peers.length,
    methodology: {
      evaluatedOn: evaluatedAt.toISOString().slice(0, 10),
      minPeersForQuartile: MIN_PEERS,
      rule: "本站計算：同一積金局基金類型、同一快照內已核實及未過期的官方數值；同值同名次；四分位按同類隻數計。只表示位置，不代表較佳或較差。",
    },
    positions,
  });
});

app.notFound((context) => context.json({ error: "Not found" }, 404));

export default app;
