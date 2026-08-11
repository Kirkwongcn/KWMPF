import { readFile, writeFile } from "node:fs/promises";

type RecordItem = {
  fundClassId: string;
  identity: { trusteeName: string; schemeName: string; constituentFundName: string };
  dataAsOf: string;
  sourceUrl?: string;
};

type Source = { sourceUrl: string; retrievedAt: string; records: RecordItem[] };

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const sourcePath = argument("--source");
const outputPath = argument("--output");
if (!sourcePath || !outputPath) throw new Error("Usage: bun coverage:fact-sheet-index --source <coverage.json> --output <index.json>");

const source = JSON.parse(await readFile(sourcePath, "utf8")) as Source;
const groups = new Map<string, RecordItem[]>();
for (const record of source.records) {
  const group = `${record.identity.trusteeName}\u0000${record.identity.schemeName}`;
  groups.set(group, [...(groups.get(group) ?? []), record]);
}

const entries = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, records]) => ({
  trusteeName: records[0]!.identity.trusteeName,
  schemeName: records[0]!.identity.schemeName,
  expectedFundClasses: new Set(records.map((record) => record.fundClassId)).size,
  expectedConstituentFunds: new Set(records.map((record) => record.identity.constituentFundName)).size,
  coverageDataAsOf: records.map((record) => record.dataAsOf).sort()[0],
  officialRepositoryUrl: [...new Set(records.map((record) => record.sourceUrl).filter(Boolean))].sort()[0] ?? null,
  status: "pending_download" as const,
}))

await writeFile(outputPath, `${JSON.stringify({ generatedAt: source.retrievedAt, sourceUrl: source.sourceUrl, entries }, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, schemes: entries.length, fundClasses: entries.reduce((sum, entry) => sum + entry.expectedFundClasses, 0), status: "pending_download" }));
