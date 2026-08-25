import type { MiddlewareHandler } from "hono";
import {
  SNAPSHOT_ID_BATCH_JOIN,
  type PublicationBindings,
} from "./publication";

export const PUBLISHED_CACHE_CONTROL =
  "public, max-age=300, stale-while-revalidate=600";
export const UNCACHEABLE_CACHE_CONTROL = "no-store";

const CACHEABLE_PATHS = [
  /^\/fund-classes\/[^/]+$/,
  /^\/search$/,
  /^\/filters$/,
  /^\/summary$/,
  /^\/schemes$/,
  /^\/rankings$/,
];

export const isCacheablePath = (path: string): boolean =>
  CACHEABLE_PATHS.some((pattern) => pattern.test(path));

export type PublicationVersion = {
  snapshotId: string;
  contentVersion: string;
};

export const currentPublicationVersion = async (
  db: PublicationBindings["DB"],
): Promise<PublicationVersion | null> => {
  const row = await db
    .prepare(
      `SELECT c.snapshot_id, b.raw_sha256
       FROM current_publication c
       LEFT JOIN candidate_batches b ON ${SNAPSHOT_ID_BATCH_JOIN}
       WHERE c.singleton = 1`,
    )
    .first<{ snapshot_id: string; raw_sha256: string | null }>()
    .catch(() => null);

  if (!row) return null;

  return {
    snapshotId: row.snapshot_id,
    contentVersion: `${row.snapshot_id}:${row.raw_sha256 ?? "unknown"}`,
  };
};

export const cacheKeyFor = (url: string, contentVersion: string): Request => {
  const keyUrl = new URL(url);
  keyUrl.searchParams.set("__snapshot", contentVersion);
  return new Request(keyUrl.toString(), { method: "GET" });
};

const edgeCache = (): Cache | null => {
  if (typeof caches === "undefined") return null;
  return (caches as CacheStorage & { default?: Cache }).default ?? null;
};

export const publicationCache = (): MiddlewareHandler<{
  Bindings: PublicationBindings;
}> =>
  async function publicationCacheMiddleware(context, next) {
    if (context.req.method !== "GET" || !isCacheablePath(context.req.path)) {
      await next();
      context.res.headers.set("Cache-Control", UNCACHEABLE_CACHE_CONTROL);
      return;
    }

    const published = await currentPublicationVersion(context.env.DB);
    const etag = published === null ? null : `"${published.snapshotId}"`;

    if (published !== null && context.req.header("If-None-Match") === etag) {
      return context.body(null, 304, {
        "Cache-Control": PUBLISHED_CACHE_CONTROL,
        ETag: etag!,
      });
    }

    const cache = published === null ? null : edgeCache();
    const key =
      cache === null
        ? null
        : cacheKeyFor(context.req.url, published!.contentVersion);

    if (cache !== null && key !== null) {
      const hit = await cache.match(key).catch(() => undefined);
      if (hit) return hit;
    }

    await next();

    if (etag === null || context.res.status !== 200) {
      context.res.headers.set("Cache-Control", UNCACHEABLE_CACHE_CONTROL);
      context.res.headers.delete("ETag");
      return;
    }

    context.res.headers.set("Cache-Control", PUBLISHED_CACHE_CONTROL);
    context.res.headers.set("ETag", etag);

    if (cache !== null && key !== null) {
      context.executionCtx.waitUntil(
        cache.put(key, context.res.clone()).catch(() => undefined),
      );
    }
  };
