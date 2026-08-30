import { readFile, writeFile } from "node:fs/promises";
import {
  FUND_OVERVIEW_GRACE_DAYS,
  MONTHLY_GRACE_DAYS,
} from "./data-freshness";
import { buildPublicationInputs } from "./build-publication-input";
import { buildPublicationPayload } from "./build-publication-payload";
import {
  assertCategoryCoverage,
  loadCategoryLookup,
} from "./category-map-lookup";
import { loadFactSheetDisclosureLookup } from "./fact-sheet-disclosure-lookup";
import {
  assertFactSheetCoverage,
  loadFactSheetLookup,
} from "./fact-sheet-lookup";
import { publicationSnapshotId } from "./publication-snapshot-id";
import { parseSourceSnapshot } from "./input";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const sourcePath = argument("--source");
const outputPath = argument("--output");
if (!sourcePath || !outputPath) {
  throw new Error(
    "Usage: bun coverage:publication-seed --source <platform-snapshot.json> --output <seed.sql> [--snapshot <id>]",
  );
}

const snapshot = parseSourceSnapshot(JSON.parse(await readFile(sourcePath, "utf8")));
const snapshotId = argument("--snapshot") ?? publicationSnapshotId(snapshot);
const payload = buildPublicationPayload(buildPublicationInputs(snapshot.records));
if (!payload.ready) {
  throw new Error(`Publication preflight blocked ${payload.preflight.blocked} records`);
}

const categories = await loadCategoryLookup(argument("--category-map"));
assertCategoryCoverage(
  categories,
  payload.records.map((record) => record.fundClassId),
);

const factSheets = await loadFactSheetLookup(argument("--fact-sheet-sources"));
assertFactSheetCoverage(
  factSheets,
  payload.records.map((record) => record.identity.schemeName),
);

// 配置及十大持倉的覆蓋本來就唔齊（圖表式披露抽唔到、個別基金便覽未收錄），
// 所以只逐個基金類別查，查唔到就唔寫入 payload，唔做覆蓋率斷言。
const disclosures = await loadFactSheetDisclosureLookup(
  argument("--fact-sheet-disclosures"),
);

const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;
const statements = [
  "DELETE FROM current_publication;",
  "DELETE FROM fund_class_versions;",
  "DELETE FROM publication_snapshots;",
  `INSERT INTO publication_snapshots (snapshot_id, published_at) VALUES (${sqlString(snapshotId)}, ${sqlString(snapshot.retrievedAt)});`,
  ...payload.records.map((record) => {
    const sourceRecord = snapshot.records.find(
      (candidate) => candidate.fundClassId === record.fundClassId,
    );
    const fundClass = {
      id: record.fundClassId,
      ...record.identity,
      fundType: sourceRecord?.fundType ?? "",
      fundCategory: sourceRecord?.fundTypeDescriptor ?? "",
      lipperCategory: categories.categoryOf(record.fundClassId),
      annualizedReturn1y: record.publicFields?.annualizedReturn1y,
      ...record.publicFields,
      unavailableFields: record.unavailableFields ?? [],
      verificationStatus: record.status,
      dataAsOf: record.dataAsOf,
    };
    const factSheetDisclosure = disclosures.disclosureOf(record.fundClassId);
    const body = JSON.stringify({
      snapshotId,
      fundClass,
      classification: {
        provider: "Lipper",
        dataset: "Hong Kong Pension Fund Classification",
        capturedAt: categories.capturedAt,
        official: false,
      },
      schemeFactSheet: {
        url: factSheets.urlOf(record.identity.schemeName),
        capturedAt: factSheets.capturedAt,
        registerUrl: factSheets.registerUrl,
      },
      ...(factSheetDisclosure ? { factSheetDisclosure } : {}),
      provenance: {
        sourceUrl: record.sourceUrl,
        dataAsOf: record.dataAsOf,
        retrievedAt: snapshot.retrievedAt,
        verificationStatus: record.status,
        freshnessPolicy: {
          returnsGraceDays: MONTHLY_GRACE_DAYS,
          fundOverviewGraceDays: FUND_OVERVIEW_GRACE_DAYS,
        },
      },
    });
    return `INSERT INTO fund_class_versions (snapshot_id, fund_class_id, payload) VALUES (${sqlString(snapshotId)}, ${sqlString(record.fundClassId)}, ${sqlString(body)});`;
  }),
  `INSERT INTO current_publication (singleton, snapshot_id) VALUES (1, ${sqlString(snapshotId)});`,
];
await writeFile(outputPath, `${statements.join("\n")}\n`);
console.log(JSON.stringify({ outputPath, snapshotId, records: payload.records.length }));
