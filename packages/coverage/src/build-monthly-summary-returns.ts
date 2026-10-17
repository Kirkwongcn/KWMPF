import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseSourceSnapshot } from "./input";
import { matchBctRows, parseBctFundInformation } from "./bct-fund-performance";
import { parseBociPrudentialListing } from "./boci-prudential-mpf-listing";
import {
  matchSummaryRows,
  parseMonthlySummary,
  recordsWithSameName,
  type MonthlySummary,
} from "./monthly-performance-summary-parser";
import { parseManulifeMonthlySummary } from "./manulife-monthly-summary-parser";
import { matchSunLifeRows, parseSunLifeCumulativePerformance } from "./sun-life-mpf-performance";
import { parseYfLifeMonthlyPerformance } from "./yf-life-monthly-performance-parser";
import {
  DocumentRejectedError,
  verifyDocument,
  type MatchedRow,
  type OfficialSourceConflict,
  type SourceDocument,
} from "./monthly-return-cross-check";
import { parseHkifaLipperMpfTable, readGrowth } from "./hkifa-lipper-mpf-table-parser";
import type { HkifaLipperMapEntry } from "./hkifa-lipper-fund-map";
import {
  mergeCumulativeObservations,
  splitReturnObservations,
  validateOfficialCumulativeReturnObservations,
  validateOfficialReturnObservations,
  type OfficialCumulativeReturnObservation,
} from "./official-return-overlay";

/**
 * 由受託人官方每月數據讀出三年累積回報（ADR 0014），併入新一份受託人回報候選檔。
 * 年率化紀錄原樣保留；累積紀錄只會由截至日期較新的取代。
 *
 * 來源：
 * - `--summary`：滙豐／恒生《每月基金表現摘要》PDF 主表；
 * - `--bct`：銀聯信託官網基金表現數據接口（JSON 回應原檔）；
 * - `--manulife`：宏利環球精選《每月摘要 Monthly Fund Summary》PDF（`pdftotext -bbox` 按欄位讀）；
 * - `--bocpru`：中銀國際英國保誠信託官網強積金價格及表現數據接口（JSON 回應原檔）；
 * - `--sunlife`：永明金融官網強積金基金價格及表現累積回報數據接口（JSON 回應原檔）；
 * - `--yflife`：萬通信託每月《Monthly Fund Performance of the Scheme》PDF（`pdftotext -bbox` 按欄位讀）；
 * - `--hkifa "<url>|<pdf>|<retrievedAt>"` 加 `--hkifa-map <對照表>`：香港投資基金公會轉載嘅 Lipper
 *   《MPF Performance Table》（第三方，ADR 0015）。只用對照表有嘅行，每行一年同平台同期核對；
 *   紀錄帶 `publisher: "hkifa-lipper"`，受託人數字優先（見下面合併規則）。
 *
 * 用法：
 *   bun src/build-monthly-summary-returns.ts --source <platform.json> \
 *     --base-candidate <old-candidate.json> \
 *     [--summary "<scheme>|<url>|<pdf>|<retrievedAt>" …] \
 *     [--bct "<scheme>|<url>|<json>|<retrievedAt>" …] \
 *     [--manulife "<scheme>|<url>|<pdf>|<retrievedAt>" …] \
 *     [--bocpru "<scheme>|<url>|<json>|<retrievedAt>" …] \
 *     [--sunlife "<scheme>|<url>|<json>|<retrievedAt>" …] \
 *     [--yflife "<scheme>|<url>|<pdf>|<retrievedAt>" …] \
 *     --output <new-candidate.json> --report <report.json> \
 *     [--check-source <platform.json>]
 *
 * `--check-source` 係用嚟做一年交叉核對的平台快照（預設同 --source），日期要同來源一樣。
 *
 * 任何一份文件有一行對唔上、同名多過一個類別、或者一年回報同積金局平台同期數字唔一致
 * （代表讀錯欄或者類別對調），成份文件作廢，唔出局部資料；作廢原因寫入報告的
 * `rejectedSources`，其他文件照用。全部文件都作廢先報錯。
 * 例外（ADR 0016）：一行一年通過而 5／10 年累積同平台同期（`dataAsOf` 相同）嚴格比較唔等，
 * 屬官方來源衝突：只隔離該行（該行連三年都唔發布，見 `monthly-return-cross-check.ts`），
 * 兩個官方數字連各自日期記入報告 `officialConflicts`；該文件其餘行照用。全部行都衝突
 * 即視同整份作廢。
 */

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function argumentsNamed(name: string) {
  return process.argv.flatMap((value, index) =>
    value === name && process.argv[index + 1] ? [process.argv[index + 1]!] : [],
  );
}

const sourcePath = argument("--source");
const basePath = argument("--base-candidate");
const outputPath = argument("--output");
const reportPath = argument("--report");
const summaries = argumentsNamed("--summary");
const bctResponses = argumentsNamed("--bct");
const manulifeSummaries = argumentsNamed("--manulife");
const bocPruListings = argumentsNamed("--bocpru");
const sunLifeResponses = argumentsNamed("--sunlife");
const yfLifeSummaries = argumentsNamed("--yflife");
const hkifaTables = argumentsNamed("--hkifa");
const hkifaMapPath = argument("--hkifa-map");
if (hkifaTables.length > 0 && !hkifaMapPath) throw new Error("--hkifa needs --hkifa-map <data/reference/hkifa-lipper-fund-map.json>");
if (
  !sourcePath ||
  !basePath ||
  !outputPath ||
  !reportPath ||
  summaries.length + bctResponses.length + manulifeSummaries.length + bocPruListings.length + sunLifeResponses.length + yfLifeSummaries.length + hkifaTables.length === 0
)
  throw new Error(
    'Usage: bun src/build-monthly-summary-returns.ts --source <platform.json> --base-candidate <candidate.json> [--summary "<scheme>|<url>|<pdf>|<retrievedAt>"] [--bct "<scheme>|<url>|<json>|<retrievedAt>"] [--manulife "<scheme>|<url>|<pdf>|<retrievedAt>"] [--bocpru "<scheme>|<url>|<json>|<retrievedAt>"] [--sunlife "<scheme>|<url>|<json>|<retrievedAt>"] [--yflife "<scheme>|<url>|<pdf>|<retrievedAt>"] [--hkifa "<url>|<pdf>|<retrievedAt>" --hkifa-map <map.json>] --output <candidate.json> --report <report.json>',
  );

const snapshot = parseSourceSnapshot(JSON.parse(await readFile(sourcePath, "utf8")));
const checkSnapshot = argument("--check-source")
  ? parseSourceSnapshot(
      JSON.parse(await readFile(argument("--check-source")!, "utf8")),
    )
  : snapshot;
const knownIds = new Set(snapshot.records.map((record) => record.fundClassId));
const base = splitReturnObservations(
  JSON.parse(await readFile(basePath, "utf8")) as unknown[],
);

// 主表只可以喺一頁；搵到多過一頁有主表表頭（例如跨頁）就成份作廢，唔出局部資料。
function summaryPage(pdfPath: string): { page: number; summary: MonthlySummary } {
  const info = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  const pages = Number(/Pages:\s+(\d+)/u.exec(info)?.[1]);
  const found: { page: number; text: string }[] = [];
  for (let page = 1; page <= pages; page += 1) {
    const text = execFileSync(
      "pdftotext",
      ["-layout", "-f", String(page), "-l", String(page), pdfPath, "-"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    if (/Calendar Year Return/u.test(text) && /3-Years/u.test(text))
      found.push({ page, text });
  }
  if (found.length !== 1)
    throw new Error(
      `${pdfPath}: expected the main table on exactly one page, found ${found.length}`,
    );
  return { page: found[0]!.page, summary: parseMonthlySummary(found[0]!.text) };
}

// `MatchedRow`／`SourceDocument`／`verifyDocument` 見 monthly-return-cross-check.ts（ADR 0016 抽出）。

function splitEntry(entry: string, flag: string) {
  const [schemeName, url, path, retrievedAt] = entry.split("|");
  if (!schemeName || !url || !path || !retrievedAt)
    throw new Error(`Bad ${flag} value: ${entry}`);
  if (!url.startsWith("https://")) throw new Error(`${flag} source must be https: ${url}`);
  return { schemeName, url, path, retrievedAt };
}

function schemeRecordsOf(schemeName: string) {
  const records = snapshot.records.filter((record) => record.identity.schemeName === schemeName);
  if (records.length === 0) throw new Error(`Unknown scheme: ${schemeName}`);
  return records;
}

async function readSummary(entry: string): Promise<SourceDocument> {
  const { schemeName, url, path, retrievedAt } = splitEntry(entry, "--summary");
  const bytes = await readFile(path);
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error(`${path}: not a PDF`);
  const { page, summary } = summaryPage(path);
  const matches = matchSummaryRows(
    summary.rows,
    schemeRecordsOf(schemeName).map((record) => ({
      fundClassId: record.fundClassId,
      constituentFundName: record.identity.constituentFundName,
    })),
  );
  return {
    kind: "monthly-summary-pdf",
    schemeName,
    url,
    retrievedAt,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    page,
    dataAsOf: summary.dataAsOf,
    rows: summary.rows.length,
    failed: matches
      .filter((match) => match.status !== "matched")
      .map((match) => `${match.row.englishName} (${match.status})`),
    matched: matches.flatMap((match) =>
      match.status === "matched"
        ? [
            {
              fundClassId: match.fundClassId,
              label: match.row.englishName,
              oneYear: match.row.cumulative.oneYear,
              threeYears: match.row.cumulative.threeYears,
              fiveYears: match.row.cumulative.fiveYears,
              tenYears: match.row.cumulative.tenYears,
              printedThreeYears: match.row.printed[3]!,
            },
          ]
        : [],
    ),
  };
}

async function readBct(entry: string): Promise<SourceDocument> {
  const { schemeName, url, path, retrievedAt } = splitEntry(entry, "--bct");
  const bytes = await readFile(path);
  const performance = parseBctFundInformation(JSON.parse(bytes.toString("utf8")));
  const matches = matchBctRows(
    performance.rows,
    schemeRecordsOf(schemeName).map((record) => ({
      fundClassId: record.fundClassId,
      constituentFundName: record.identity.constituentFundName,
      fundClassName: record.identity.fundClassName,
    })),
  );
  return {
    kind: "bct-fund-information",
    schemeName,
    url,
    retrievedAt,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    dataAsOf: performance.performanceDate,
    rows: performance.rows.length,
    failed: matches
      .filter((match) => match.status !== "matched")
      .map((match) => `${match.row.name} ${match.row.unitClass} (${match.status})`),
    matched: matches.flatMap((match) =>
      match.status === "matched"
        ? [
            {
              fundClassId: match.fundClassId,
              label: `${match.row.name} ${match.row.unitClass}`,
              oneYear: match.row.oneYear,
              threeYears: match.row.threeYears,
              fiveYears: match.row.fiveYears,
              tenYears: match.row.tenYears,
              printedThreeYears: match.row.printedThreeYears,
            },
          ]
        : [],
    ),
  };
}

async function readManulife(entry: string): Promise<SourceDocument> {
  const { schemeName, url, path, retrievedAt } = splitEntry(entry, "--manulife");
  const bytes = await readFile(path);
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error(`${path}: not a PDF`);
  const bbox = execFileSync("pdftotext", ["-bbox", path, "-"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
  const summary = parseManulifeMonthlySummary(bbox);
  const records = schemeRecordsOf(schemeName).map((record) => ({
    fundClassId: record.fundClassId,
    constituentFundName: record.identity.constituentFundName,
  }));
  const matches = summary.rows.map((row) => ({ row, candidates: recordsWithSameName(records, row.englishName) }));
  return {
    kind: "manulife-monthly-summary-pdf",
    schemeName,
    url,
    retrievedAt,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    dataAsOf: summary.dataAsOf,
    rows: summary.rows.length,
    failed: matches
      .filter((match) => match.candidates.length !== 1)
      .map((match) => `${match.row.englishName} (${match.candidates.length === 0 ? "unmatched" : "ambiguous"})`),
    matched: matches.flatMap(({ row, candidates }) =>
      candidates.length === 1
        ? [
            {
              fundClassId: candidates[0]!.fundClassId,
              label: `${row.code} ${row.englishName}`,
              oneYear: row.oneYear,
              threeYears: row.threeYears,
              fiveYears: row.fiveYears,
              tenYears: row.tenYears,
              printedThreeYears: row.printedThreeYears,
              printedFiveYears: row.printedFiveYears,
              printedTenYears: row.printedTenYears,
            },
          ]
        : [],
    ),
  };
}

// 接口係 POST（body `{"Lang":"en"}`），`url` 記公開網頁「強積金價格及表現」，原檔 SHA-256 記接口回應。
async function readBocPru(entry: string): Promise<SourceDocument> {
  const { schemeName, url, path, retrievedAt } = splitEntry(entry, "--bocpru");
  const bytes = await readFile(path);
  const listing = parseBociPrudentialListing(JSON.parse(bytes.toString("utf8")));
  const records = schemeRecordsOf(schemeName).map((record) => ({
    fundClassId: record.fundClassId,
    constituentFundName: record.identity.constituentFundName,
  }));
  const matches = listing.rows.map((row) => ({ row, candidates: recordsWithSameName(records, row.name) }));
  return {
    kind: "boci-prudential-mpf-listing",
    schemeName,
    url,
    retrievedAt,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    dataAsOf: listing.asOfDate,
    rows: listing.rows.length,
    failed: matches
      .filter((match) => match.candidates.length !== 1)
      .map((match) => `${match.row.name} (${match.candidates.length === 0 ? "unmatched" : "ambiguous"})`),
    matched: matches.flatMap(({ row, candidates }) =>
      candidates.length === 1
        ? [
            {
              fundClassId: candidates[0]!.fundClassId,
              label: `${row.stockCode} ${row.name}`,
              oneYear: row.oneYear,
              threeYears: row.threeYears,
              fiveYears: row.fiveYears,
              // 接口冇十年欄（`tenY` 永遠留空），唔核對十年。
              tenYears: null,
              printedThreeYears: row.printedThreeYears,
            },
          ]
        : [],
    ),
  };
}

async function readYfLife(entry: string): Promise<SourceDocument> {
  const { schemeName, url, path, retrievedAt } = splitEntry(entry, "--yflife");
  const bytes = await readFile(path);
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error(`${path}: not a PDF`);
  const bbox = execFileSync("pdftotext", ["-bbox", path, "-"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
  const performance = parseYfLifeMonthlyPerformance(bbox);
  const records = schemeRecordsOf(schemeName).map((record) => ({
    fundClassId: record.fundClassId,
    constituentFundName: record.identity.constituentFundName,
  }));
  const matches = performance.rows.map((row) => ({ row, candidates: recordsWithSameName(records, row.englishName) }));
  return {
    kind: "yf-life-monthly-performance-pdf",
    schemeName,
    url,
    retrievedAt,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    dataAsOf: performance.dataAsOf,
    rows: performance.rows.length,
    failed: matches
      .filter((match) => match.candidates.length !== 1)
      .map((match) => `${match.row.englishName} (${match.candidates.length === 0 ? "unmatched" : "ambiguous"})`),
    matched: matches.flatMap(({ row, candidates }) =>
      candidates.length === 1
        ? [
            {
              fundClassId: candidates[0]!.fundClassId,
              label: row.englishName,
              oneYear: row.oneYear,
              threeYears: row.threeYears,
              // 表只有 3 個月、1 年、3 年；五年、十年唔核對。
              fiveYears: null,
              tenYears: null,
              printedThreeYears: row.printedThreeYears,
            },
          ]
        : [],
    ),
  };
}

// 接口係 POST，`url` 記公開網頁「強積金基金價格及表現」，原檔 SHA-256 記接口回應。
async function readSunLife(entry: string): Promise<SourceDocument> {
  const { schemeName, url, path, retrievedAt } = splitEntry(entry, "--sunlife");
  const bytes = await readFile(path);
  const performance = parseSunLifeCumulativePerformance(JSON.parse(bytes.toString("utf8")));
  const matches = matchSunLifeRows(
    performance.rows,
    schemeRecordsOf(schemeName).map((record) => ({
      fundClassId: record.fundClassId,
      constituentFundName: record.identity.constituentFundName,
      fundClassName: record.identity.fundClassName,
    })),
  );
  const label = (row: { name: string; unitClass: string | null }) => `${row.name}${row.unitClass ? ` Class ${row.unitClass}` : ""}`;
  return {
    kind: "sun-life-mpf-cumulative-performance",
    schemeName,
    url,
    retrievedAt,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    dataAsOf: performance.valuationDate,
    rows: performance.rows.length,
    failed: matches.filter((match) => match.status !== "matched").map((match) => `${label(match.row)} (${match.status})`),
    matched: matches.flatMap((match) =>
      match.status === "matched"
        ? [
            {
              fundClassId: match.fundClassId,
              label: label(match.row),
              oneYear: match.row.oneYear,
              threeYears: match.row.threeYears,
              fiveYears: match.row.fiveYears,
              tenYears: match.row.tenYears,
              printedThreeYears: match.row.printedThreeYears,
            },
          ]
        : [],
    ),
  };
}

/**
 * Lipper 表（第三方，ADR 0015）：只按對照表精確查行名；對照表每一行都要喺表入面剛好出現一次，
 * 一年要同積金局平台同期一年回報完全相等。有任何一行唔啱，成份作廢（紅線 3）。三年空格（成立未滿
 * 三年）唔出紀錄。
 */
async function readHkifa(entry: string) {
  const [url, path, retrievedAt] = entry.split("|");
  if (!url || !path || !retrievedAt) throw new Error(`Bad --hkifa value: ${entry}`);
  if (!url.startsWith("https://")) throw new Error(`--hkifa source must be https: ${url}`);
  const bytes = await readFile(path);
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error(`${path}: not a PDF`);
  const bbox = execFileSync("pdftotext", ["-bbox", path, "-"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
  const table = parseHkifaLipperMpfTable(bbox);
  const map = JSON.parse(await readFile(hkifaMapPath!, "utf8")) as { entries: HkifaLipperMapEntry[] };
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const problems: string[] = [];
  const observations: OfficialCumulativeReturnObservation[] = [];
  let noThreeYear = 0;
  for (const mapped of map.entries) {
    const rows = table.rows.filter((row) => row.name === mapped.lipperName);
    if (rows.length !== 1) {
      problems.push(`"${mapped.lipperName}" appears ${rows.length} time(s)`);
      continue;
    }
    if (!knownIds.has(mapped.fundClassId)) {
      problems.push(`${mapped.fundClassId} is not in the platform snapshot`);
      continue;
    }
    const row = rows[0]!;
    const where = `"${row.name}"`;
    let oneYear: number | null;
    let threeYears: { value: number | null; printed: string };
    try {
      oneYear = readGrowth(row.oneYear, `${where} 1-year`).value;
      threeYears = readGrowth(row.threeYears, `${where} 3-year`);
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    const platform = checkSnapshot.records.find((record) => record.fundClassId === mapped.fundClassId)?.returns?.[1];
    if (!platform || platform.dataAsOf !== table.dataAsOf || oneYear === null || platform.cumulative !== oneYear) {
      problems.push(
        `${mapped.fundClassId} ${where} one-year ${oneYear} vs platform ${platform?.cumulative} (${platform?.dataAsOf ?? "none"})`,
      );
      continue;
    }
    if (threeYears.value === null) {
      noThreeYear += 1;
      continue;
    }
    observations.push({
      fundClassId: mapped.fundClassId,
      periodYears: 3,
      basis: "cumulative",
      cumulative: threeYears.value,
      printed: threeYears.printed,
      dataAsOf: table.dataAsOf,
      sourceUrl: url,
      retrievedAt,
      sourceSha256: sha256,
      publisher: "hkifa-lipper",
    });
  }
  if (problems.length > 0) throw new Error(`HKIFA Lipper table rejected: ${problems.join("; ")}`);
  return {
    observations,
    source: {
      kind: "hkifa-lipper-mpf-table-pdf",
      publisher: "hkifa-lipper",
      url,
      retrievedAt,
      sha256,
      bytes: bytes.length,
      dataAsOf: table.dataAsOf,
      rows: table.rows.length,
      mapped: map.entries.length,
      oneYearCrossChecks: map.entries.length,
      noThreeYear,
    },
  };
}

// 每份文件獨立：一份作廢（讀唔到、對唔上、核對唔一致）只影響自己，其他照用（紅線 3 以文件為單位）。
const sources = [];
const rejected: { flag: string; entry: string; reason: string }[] = [];
const officialConflicts: OfficialSourceConflict[] = [];
const fresh: OfficialCumulativeReturnObservation[] = [];
const inputs = [
  ...summaries.map((entry) => ({ flag: "--summary", entry, read: () => readSummary(entry) })),
  ...bctResponses.map((entry) => ({ flag: "--bct", entry, read: () => readBct(entry) })),
  ...manulifeSummaries.map((entry) => ({ flag: "--manulife", entry, read: () => readManulife(entry) })),
  ...bocPruListings.map((entry) => ({ flag: "--bocpru", entry, read: () => readBocPru(entry) })),
  ...sunLifeResponses.map((entry) => ({ flag: "--sunlife", entry, read: () => readSunLife(entry) })),
  ...yfLifeSummaries.map((entry) => ({ flag: "--yflife", entry, read: () => readYfLife(entry) })),
];
for (const input of inputs) {
  try {
    const document = await input.read();
    const { observations, source, conflicts } = verifyDocument(document, {
      schemeRecords: schemeRecordsOf(document.schemeName),
      checkRecords: checkSnapshot.records,
    });
    fresh.push(...observations);
    sources.push(source);
    for (const conflict of conflicts) officialConflicts.push(conflict);
    if (source.quarantinedRows.length > 0)
      console.error(
        `QUARANTINED ${input.flag} rows (official-source conflict, ADR 0016): ${source.quarantinedRows.join(", ")}; both official numbers recorded in the report's officialConflicts`,
      );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // 整份作廢前已登記嘅官方來源衝突唔可以隨 throw 丟失（ADR 0016）：數字連來源記入報告登記表。
    if (error instanceof DocumentRejectedError) for (const conflict of error.conflicts) officialConflicts.push(conflict);
    rejected.push({ flag: input.flag, entry: input.entry, reason });
    console.error(`REJECTED ${input.flag} ${input.entry.split("|")[0]}: ${reason}`);
  }
}
const thirdParty: OfficialCumulativeReturnObservation[] = [];
const thirdPartySources: Awaited<ReturnType<typeof readHkifa>>["source"][] = [];
for (const entry of hkifaTables) {
  try {
    const { observations, source } = await readHkifa(entry);
    thirdParty.push(...observations);
    thirdPartySources.push(source);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    rejected.push({ flag: "--hkifa", entry, reason });
    console.error(`REJECTED --hkifa ${entry.split("|")[0]}: ${reason}`);
  }
}
if (sources.length + thirdPartySources.length === 0)
  throw new Error(`Every source was rejected: ${rejected.map((item) => item.reason).join(" | ")}`);

// ADR 0016 第 2 節：衝突隔離嘅行唔可以用第三方補位——Lipper 表如有本次受託人衝突隔離嘅行，
// 剔走並記入報告（衝突未喺兩間官方之間澄清前，唔發布任何一方補出嚟嘅數字）。
const quarantinedIds = new Set(sources.flatMap((source) => source.quarantinedRows as string[]));
const thirdPartySuppressedForConflicts: string[] = [];
const usableThirdParty = thirdParty.filter((observation) => {
  if (!quarantinedIds.has(observation.fundClassId)) return true;
  thirdPartySuppressedForConflicts.push(observation.fundClassId);
  return false;
});
if (thirdPartySuppressedForConflicts.length > 0)
  console.error(
    `SUPPRESSED --hkifa rows for official-source conflict quarantine (ADR 0016): ${thirdPartySuppressedForConflicts.join(", ")}`,
  );

// 舊候選檔的累積紀錄一定要對得上今次平台快照，否則發布時先爆，喺呢度就停。
const orphaned = base.cumulative.filter((row) => !knownIds.has(row.fundClassId));
if (orphaned.length > 0)
  throw new Error(
    `Base candidate has cumulative rows for unknown fund classes: ${orphaned.map((row) => row.fundClassId).join(", ")}`,
  );
// 受託人優先、同日原文要一致等合併規則見 mergeCumulativeObservations（ADR 0014、0015）。
const { cumulative, replaced, keptNewer, keptTrustee } = mergeCumulativeObservations(
  base.cumulative,
  fresh,
  usableThirdParty,
);
const annualizedCheck = validateOfficialReturnObservations(base.annualized);
const cumulativeCheck = validateOfficialCumulativeReturnObservations(cumulative);
if (annualizedCheck.invalid.length > 0 || cumulativeCheck.invalid.length > 0)
  throw new Error(
    `Candidate validation failed: ${annualizedCheck.invalid.length} annualized, ${cumulativeCheck.invalid.length} cumulative`,
  );

await writeFile(
  outputPath,
  `${JSON.stringify([...base.annualized, ...cumulative], null, 2)}\n`,
);
await writeFile(
  reportPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceSnapshot: sourcePath,
      baseCandidate: basePath,
      method:
        "Official trustee monthly data: HSBC / Hang Seng Monthly Fund Performance Summary main table (pdftotext -layout), BCT website fund performance responses, the Manulife Global Select Monthly Fund Summary (pdftotext -bbox columns), the BOCI-Prudential website MPF price and performance listing (JSON), the Sun Life website MPF cumulative performance data (JSON), the YF Life (MASS) Monthly Fund Performance of the Scheme (pdftotext -bbox columns); plus, for funds without a trustee figure, the third-party HKIFA-published Lipper MPF Performance Table via a reviewed name map (ADR 0015, rows carry publisher hkifa-lipper; trustee rows always take precedence). Exact English-name match within the scheme (BCT unit class by the Class X / Unit Class X contract), one-year cumulative cross-checked against the MPFA platform one-year return of the same date for every row; three-year cumulative stored as published (ADR 0014), never converted to annualized.",
      sources,
      thirdPartySources,
      annualizedRows: base.annualized.length,
      cumulativeRows: cumulative.length,
      replacedCumulative: replaced,
      keptNewerCumulative: keptNewer,
      keptTrusteeOverThirdParty: keptTrustee,
      // 官方來源衝突登記（ADR 0016）：受託人同平台兩個數字連各自日期照錄，唔揀邊。
      officialConflicts,
      // ADR 0016：衝突隔離行對應嘅 Lipper 第三方行已剔走，冇頂位。
      thirdPartySuppressedForConflicts,
      rejectedSources: rejected,
    },
    null,
    2,
  )}\n`,
);
console.log(
  JSON.stringify({
    outputPath,
    annualized: base.annualized.length,
    cumulative: cumulative.length,
    sources: sources.map((source) => ({
      scheme: source.schemeName,
      dataAsOf: source.dataAsOf,
      matched: source.matched,
      oneYearCrossChecks: source.oneYearCrossChecks,
      ...(source.quarantinedRows.length > 0 ? { quarantined: source.quarantinedRows.length } : {}),
    })),
    officialConflicts: officialConflicts.length,
    rejected: rejected.length,
  }),
);
