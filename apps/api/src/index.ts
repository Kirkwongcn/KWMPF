import { Hono } from "hono";
import { cors } from "hono/cors";
import type { PublicationBindings } from "./publication";

type Bindings = PublicationBindings & {
  RELEASE_VERSION: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());

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
  return context.json(JSON.parse(row.payload));
});

type BrowseFundClass = {
  id: string;
  fundClassName: string;
  constituentFundName: string;
  schemeName: string;
  trusteeName: string;
  fundType: string;
  fundCategory?: string;
  riskClass?: number;
  annualizedReturn1y?: number;
  managementFee?: number;
  latestFer?: number;
  dataAsOf?: string;
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

app.get("/search", async (context) => {
  const query = context.req.query("q")?.trim().toLocaleLowerCase();
  const fundType = context.req.query("fundType")?.trim();
  const fundCategory = context.req.query("fundCategory")?.trim();
  const trustee = context.req.query("trustee")?.trim();
  const riskClassParam = context.req.query("riskClass")?.trim();
  const riskClass = riskClassParam ? Number(riskClassParam) : undefined;

  const hasFilter = Boolean(
    fundType ||
    fundCategory ||
    trustee ||
    (riskClass !== undefined && Number.isFinite(riskClass)),
  );
  if (!query && !hasFilter) return context.json([]);

  const results = (await loadPublishedFundClasses(context.env.DB))
    .filter((fundClass) => {
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
    })
    .slice(0, 50)
    .map((fundClass) => ({
      id: fundClass.id,
      fundClassName: fundClass.fundClassName,
      constituentFundName: fundClass.constituentFundName,
      schemeName: fundClass.schemeName,
      trusteeName: fundClass.trusteeName,
      fundType: fundClass.fundType,
      fundCategory: fundClass.fundCategory,
      riskClass: fundClass.riskClass,
      annualizedReturn1y: fundClass.annualizedReturn1y,
      managementFee: fundClass.managementFee,
      latestFer: fundClass.latestFer,
      dataAsOf: fundClass.dataAsOf,
    }));

  return context.json(results);
});

app.get("/filters", async (context) => {
  const current = await context.env.DB.prepare(
    `SELECT snapshot_id FROM current_publication WHERE singleton = 1`,
  ).first<{ snapshot_id: string }>();

  if (!current)
    return context.json({
      snapshotId: null,
      fundTypes: [],
      trustees: [],
      riskClasses: [],
    });

  const fundClasses = await loadPublishedFundClasses(context.env.DB);
  const fundTypes = new Set<string>();
  const trustees = new Set<string>();
  const riskClasses = new Set<number>();

  for (const fundClass of fundClasses) {
    if (fundClass.fundType) fundTypes.add(fundClass.fundType);
    if (fundClass.trusteeName) trustees.add(fundClass.trusteeName);
    if (typeof fundClass.riskClass === "number")
      riskClasses.add(fundClass.riskClass);
  }

  return context.json({
    snapshotId: current.snapshot_id,
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
      fundTypes: string[];
      riskClassDistribution: Record<string, number>;
      managementFees: number[];
      funds: {
        id: string;
        constituentFundName: string;
        fundClassName: string;
        fundType: string;
        riskClass?: number;
      }[];
    }
  >();

  for (const row of rows.results) {
    const { fundClass } = JSON.parse(row.payload) as {
      fundClass: {
        id: string;
        schemeName: string;
        trusteeName: string;
        constituentFundName: string;
        fundClassName: string;
        fundType: string;
        riskClass?: number;
        managementFee?: number;
        verificationStatus: string;
      };
    };
    if (fundClass.verificationStatus !== "verified") continue;
    const scheme = schemes.get(fundClass.schemeName) ?? {
      schemeName: fundClass.schemeName,
      trusteeName: fundClass.trusteeName,
      fundClassCount: 0,
      fundTypes: [],
      riskClassDistribution: {},
      managementFees: [],
      funds: [],
    };
    scheme.fundClassCount += 1;
    if (!scheme.fundTypes.includes(fundClass.fundType))
      scheme.fundTypes.push(fundClass.fundType);
    if (typeof fundClass.riskClass === "number") {
      const risk = String(fundClass.riskClass);
      scheme.riskClassDistribution[risk] =
        (scheme.riskClassDistribution[risk] ?? 0) + 1;
    }
    if (typeof fundClass.managementFee === "number")
      scheme.managementFees.push(fundClass.managementFee);
    scheme.funds.push({
      id: fundClass.id,
      constituentFundName: fundClass.constituentFundName,
      fundClassName: fundClass.fundClassName,
      fundType: fundClass.fundType,
      ...(typeof fundClass.riskClass === "number"
        ? { riskClass: fundClass.riskClass }
        : {}),
    });
    schemes.set(fundClass.schemeName, scheme);
  }
  return context.json(
    [...schemes.values()].map(({ managementFees, ...scheme }) => ({
      ...scheme,
      managementFee: summarizeFees(managementFees),
    })),
  );
});

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

app.get("/rankings", async (context) => {
  const requested = Number(context.req.query("period"));
  if (!(requested in rankingReturnFields)) {
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
  const periodYears = requested as RankingPeriod;
  const returnField = rankingReturnFields[periodYears];
  const rows = await context.env.DB.prepare(
    `SELECT c.snapshot_id, f.payload
     FROM current_publication c
     JOIN fund_class_versions f ON f.snapshot_id = c.snapshot_id
     WHERE c.singleton = 1`,
  ).all<{ snapshot_id: string; payload: string }>();
  const eligible = rows.results.flatMap((row) => {
    const publication = JSON.parse(row.payload) as {
      fundClass: {
        id: string;
        fundClassName: string;
        constituentFundName: string;
        schemeName: string;
        trusteeName: string;
        fundCategory: string;
        annualizedReturn1y?: number;
        annualizedReturn5y?: number;
        annualizedReturn10y?: number;
        dataAsOf: string;
        verificationStatus: string;
      };
      provenance: {
        sourceUrl: string;
        dataAsOf: string;
        verificationStatus: string;
      };
    };
    const value = publication.fundClass[returnField];
    if (
      publication.fundClass.verificationStatus !== "verified" ||
      publication.provenance.verificationStatus !== "verified" ||
      typeof value !== "number" ||
      !Number.isFinite(value)
    ) {
      return [];
    }
    return [{ snapshotId: row.snapshot_id, publication, value }];
  });
  const groups = Map.groupBy(
    eligible,
    ({ publication }) => publication.fundClass.fundCategory,
  );
  const rankings = [...groups.entries()].flatMap(([comparisonGroup, funds]) => {
    funds.sort(
      (a, b) => Number(b.value.toFixed(2)) - Number(a.value.toFixed(2)),
    );
    let previousValue: number | undefined;
    let previousRank = 0;
    return funds.map(({ publication, value }, index) => {
      const displayed = Number(value.toFixed(2));
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
        value,
        displayValue: `${value.toFixed(2)}%`,
        rank,
        dataAsOf: publication.provenance.dataAsOf,
        sourceUrl: publication.provenance.sourceUrl,
      };
    });
  });

  return context.json({
    snapshotId: rows.results[0]?.snapshot_id ?? null,
    periodYears,
    methodology: {
      metric: "annualized_return",
      grouping: "comparison_group",
      sortDirection: "descending",
      displayPrecision: 2,
    },
    rankings,
  });
});

app.notFound((context) => context.json({ error: "Not found" }, 404));

export default app;
