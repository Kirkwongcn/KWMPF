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

app.notFound((context) => context.json({ error: "Not found" }, 404));

export default app;
