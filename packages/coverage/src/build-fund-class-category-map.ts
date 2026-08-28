import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildLipperCategoryMap,
  categoryMapRequiresReview,
  diffCategoryMaps,
  type CategoryMapEntry,
  type CategoryMapOptions,
} from "./lipper-category-map";

const repoRoot = resolve(import.meta.dirname, "../../..");
const lipperPath = "data/reference/lipper-hk-pension-categories.json";
const outputPath = "data/reference/fund-class-category-map.json";

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

export async function buildFundClassCategoryMapFile(platformPath: string, options: CategoryMapOptions = {}) {
  const lipper = await readJson(lipperPath);
  const platform = await readJson(platformPath);
  const result = buildLipperCategoryMap(lipper.funds, platform.records, options);
  const previous = await readJsonIfPresent(outputPath);
  const diff = diffCategoryMaps((previous?.entries ?? []) as CategoryMapEntry[], result.entries);
  const payload = {
    generatedAt: new Date().toISOString().slice(0, 10),
    lipperSource: lipperPath,
    lipperCapturedAt: lipper.capturedAt,
    platformSnapshot: platformPath,
    platformDataAsOf: platform.sourceDataAsOf,
    categoryCount: new Set(result.entries.map((entry) => entry.lipperCategory)).size,
    entries: result.entries,
    unmappedFundClasses: result.unmappedFundClasses,
    unmatchedLipperFunds: result.unmatchedLipperFunds,
    reviewRequired: result.reviewRequired,
    diff,
    requiresReview: categoryMapRequiresReview(result, diff),
  };
  await writeFile(resolve(repoRoot, outputPath), `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

if (import.meta.main) {
  const platformPath = process.argv[2];
  if (!platformPath) {
    console.error("usage: bun src/build-fund-class-category-map.ts <platform-snapshot-path>");
    process.exit(2);
  }
  const payload = await buildFundClassCategoryMapFile(platformPath);
  console.log(`${outputPath}: ${payload.entries.length} entries across ${payload.categoryCount} categories`);
  console.log(
    `unmatched lipper: ${payload.unmatchedLipperFunds.length}, unmapped fund classes: ${payload.unmappedFundClasses.length}, review: ${payload.reviewRequired.length}`,
  );
  console.log(
    `diff: +${payload.diff.added.length} -${payload.diff.removed.length} recategorized ${payload.diff.recategorized.length}`,
  );
  if (payload.unmatchedLipperFunds.length > 0) {
    for (const item of payload.unmatchedLipperFunds) console.error(`unmatched: ${item.reason} ${item.sourceName}`);
    process.exit(1);
  }
}
