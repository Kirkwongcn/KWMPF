import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildCoverage, serializeCoverage } from "./build-coverage";
import {
  parsePreviousCoverage,
  parseSourceSnapshot,
  readJsonFile,
} from "./input";

function valuesAfter(flag: string): string[] {
  const matches: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    const next = process.argv[index + 1];
    if (process.argv[index] === flag && next) matches.push(next);
  }
  return matches;
}

const sourcePaths = valuesAfter("--source");
for (const directory of valuesAfter("--source-dir")) {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".json"));
  sourcePaths.push(...names.sort().map((name) => join(directory, name)));
}
const outputPath = valuesAfter("--output")[0];
const previousPath = valuesAfter("--previous")[0];

if (sourcePaths.length === 0 || !outputPath) {
  throw new Error(
    "Usage: bun coverage:build (--source <snapshot.json> | --source-dir <directory>) --output <coverage.json> [--previous <coverage.json>]",
  );
}

const sources = await Promise.all(
  sourcePaths.map(async (path) => parseSourceSnapshot(await readJsonFile(path))),
);
const previous = previousPath
  ? parsePreviousCoverage(await readJsonFile(previousPath))
  : undefined;
const coverage = buildCoverage(sources, previous);

await writeFile(outputPath, serializeCoverage(coverage));
console.log(
  JSON.stringify({
    outputPath,
    records: coverage.records.length,
    current: coverage.records.filter((record) => record.current).length,
    pendingVerification: coverage.records.filter(
      (record) => record.status === "pending_verification",
    ).length,
    trusteeBatches: coverage.trusteeBatches.length,
    changes: {
      added: coverage.changes.added.length,
      removed: coverage.changes.removed.length,
      identityChanged: coverage.changes.identityChanged.length,
    },
  }),
);
