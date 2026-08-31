import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 受託人官網自己刊發的基金便覽。
 *
 * 積金局便覽庫的副本落後平台數據四至八個月（副本 2025-11-30 至 2026-03-31，平台 2026-07-31），
 * 受託人官網已經出到更新一期，所以內容抓官網、配對仍然用積金局登記冊那份權威名單。
 *
 * 呢份名單係人手由各受託人官網抄錄，唔係官方登記冊，所以：
 *
 * - **唔齊唔係錯**。抄唔到、官網改版、下載失敗都會退回積金局副本，退回本身唔係錯，
 *   但一定要喺報告同頁面標明用咗邊個來源、邊一期，唔可以靜靜哋當成最新版。
 * - **連結會不預告改版**，所以 `file` 明寫本機檔名，唔靠 URL 尾段推算。
 */

export const TRUSTEE_FACT_SHEET_LINKS_FILENAME = "trustee-fact-sheet-links.json";

export type TrusteeFactSheetLink = {
  scheme: string;
  /** 受託人官網的下載連結，詳情頁會連去呢度。 */
  factSheetUrl: string;
  /** 便覽 PDF 在本機的檔名。 */
  file: string;
};

export type TrusteeFactSheetLookup = {
  capturedAt?: string;
  linkOf: (schemeName: string) => TrusteeFactSheetLink | undefined;
  schemes: number;
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

export function toTrusteeFactSheetLookup(
  capturedAt: string,
  links: TrusteeFactSheetLink[],
): TrusteeFactSheetLookup {
  const byScheme = new Map<string, TrusteeFactSheetLink>();
  for (const link of links) {
    if (!link.factSheetUrl?.startsWith("https://")) {
      throw new Error(
        `Trustee fact sheet URL for ${link.scheme} must be an HTTPS URL, got ${link.factSheetUrl}`,
      );
    }
    if (!link.file?.trim()) {
      throw new Error(`Trustee fact sheet for ${link.scheme} must name a local file`);
    }
    if (byScheme.has(link.scheme)) {
      throw new Error(`Trustee fact sheet links list ${link.scheme} more than once`);
    }
    byScheme.set(link.scheme, link);
  }
  return {
    capturedAt,
    schemes: byScheme.size,
    linkOf: (schemeName) => byScheme.get(schemeName),
  };
}

/**
 * 只把 YYYY-MM-DD 目錄視為來源批次，取最新一個帶有名單的批次。
 *
 * 同 `fact-sheet-lookup.ts` 唔同：冇呢份名單**唔算錯**，全部計劃退回積金局副本就是。
 */
export async function loadTrusteeFactSheetLookup(
  sourcesDirectory = SOURCES_DIRECTORY,
): Promise<TrusteeFactSheetLookup> {
  const entries = await readdir(sourcesDirectory, { withFileTypes: true }).catch(
    () => [],
  );
  const dated = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => DATE_DIRECTORY.test(name))
    .sort()
    .reverse();

  for (const capturedAt of dated) {
    const path = join(sourcesDirectory, capturedAt, TRUSTEE_FACT_SHEET_LINKS_FILENAME);
    const raw = await readFile(path, "utf8").catch(() => undefined);
    if (raw === undefined) continue;
    const links = JSON.parse(raw) as TrusteeFactSheetLink[];
    if (!Array.isArray(links) || links.length === 0) {
      throw new Error(`Trustee fact sheet links at ${path} are empty`);
    }
    return toTrusteeFactSheetLookup(capturedAt, links);
  }

  return { schemes: 0, linkOf: () => undefined };
}
