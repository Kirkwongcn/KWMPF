import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  DB: D1Database;
  RAW_ARCHIVE: R2Bucket;
  RELEASE_VERSION: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("/health", cors());

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

app.notFound((context) => context.json({ error: "Not found" }, 404));

export default app;
