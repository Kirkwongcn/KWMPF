import { readFile, writeFile } from "node:fs/promises";
import { buildPublicationInputs } from "./build-publication-input";
import { buildPublicationReadinessReport } from "./publication-readiness-report";
import { parseSourceSnapshot } from "./input";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const sourcePath = argument("--source");
const outputPath = argument("--output");
if (!sourcePath || !outputPath) {
  throw new Error(
    "Usage: bun coverage:readiness --source <platform-snapshot.json> --output <readiness.json>",
  );
}

const snapshot = parseSourceSnapshot(JSON.parse(await readFile(sourcePath, "utf8")));
const report = buildPublicationReadinessReport(
  buildPublicationInputs(snapshot.records),
);
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceSnapshot: sourcePath,
      sourceDataAsOf: snapshot.sourceDataAsOf,
      report,
    },
    null,
    2,
  )}\n`,
);
console.log(
  JSON.stringify({
    outputPath,
    inputRecords: report.inputRecords,
    acceptedRecords: report.acceptedRecords,
    blockedRecords: report.blockedRecords,
    unavailableByField: report.unavailableByField,
  }),
);
