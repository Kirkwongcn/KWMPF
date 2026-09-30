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
  /^\/fund-classes\/[^/]+\/interpretation$/,
  /^\/search$/,
  /^\/filters$/,
  /^\/summary$/,
  /^\/data-quality$/,
  /^\/schemes$/,
  /^\/rankings$/,
  /^\/comparison-group-stats$/,
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

/** Freshness is evaluated each UTC calendar day; validators also bind the URL and code version. */
export async function representationEtag(
  url: string,
  contentVersion: string,
  releaseVersion: string,
  evaluatedOn: string,
): Promise<string> {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.searchParams.sort();
  const input = new TextEncoder().encode(
    JSON.stringify([
      parsed.pathname,
      parsed.search,
      contentVersion,
      releaseVersion,
      evaluatedOn,
    ]),
  );
  const digest = await crypto.subtle.digest("SHA-256", input);
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `"${hash}"`;
}

const edgeCache = (): Cache | null => {
  if (typeof caches === "undefined") return null;
  return (caches as CacheStorage & { default?: Cache }).default ?? null;
};

export const publicationCache = (): MiddlewareHandler<{
  Bindings: PublicationBindings & { RELEASE_VERSION?: string };
}> =>
  async function publicationCacheMiddleware(context, next) {
    if (context.req.method !== "GET" || !isCacheablePath(context.req.path)) {
      await next();
      context.res.headers.set("Cache-Control", UNCACHEABLE_CACHE_CONTROL);
      return;
    }

    const published = await currentPublicationVersion(context.env.DB);
    const evaluatedOn = new Date().toISOString().slice(0, 10);
    const releaseVersion = context.env.RELEASE_VERSION ?? "unknown";
    const version =
      published === null
        ? null
        : `${published.contentVersion}:${releaseVersion}:${evaluatedOn}`;
    const etag =
      published === null
        ? null
        : await representationEtag(
            context.req.url,
            published.contentVersion,
            releaseVersion,
            evaluatedOn,
          );

    const cache = published === null ? null : edgeCache();
    const key = cache === null ? null : cacheKeyFor(context.req.url, version!);

    if (cache !== null && key !== null) {
      const hit = await cache.match(key).catch(() => undefined);
      if (hit) {
        if (context.req.header("If-None-Match") === hit.headers.get("ETag"))
          return context.body(null, 304, {
            "Cache-Control": PUBLISHED_CACHE_CONTROL,
            ETag: etag!,
            "X-Snapshot-Id": published!.snapshotId,
          });
        return hit;
      }
    }

    await next();

    if (etag === null || context.res.status !== 200) {
      context.res.headers.set("Cache-Control", UNCACHEABLE_CACHE_CONTROL);
      context.res.headers.delete("ETag");
      return;
    }

    context.res.headers.set("Cache-Control", PUBLISHED_CACHE_CONTROL);
    context.res.headers.set("ETag", etag);
    context.res.headers.set("X-Snapshot-Id", published!.snapshotId);

    // Validate the route before returning 304; an invented validator must not hide a 400/404.
    if (context.req.header("If-None-Match") === etag)
      return context.body(null, 304, {
        "Cache-Control": PUBLISHED_CACHE_CONTROL,
        ETag: etag,
        "X-Snapshot-Id": published!.snapshotId,
      });

    if (cache !== null && key !== null) {
      context.executionCtx.waitUntil(
        cache.put(key, context.res.clone()).catch(() => undefined),
      );
    }
  };
