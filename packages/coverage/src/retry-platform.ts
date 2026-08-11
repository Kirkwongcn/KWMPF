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
if (!manifestPath || !rawDirectory) {
  throw new Error("Usage: bun coverage:retry-platform --manifest <manifest.json> --raw-dir <directory> [--run-id <immutable-version>]");
}

const previous = JSON.parse(await readFile(manifestPath, "utf8")) as { artifacts: RawArtifact[] };
const failed = previous.artifacts
  .filter((artifact) => artifact.parseStatus !== "parsed")
  .map((artifact) => artifact.path.match(/^details\/(\d+)\.html$/)?.[1])
  .filter((id): id is string => id !== undefined)
  .map(Number);
const runDirectory = await createRunArchive(rawDirectory, runId);
const artifacts: RawArtifact[] = [];
const records = [];

for (const cfId of failed) {
  const url = detailUrl(cfId);
  const relativePath = `details/${cfId}.html`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    if (/This page can't be displayed|incident ID:/i.test(html)) throw new Error("platform protection page");
    const retrievedAt = new Date().toISOString();
    records.push(parseFundDetail(html, cfId));
    artifacts.push(await archiveHtml(runDirectory, relativePath, url, html, retrievedAt, "parsed"));
  } catch {
    artifacts.push(failedFetchArtifact(relativePath, url, new Date().toISOString()));
  }
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

await writeFile(join(runDirectory, "retry-result.json"), `${JSON.stringify({ sourceType: "mpf_fund_platform", records, failedFundClassIds: artifacts.filter((artifact) => artifact.parseStatus !== "parsed").map((artifact) => artifact.path), previousManifest: manifestPath }, null, 2)}\n`);
await writeArchiveManifest(runDirectory, runId, artifacts);
console.log(JSON.stringify({ runDirectory, attempted: failed.length, parsed: records.length, failed: failed.length - records.length }));
