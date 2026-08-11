import { writeFile } from "node:fs/promises";
import { buildFirstOfficialBatchCoverage } from "./official-source-batch";
import { parsePreviousCoverage, parseSourceSnapshot, readJsonFile } from "./input";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function valuesAfter(name: string) {
  return process.argv.flatMap((value, index) => (value === name && process.argv[index + 1] ? [process.argv[index + 1]!] : []));
}

const platformPath = argument("--platform");
const schemePath = argument("--scheme");
const trusteePaths = valuesAfter("--trustee");
const outputPath = argument("--output");
const previousPath = argument("--previous");
if (!platformPath || !schemePath || trusteePaths.length === 0 || !outputPath) {
  throw new Error("Usage: bun coverage:first-batch --platform <snapshot.json> --scheme <snapshot.json> --trustee <snapshot.json>... --output <coverage.json> [--previous <coverage.json>]");
}

const [platform, scheme, trustees] = await Promise.all([
  readJsonFile(platformPath).then(parseSourceSnapshot),
  readJsonFile(schemePath).then(parseSourceSnapshot),
  Promise.all(trusteePaths.map((path) => readJsonFile(path).then(parseSourceSnapshot))),
]);
const previous = previousPath ? parsePreviousCoverage(await readJsonFile(previousPath)) : undefined;
const coverage = buildFirstOfficialBatchCoverage(platform, scheme, trustees, previous);
await writeFile(outputPath, `${JSON.stringify(coverage, null, 2)}\n`);
console.log(JSON.stringify({
  outputPath,
  records: coverage.records.length,
  verified: coverage.records.filter((record) => record.status === "verified").length,
  pendingVerification: coverage.records.filter((record) => record.status === "pending_verification").length,
}));
