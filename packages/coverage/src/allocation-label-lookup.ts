import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  mapDisclosureAllocation,
  toLabelLookup,
  type AllocationLabelMapFile,
  type LabelBucket,
  type MappedAllocation,
} from "./allocation-label-map";
import type { PublishedFactSheetDisclosure } from "./fact-sheet-disclosure-lookup";

export const DEFAULT_ALLOCATION_LABEL_MAP_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "data",
  "reference",
  "allocation-label-map.json",
);

export type AllocationLabelLookup = {
  version: string;
  source: string;
  lookup: ReadonlyMap<string, LabelBucket>;
  mapOf: (disclosure: PublishedFactSheetDisclosure) => MappedAllocation;
};

export function toAllocationLabelLookup(file: AllocationLabelMapFile): AllocationLabelLookup {
  if (!Array.isArray(file.entries) || file.entries.length === 0) {
    throw new Error("Allocation label map has no entries");
  }
  const lookup = toLabelLookup(file);
  return {
    version: file.generatedAt,
    source: file.source,
    lookup,
    mapOf: (disclosure) =>
      mapDisclosureAllocation(
        {
          allocations: disclosure.allocations,
          unavailableFields: disclosure.unavailableFields,
          unavailableKinds: disclosure.unavailableKinds,
          factSheetAsOf: disclosure.factSheetAsOf,
        },
        lookup,
        file.generatedAt,
      ),
  };
}

export async function loadAllocationLabelLookup(
  path = DEFAULT_ALLOCATION_LABEL_MAP_PATH,
): Promise<AllocationLabelLookup> {
  const file = JSON.parse(await readFile(path, "utf8")) as AllocationLabelMapFile;
  return toAllocationLabelLookup(file);
}
