import { writeFile } from "node:fs/promises";
import { buildOfficialBatchCoverage } from "./official-source-batch";
import { parseSourceSnapshot, readJsonFile } from "./input";

function valuesAfter(name: string) {
  return process.argv.flatMap((value, index) => (value === name && process.argv[index + 1] ? [process.argv[index + 1]!] : []));
}

const platformPath = valuesAfter("--platform")[0];
const schemePaths = valuesAfter("--scheme");
const trusteePaths = valuesAfter("--trustee");
const outputPath = valuesAfter("--output")[0];
if (!platformPath || schemePaths.length !== 3 || trusteePaths.length !== 11 || !outputPath) {
  throw new Error("Usage: bun coverage:remaining-batch --platform <snapshot.json> --scheme <snapshot.json>... --trustee <snapshot.json>... --output <coverage.json>");
}

const [platform, schemes, trustees] = await Promise.all([
  readJsonFile(platformPath).then(parseSourceSnapshot),
  Promise.all(schemePaths.map((path) => readJsonFile(path).then(parseSourceSnapshot))),
  Promise.all(trusteePaths.map((path) => readJsonFile(path).then(parseSourceSnapshot))),
]);
const coverage = buildOfficialBatchCoverage(platform, schemes, trustees);
await writeFile(outputPath, `${JSON.stringify(coverage, null, 2)}\n`);
console.log(JSON.stringify({
  outputPath,
  records: coverage.records.length,
  verified: coverage.records.filter((record) => record.status === "verified").length,
  pendingVerification: coverage.records.filter((record) => record.status === "pending_verification").length,
}));
