import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 積金局的「基金便覽」按計劃發布，連結載於註冊強積金計劃登記冊。
 * 檔案編號的前綴代表計劃類型（MT 集成信託、IS 行業、ES 僱主營辦），
 * 不可由編號推算，只能照登記冊抄錄。
 */
export const FACT_SHEET_REGISTER_URL =
  "https://www.mpfa.org.hk/en/info-centre/public-registers/registered-mpf-schemes";

export type FactSheetLink = { scheme: string; factSheetUrl: string };

export type FactSheetLookup = {
  capturedAt: string;
  registerUrl: string;
  urlOf: (schemeName: string) => string | undefined;
};

export const FACT_SHEET_LINKS_FILENAME = "fund-fact-sheet-links.json";

const SOURCES_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "data",
  "sources",
);

const DATE_DIRECTORY = /^\d{4}-\d{2}-\d{2}$/;

export function toFactSheetLookup(
  capturedAt: string,
  links: FactSheetLink[],
): FactSheetLookup {
  const byScheme = new Map<string, string>();
  for (const link of links) {
    const url = link.factSheetUrl?.trim() ?? "";
    if (!url.startsWith("https://")) {
      throw new Error(
        `Fact sheet URL for ${link.scheme} must be an HTTPS URL, got ${link.factSheetUrl}`,
      );
    }
    if (byScheme.has(link.scheme)) {
      throw new Error(`Fact sheet links list ${link.scheme} more than once`);
    }
    byScheme.set(link.scheme, url);
  }
  return {
    capturedAt,
    registerUrl: FACT_SHEET_REGISTER_URL,
    urlOf: (schemeName) => byScheme.get(schemeName),
  };
}

/** 只把 YYYY-MM-DD 目錄視為來源批次，並取最新一個帶有連結檔的批次。 */
export async function loadFactSheetLookup(
  sourcesDirectory = SOURCES_DIRECTORY,
): Promise<FactSheetLookup> {
  const entries = await readdir(sourcesDirectory, { withFileTypes: true });
  const dated = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => DATE_DIRECTORY.test(name))
    .sort()
    .reverse();

  for (const capturedAt of dated) {
    const path = join(sourcesDirectory, capturedAt, FACT_SHEET_LINKS_FILENAME);
    const file = await readFile(path, "utf8").catch(() => undefined);
    if (file === undefined) continue;
    const links = JSON.parse(file) as FactSheetLink[];
    if (!Array.isArray(links) || links.length === 0) {
      throw new Error(`Fact sheet links at ${path} are empty`);
    }
    return toFactSheetLookup(capturedAt, links);
  }

  throw new Error(
    `No ${FACT_SHEET_LINKS_FILENAME} under any YYYY-MM-DD directory in ${sourcesDirectory}`,
  );
}

export function assertFactSheetCoverage(
  lookup: FactSheetLookup,
  schemeNames: string[],
) {
  const missing = [...new Set(schemeNames)].filter(
    (scheme) => !lookup.urlOf(scheme),
  );
  if (missing.length > 0) {
    throw new Error(
      `Fact sheet links cover ${missing.length} fewer schemes than the snapshot: ${missing.slice(0, 5).join(", ")}`,
    );
  }
}
