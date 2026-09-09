import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  allocationMapRequiresReview,
  buildAllocationLabelMap,
  mapDisclosureAllocation,
  toLabelLookup,
  type AllocationDimensionInput,
  type AllocationLabelMapFile,
} from "./allocation-label-map";
import type { FactSheetDisclosureFile } from "./fact-sheet-disclosure-lookup";

const repoRoot = resolve(import.meta.dirname, "../../..");
const outputPath = "data/reference/allocation-label-map.json";

async function readJson(path: string) {
  return JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));
}

async function readJsonIfPresent(path: string) {
  try {
    return await readJson(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function buildAllocationLabelMapFile(disclosuresPath: string) {
  const disclosures = (await readJson(disclosuresPath)) as FactSheetDisclosureFile;
  const previous = (await readJsonIfPresent(outputPath)) as AllocationLabelMapFile | undefined;
  const allocations = disclosures.funds.flatMap((fund) => fund.allocations ?? []) as AllocationDimensionInput[];
  const built = buildAllocationLabelMap(allocations, previous);
  const payload: AllocationLabelMapFile = {
    generatedAt: new Date().toISOString().slice(0, 10),
    source: disclosuresPath,
    ...built.file,
  };
  const lookup = toLabelLookup(payload);
  const coverage = { buckets: 0, notAssetClass: 0, inheritedUnavailable: 0 };
  for (const fund of disclosures.funds) {
    const mapped = mapDisclosureAllocation(
      {
        allocations: fund.allocations ?? [],
        unavailableFields: fund.unavailableFields,
        unavailableKinds: fund.unavailableKinds,
        factSheetAsOf: fund.factSheetAsOf,
      },
      lookup,
      payload.generatedAt,
    );
    if ("unavailable" in mapped && mapped.unavailable) {
      if (mapped.reason === "not-asset-class") coverage.notAssetClass += 1;
      else coverage.inheritedUnavailable += 1;
    } else {
      coverage.buckets += 1;
    }
  }
  await writeFile(resolve(repoRoot, outputPath), `${JSON.stringify(payload, null, 2)}\n`);
  return {
    outputPath,
    entries: payload.entries.length,
    bucketCounts: {
      equity: payload.entries.filter((entry) => entry.bucket === "equity").length,
      bond: payload.entries.filter((entry) => entry.bucket === "bond").length,
      cashAndOther: payload.entries.filter((entry) => entry.bucket === "cash_and_other").length,
      notAssetClass: payload.entries.filter((entry) => entry.bucket === "not_asset_class").length,
    },
    coverage,
    funds: disclosures.funds.length,
    diff: built.diff,
    requiresReview: Boolean(previous) && allocationMapRequiresReview(built.diff),
  };
}

if (import.meta.main) {
  const disclosuresPath = process.argv[2];
  if (!disclosuresPath) {
    console.error("usage: bun src/build-allocation-label-map.ts <fund-fact-sheet-disclosures.json>");
    process.exit(2);
  }
  const payload = await buildAllocationLabelMapFile(disclosuresPath);
  console.log(
    `${payload.outputPath}: ${payload.entries} labels (equity ${payload.bucketCounts.equity}, bond ${payload.bucketCounts.bond}, cash ${payload.bucketCounts.cashAndOther}, not-asset-class ${payload.bucketCounts.notAssetClass})`,
  );
  console.log(
    `funds: ${payload.funds}, mapped buckets ${payload.coverage.buckets}, not-asset-class ${payload.coverage.notAssetClass}, inherited unavailable ${payload.coverage.inheritedUnavailable}`,
  );
  console.log(
    `diff: +${payload.diff.added.length} -${payload.diff.removed.length} recategorized ${payload.diff.recategorized.length}`,
  );
  if (payload.requiresReview) {
    console.error("review required: new, removed or recategorized labels must be checked before publication");
    process.exit(1);
  }
}
