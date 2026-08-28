import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CategoryMapEntry, UnmappedFundClass } from "./lipper-category-map";

export type CategoryMapFile = {
  lipperSource: string;
  lipperCapturedAt: string;
  categoryCount: number;
  entries: CategoryMapEntry[];
  unmappedFundClasses: UnmappedFundClass[];
};

export type CategoryLookup = {
  capturedAt: string;
  source: string;
  categoryOf: (fundClassId: string) => string | undefined;
  unmappedIds: Set<string>;
};

export const DEFAULT_CATEGORY_MAP_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "data",
  "reference",
  "fund-class-category-map.json",
);

export function toCategoryLookup(file: CategoryMapFile): CategoryLookup {
  const byId = new Map(
    file.entries.map((entry) => [entry.fundClassId, entry.lipperCategory]),
  );

  return {
    capturedAt: file.lipperCapturedAt,
    source: file.lipperSource,
    categoryOf: (fundClassId) => byId.get(fundClassId),
    unmappedIds: new Set(
      file.unmappedFundClasses.map((entry) => entry.fundClassId),
    ),
  };
}

export async function loadCategoryLookup(
  path = DEFAULT_CATEGORY_MAP_PATH,
): Promise<CategoryLookup> {
  const file = JSON.parse(await readFile(path, "utf8")) as CategoryMapFile;
  if (!Array.isArray(file.entries) || file.entries.length === 0) {
    throw new Error(`Category map at ${path} has no entries`);
  }
  return toCategoryLookup(file);
}

export function assertCategoryCoverage(
  lookup: CategoryLookup,
  fundClassIds: string[],
) {
  const missing = fundClassIds.filter(
    (id) => !lookup.categoryOf(id) && !lookup.unmappedIds.has(id),
  );
  if (missing.length > 0) {
    throw new Error(
      `Category map covers neither entries nor unmapped list for ${missing.length} fund classes: ${missing.slice(0, 5).join(", ")}`,
    );
  }
}
