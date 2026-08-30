import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FactSheetDisclosure } from "./fact-sheet-allocation";

/**
 * 便覽的配置及十大持倉由 `coverage:fact-sheet-allocation-report --disclosures` 抽出，
 * 存放在來源批次目錄，供 `publication-seed` 逐個基金類別帶入 payload。
 *
 * 配對唔到的基金唔會出現喺呢份檔，查唔到就係「官方未提供」，唔可以拎同計劃另一隻基金頂上。
 * 便覽的截至日期同平台快照唔同期（現時差四至八個月），所以每筆各自帶住自己的
 * `factSheetAsOf`，唔可以沿用平台的 `dataAsOf`。
 */

export const FACT_SHEET_DISCLOSURES_FILENAME = "fund-fact-sheet-disclosures.json";

export type FactSheetDisclosureFund = {
  fundClassIds: string[];
  schemeName: string;
  constituentFundName: string;
  factSheetFile: string;
  factSheetAsOf: string;
  allocations: FactSheetDisclosure["allocations"];
  topHoldings: FactSheetDisclosure["topHoldings"];
  unavailableFields: string[];
  unavailableReasons: Record<string, string>;
  unavailableKinds: FactSheetDisclosure["unavailableKinds"];
};

export type FactSheetDisclosureFile = {
  generatedAt: string;
  platformSnapshot: string;
  factSheetBatch: string;
  funds: FactSheetDisclosureFund[];
};

/** 帶入 payload 的一份披露，已經剝走只有覆蓋報告先用到的基金類別清單。 */
export type PublishedFactSheetDisclosure = Omit<
  FactSheetDisclosureFund,
  "fundClassIds"
>;

export type FactSheetDisclosureLookup = {
  capturedAt: string;
  funds: number;
  disclosureOf: (fundClassId: string) => PublishedFactSheetDisclosure | undefined;
};

const SOURCES_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "data",
  "sources",
);

const DATE_DIRECTORY = /^\d{4}-\d{2}-\d{2}$/;

export function toFactSheetDisclosureLookup(
  capturedAt: string,
  file: FactSheetDisclosureFile,
): FactSheetDisclosureLookup {
  const byFundClassId = new Map<string, PublishedFactSheetDisclosure>();
  for (const { fundClassIds, ...disclosure } of file.funds) {
    for (const fundClassId of fundClassIds) {
      // 一個基金類別只可以對應一份披露。撞名代表配對層漏咗一個重複區段，
      // 靜靜哋覆蓋就會把另一隻基金的持倉貼落呢隻基金度。
      if (byFundClassId.has(fundClassId)) {
        throw new Error(
          `Fact sheet disclosures list ${fundClassId} more than once`,
        );
      }
      byFundClassId.set(fundClassId, disclosure);
    }
  }
  return {
    capturedAt,
    funds: byFundClassId.size,
    disclosureOf: (fundClassId) => byFundClassId.get(fundClassId),
  };
}

/** 只把 YYYY-MM-DD 目錄視為來源批次，並取最新一個帶有披露檔的批次。 */
export async function loadFactSheetDisclosureLookup(
  sourcesDirectory = SOURCES_DIRECTORY,
): Promise<FactSheetDisclosureLookup> {
  const entries = await readdir(sourcesDirectory, { withFileTypes: true });
  const dated = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => DATE_DIRECTORY.test(name))
    .sort()
    .reverse();

  for (const capturedAt of dated) {
    const path = join(sourcesDirectory, capturedAt, FACT_SHEET_DISCLOSURES_FILENAME);
    const raw = await readFile(path, "utf8").catch(() => undefined);
    if (raw === undefined) continue;
    const file = JSON.parse(raw) as FactSheetDisclosureFile;
    if (!Array.isArray(file.funds) || file.funds.length === 0) {
      throw new Error(`Fact sheet disclosures at ${path} are empty`);
    }
    return toFactSheetDisclosureLookup(capturedAt, file);
  }

  throw new Error(
    `No ${FACT_SHEET_DISCLOSURES_FILENAME} under any YYYY-MM-DD directory in ${sourcesDirectory}`,
  );
}
