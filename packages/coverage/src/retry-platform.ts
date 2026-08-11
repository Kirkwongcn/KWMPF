import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { archiveHtml, createRunArchive, failedFetchArtifact, writeArchiveManifest, type RawArtifact } from "./raw-archive";
import { parseFundDetail } from "./platform-parser";

const detailUrl = (id: number) => `https://mfp.mpfa.org.hk/mobile/eng/cf_detail.jsp?cf_id=${id}`;

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const manifestPath = argument("--manifest");
const rawDirectory = argument("--raw-dir");
const runId = argument("--run-id") ?? new Date().toISOString().replaceAll(":", "-");
const concurrency = Number(argument("--concurrency") ?? 2);
if (!manifestPath || !rawDirectory) {
  throw new Error("Usage: bun coverage:retry-platform --manifest <manifest.json> --raw-dir <directory> [--run-id <immutable-version>]");
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
  throw new Error("Concurrency must be an integer between 1 and 4");
}

const previous = JSON.parse(await readFile(manifestPath, "utf8")) as { artifacts: RawArtifact[] };
const failed = previous.artifacts
  .filter((artifact) => artifact.parseStatus !== "parsed")
  .map((artifact) => artifact.path.match(/^details\/(\d+)\.html$/)?.[1])
  .filter((id): id is string => id !== undefined)
  .map(Number);
const runDirectory = await createRunArchive(rawDirectory, runId);
const results = new Array<{ artifact: RawArtifact; record?: ReturnType<typeof parseFundDetail> }>(failed.length);
let next = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next < failed.length) {
    const index = next++;
    const cfId = failed[index]!;
  const url = detailUrl(cfId);
  const relativePath = `details/${cfId}.html`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    if (/This page can't be displayed|incident ID:/i.test(html)) throw new Error("platform protection page");
    const retrievedAt = new Date().toISOString();
    results[index] = { artifact: await archiveHtml(runDirectory, relativePath, url, html, retrievedAt, "parsed"), record: parseFundDetail(html, cfId) };
  } catch {
    results[index] = { artifact: failedFetchArtifact(relativePath, url, new Date().toISOString()) };
  }
  await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}));

const artifacts = results.map((result) => result.artifact);
const records = results.flatMap((result) => result.record ? [result.record] : []);

await writeFile(join(runDirectory, "retry-result.json"), `${JSON.stringify({ sourceType: "mpf_fund_platform", records, failedFundClassIds: artifacts.filter((artifact) => artifact.parseStatus !== "parsed").map((artifact) => artifact.path), previousManifest: manifestPath }, null, 2)}\n`);
await writeArchiveManifest(runDirectory, runId, artifacts);
console.log(JSON.stringify({ runDirectory, attempted: failed.length, parsed: records.length, failed: failed.length - records.length, concurrency }));
