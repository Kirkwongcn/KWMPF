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

app.get("/search", async (context) => {
  const query = context.req.query("q")?.trim().toLocaleLowerCase();
  if (!query) return context.json([]);

  const rows = await context.env.DB.prepare(
    `SELECT f.payload
     FROM current_publication c
     JOIN fund_class_versions f ON f.snapshot_id = c.snapshot_id
     WHERE c.singleton = 1`,
  ).all<{ payload: string }>();

  const results = rows.results
    .map(
      (row) =>
        JSON.parse(row.payload) as {
          fundClass: {
            id: string;
            fundClassName: string;
            constituentFundName: string;
            schemeName: string;
            trusteeName: string;
          };
        },
    )
    .filter(({ fundClass }) =>
      [
        fundClass.fundClassName,
        fundClass.constituentFundName,
        fundClass.schemeName,
        fundClass.trusteeName,
      ].some((value) => value.toLocaleLowerCase().includes(query)),
    )
    .slice(0, 50)
    .map(({ fundClass }) => ({
      id: fundClass.id,
      fundClassName: fundClass.fundClassName,
      constituentFundName: fundClass.constituentFundName,
      schemeName: fundClass.schemeName,
      trusteeName: fundClass.trusteeName,
    }));

  return context.json(results);
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
  return context.json([...schemes.values()]);
});

app.get("/rankings", async (context) => {
  if (context.req.query("period") !== "1") {
    return context.json({ error: "Unsupported ranking period" }, 400);
  }
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
        dataAsOf: string;
        verificationStatus: string;
      };
      provenance: {
        sourceUrl: string;
        dataAsOf: string;
        verificationStatus: string;
      };
    };
    const value = publication.fundClass.annualizedReturn1y;
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
    periodYears: 1,
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
