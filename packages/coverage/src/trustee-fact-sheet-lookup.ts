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

/**
 * 逐隻基金一份便覽時，其中一份。
 *
 * 受託人唔一定出合併版：MASS 逐隻成分基金各自一份 PDF。呢類來源要逐份聲明對應
 * 邊隻成分基金——靠檔名或者次序猜，一改版就會把另一隻基金的配置同持倉貼落去。
 */
export type TrusteeFactSheetFund = {
  /** 平台的成分基金名稱。便覽抽到的區段名對唔上就報錯，唔會靜靜哋當配對到。 */
  constituentFund: string;
  /** 呢一份便覽自己的下載連結，詳情頁會連去呢度。 */
  factSheetUrl: string;
  /** 呢一份便覽 PDF 在本機的檔名。 */
  file: string;
};

export type TrusteeFactSheetLink = {
  scheme: string;
  /**
   * 受託人官網的下載連結。一個計劃一份便覽時就係嗰份 PDF；逐隻基金一份時，
   * 係列出全部便覽嗰一版，逐份自己的連結寫在 `funds`。
   */
  factSheetUrl: string;
  /** 一個計劃一份便覽時，便覽 PDF 在本機的檔名。 */
  file?: string;
  /** 逐隻基金一份便覽時，逐份各自的基金名、連結同檔名。同 `file` 二擇其一。 */
  funds?: TrusteeFactSheetFund[];
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

function validateFunds(scheme: string, funds: TrusteeFactSheetFund[]) {
  if (funds.length === 0) {
    throw new Error(`Trustee fact sheet list for ${scheme} names no funds`);
  }
  const names = new Set<string>();
  const files = new Set<string>();
  for (const fund of funds) {
    if (!fund.constituentFund?.trim()) {
      throw new Error(`Trustee fact sheet for ${scheme} must name the constituent fund it covers`);
    }
    if (!fund.factSheetUrl?.startsWith("https://")) {
      throw new Error(
        `Trustee fact sheet URL for ${scheme} ${fund.constituentFund} must be an HTTPS URL, got ${fund.factSheetUrl}`,
      );
    }
    if (!fund.file?.trim()) {
      throw new Error(
        `Trustee fact sheet for ${scheme} ${fund.constituentFund} must name a local file`,
      );
    }
    // 同一隻基金兩份便覽、或者兩隻基金指去同一份，都代表名單抄錯咗；
    // 靜靜哋揀其中一份等於把另一隻基金的披露貼落去。
    if (names.has(fund.constituentFund)) {
      throw new Error(`Trustee fact sheet list for ${scheme} lists ${fund.constituentFund} more than once`);
    }
    if (files.has(fund.file)) {
      throw new Error(`Trustee fact sheet list for ${scheme} uses ${fund.file} for more than one fund`);
    }
    names.add(fund.constituentFund);
    files.add(fund.file);
  }
}

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
    if (link.file?.trim() && link.funds) {
      throw new Error(
        `Trustee fact sheet for ${link.scheme} must name either one file or a per-fund list, not both`,
      );
    }
    if (!link.file?.trim() && !link.funds) {
      throw new Error(`Trustee fact sheet for ${link.scheme} must name a local file`);
    }
    if (link.funds) validateFunds(link.scheme, link.funds);
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
