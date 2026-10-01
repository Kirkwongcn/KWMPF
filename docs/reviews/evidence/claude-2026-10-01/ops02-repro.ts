// Scratch reproduction only; not part of the repo. Fake D1 flips the current
// publication after the cache middleware's read, simulating a concurrent release.
import app from "/home/user/KWMPF/apps/api/src/index.ts";
let current = "snapshot-A";
let middlewareReads = 0;
const payload = (snap: string) => JSON.stringify({ snapshotId: snap, fundClass: {
  id: "x", schemeName: `Scheme ${snap}`, trusteeName: "T", dataAsOf: "2026-08-31", verificationStatus: "verified" } });
const stmt = (sql: string, args: unknown[] = []) => ({
  bind: (...a: unknown[]) => stmt(sql, a),
  first: async () => {
    if (sql.includes("LEFT JOIN candidate_batches")) {
      middlewareReads += 1;
      const snap = current;
      current = "snapshot-B"; // release lands between middleware and route
      return { snapshot_id: snap, raw_sha256: `sha-${snap}` };
    }
    if (sql.includes("FROM current_publication")) return { snapshot_id: current };
    return null;
  },
  all: async () => ({ results: sql.includes("fund_class_versions") ? [{ payload: payload(String(args[0])) }] : [] }),
});
const env = { DB: { prepare: (sql: string) => stmt(sql) }, RAW_ARCHIVE: {}, RELEASE_VERSION: "test" };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const res = await app.fetch(new Request("https://api.example/summary"), env as never, ctx as never);
const body = await res.json() as { snapshotId: string };
console.log(JSON.stringify({ status: res.status, headerSnapshot: res.headers.get("X-Snapshot-Id"),
  bodySnapshot: body.snapshotId, etag: res.headers.get("ETag"), middlewareReads,
  consistent: res.headers.get("X-Snapshot-Id") === body.snapshotId }));
