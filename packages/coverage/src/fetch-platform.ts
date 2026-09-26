import { writeFile } from "node:fs/promises";
import type { SourceRecord, SourceSnapshot } from "./build-coverage";
import { parseFundDetail, parseFundIds } from "./platform-parser";
import {
  archiveHtml,
  createRunArchive,
  failedFetchArtifact,
  readArchivedHtml,
  type RawArtifact,
  writeArchiveManifest,
} from "./raw-archive";

const listUrl = "https://mfp.mpfa.org.hk/eng/mpp_list.jsp";
const detailUrl = (cfId: number) =>
  `https://mfp.mpfa.org.hk/mobile/eng/cf_detail.jsp?cf_id=${cfId}`;
const MAX_HTML_BYTES = 5 * 1024 * 1024;

type FetchFailure = {
  attempt: number;
  retrievedAt: string;
  httpStatus?: number;
  html?: string;
  error: string;
};

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function fetchHtml(
  url: string,
  onFailure?: (failure: FetchFailure) => Promise<void>,
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    let httpStatus: number | undefined;
    let html: string | undefined;
    let retrievedAt = new Date().toISOString();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      httpStatus = response.status;
      retrievedAt = new Date().toISOString();
      const declaredSize = Number(response.headers.get("content-length") ?? 0);
      if (declaredSize > MAX_HTML_BYTES) throw new Error(`${url} exceeds 5 MiB`);
      html = await response.text();
      retrievedAt = new Date().toISOString();
      if (Buffer.byteLength(html) > MAX_HTML_BYTES) {
        html = undefined;
        throw new Error(`${url} exceeds 5 MiB`);
      }
      if (/This page can't be displayed|incident ID:/i.test(html)) {
        throw new Error(url + " returned a platform protection page");
      }
      if (!response.ok)
        throw new Error(url + " returned HTTP " + response.status);
      return html;
    } catch (error) {
      lastError = error;
      retrievedAt = new Date().toISOString();
      await onFailure?.({
        attempt,
        retrievedAt,
        ...(httpStatus === undefined ? {} : { httpStatus }),
        ...(html === undefined ? {} : { html }),
        error:
          error instanceof Error ? error.message.slice(0, 500) : String(error),
      });
      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
  }
  throw lastError;
}

async function parallelMap<T, R>(
  values: T[],
  concurrency: number,
  work: (value: T) => Promise<R>,
) {
  const output = new Array<R>(values.length);
  const errors: unknown[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < values.length) {
        const index = next++;
        try {
          output[index] = await work(values[index]!);
        } catch (error) {
          errors.push(error);
        }
      }
    }),
  );
  if (errors.length > 0) throw errors[0];
  return output;
}

const outputPath = argument("--output");
const rawDirectory = argument("--raw-dir");
const expectedCountsSource = argument("--expected-counts-source");
const runId = argument("--run-id") ?? new Date().toISOString().replaceAll(":", "-");
const concurrency = Number(argument("--concurrency") ?? 2);
const expectedCounts = {
  fundClasses: Number(argument("--expected-fund-classes")),
  constituentFunds: Number(argument("--expected-constituent-funds")),
  schemes: Number(argument("--expected-schemes")),
  trustees: Number(argument("--expected-trustees")),
};
if (!outputPath || !rawDirectory || !expectedCountsSource) {
  throw new Error(
    "Usage: bun coverage:fetch-platform --output <snapshot.json> --raw-dir <archive-directory> --expected-counts-source <asset-size-document-url> --expected-fund-classes <n> --expected-constituent-funds <n> --expected-schemes <n> --expected-trustees <n> [--run-id <immutable-version>]",
  );
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
  throw new Error("Concurrency must be an integer between 1 and 4");
}
for (const [name, value] of Object.entries(expectedCounts)) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Independent expected count ${name} must be a positive integer`);
  }
}

const runDirectory = await createRunArchive(rawDirectory, runId);
const artifacts: RawArtifact[] = [];
async function fetchAndArchive(url: string, relativePath: string) {
  return fetchHtml(url, async ({ attempt, retrievedAt, httpStatus, html, error }) => {
    const metadata = {
      attempt,
      ...(httpStatus === undefined ? {} : { httpStatus }),
      error,
    };
    if (html !== undefined) {
      artifacts.push(
        await archiveHtml(
          runDirectory,
          relativePath + ".attempt-" + attempt + ".html",
          url,
          html,
          retrievedAt,
          "fetch_failed",
          metadata,
        ),
      );
    } else {
      artifacts.push(
        failedFetchArtifact(
          relativePath + ".attempt-" + attempt + ".fetch-failed",
          url,
          retrievedAt,
          metadata,
        ),
      );
    }
  });
}

let listHtml = await readArchivedHtml(runDirectory, "fund-information-table.html");
if (listHtml === undefined) {
  try {
    listHtml = await fetchAndArchive(listUrl, "fund-information-table.html");
  } catch (error) {
    await writeArchiveManifest(runDirectory, runId, artifacts);
    throw error;
  }
}
const listRetrievedAt = new Date().toISOString();
let fundClassIds: number[];
try {
  fundClassIds = parseFundIds(listHtml);
  artifacts.push(
    await archiveHtml(runDirectory, "fund-information-table.html", listUrl, listHtml, listRetrievedAt, "parsed"),
  );
} catch (error) {
  artifacts.push(
    await archiveHtml(runDirectory, "fund-information-table.html", listUrl, listHtml, listRetrievedAt, "parse_failed"),
  );
  await writeArchiveManifest(runDirectory, runId, artifacts);
  throw error;
}
if (fundClassIds.length === 0) {
  await writeArchiveManifest(runDirectory, runId, artifacts);
  throw new Error("Fund Platform returned no fund classes");
}
if (fundClassIds.length !== expectedCounts.fundClasses) {
  await writeArchiveManifest(runDirectory, runId, artifacts);
  throw new Error(
    `Fund Platform expected ${expectedCounts.fundClasses} fund classes but received ${fundClassIds.length}`,
  );
}

let records: SourceRecord[];
try {
    records = await parallelMap(fundClassIds, concurrency, async (cfId) => {
    const url = detailUrl(cfId);
    const relativePath = `details/${cfId}.html`;
    let html = await readArchivedHtml(runDirectory, relativePath);
    try {
      html ??= await fetchAndArchive(url, relativePath);
    } catch (error) {
      throw error;
    }
    const retrievedAt = new Date().toISOString();
    try {
      const record = parseFundDetail(html, cfId);
      artifacts.push(
        await archiveHtml(
          runDirectory,
          relativePath,
          url,
          html,
          retrievedAt,
          "parsed",
        ),
      );
      return record;
    } catch (error) {
      artifacts.push(
        await archiveHtml(
          runDirectory,
          relativePath,
          url,
          html,
          retrievedAt,
          "parse_failed",
        ),
      );
      throw error;
    }
  });
} catch (error) {
  await writeArchiveManifest(runDirectory, runId, artifacts);
  throw error;
}
const count = (select: (record: SourceRecord) => string) =>
  new Set(records.map(select)).size;
const sourceDates = new Set(records.map((record) => record.dataAsOf));
if (sourceDates.size !== 1) {
  await writeArchiveManifest(runDirectory, runId, artifacts);
  throw new Error("Fund Platform detail pages do not share one source date");
}
const [sourceDataAsOf] = sourceDates;
for (const artifact of artifacts) artifact.dataAsOf = sourceDataAsOf;
const snapshot: SourceSnapshot = {
  sourceType: "mpf_fund_platform",
  sourceUrl: listUrl,
  retrievedAt: new Date().toISOString(),
  sourceDataAsOf,
  expectedCounts,
  expectedCountsSource,
  records,
};

const actualCounts = {
  fundClasses: records.length,
  constituentFunds: count(
    (record) =>
      `${record.identity.schemeName}\u0000${record.identity.constituentFundName}`,
  ),
  schemes: count((record) => record.identity.schemeName),
  trustees: count((record) => record.identity.trusteeName),
};
for (const [name, expected] of Object.entries(expectedCounts)) {
  const actual = actualCounts[name as keyof typeof actualCounts];
  if (actual !== expected) {
    await writeArchiveManifest(runDirectory, runId, artifacts);
    throw new Error(`Fund Platform expected ${expected} ${name} but received ${actual}`);
  }
}
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
await writeArchiveManifest(runDirectory, runId, artifacts);
console.log(JSON.stringify({ outputPath, runDirectory, ...snapshot.expectedCounts }));
