import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseSourceSnapshot } from "./input";
import { matchBctRows, parseBctFundInformation } from "./bct-fund-performance";
import {
  matchSummaryRows,
  parseMonthlySummary,
  type MonthlySummary,
} from "./monthly-performance-summary-parser";
import {
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
 * - `--bct`：銀聯信託官網基金表現數據接口（JSON 回應原檔）。
 *
 * 用法：
 *   bun src/build-monthly-summary-returns.ts --source <platform.json> \
 *     --base-candidate <old-candidate.json> \
 *     [--summary "<scheme>|<url>|<pdf>|<retrievedAt>" …] \
 *     [--bct "<scheme>|<url>|<json>|<retrievedAt>" …] \
 *     --output <new-candidate.json> --report <report.json> \
 *     [--check-source <platform.json>]
 *
 * `--check-source` 係用嚟做一年交叉核對的平台快照（預設同 --source），日期要同來源一樣。
 *
 * 任何一份文件有一行對唔上、同名多過一個類別、或者累積回報同積金局平台同期數字唔一致
 * （代表讀錯欄或者類別對調），成份文件作廢，唔出局部資料；作廢原因寫入報告的
 * `rejectedSources`，其他文件照用。全部文件都作廢先報錯。
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
if (
  !sourcePath ||
  !basePath ||
  !outputPath ||
  !reportPath ||
  summaries.length + bctResponses.length === 0
)
  throw new Error(
    'Usage: bun src/build-monthly-summary-returns.ts --source <platform.json> --base-candidate <candidate.json> [--summary "<scheme>|<url>|<pdf>|<retrievedAt>"] [--bct "<scheme>|<url>|<json>|<retrievedAt>"] --output <candidate.json> --report <report.json>',
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

type MatchedRow = {
  fundClassId: string;
  label: string;
  oneYear: number | null;
  threeYears: number | null;
  fiveYears: number | null;
  tenYears: number | null;
  /** 官方原文：數字、「-」（滙豐／恒生）或者「N/A」（BCT）。 */
  printedThreeYears: string;
};
type SourceDocument = {
  kind: "monthly-summary-pdf" | "bct-fund-information";
  schemeName: string;
  url: string;
  retrievedAt: string;
  sha256: string;
  bytes: number;
  page?: number;
  dataAsOf: string;
  rows: number;
  failed: string[];
  matched: MatchedRow[];
};

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

const CROSS_CHECK_PERIODS = [
  ["oneYear", 1],
  ["fiveYears", 5],
  ["tenYears", 10],
] as const;

/**
 * 逐行同積金局平台同期累積回報核對（紅線 3）：一年必須核對到，五年、十年兩邊都有就要一致。
 * 單位類別一年回報可以啱啱一樣（例如 D／I 類），所以多核五年、十年，減低類別對調而唔被發現。
 * 官方冇一年回報（`N/A` 或「-」）的行，只有平台都冇一年回報而且三年都係官方未提供先接受。
 * 任何一行唔合格就成份文件作廢；唔影響其他文件。
 */
function verifyDocument(document: SourceDocument) {
  const { schemeName } = document;
  if (document.failed.length > 0)
    throw new Error(
      `${document.failed.length} row(s) not matched exactly: ${document.failed.join("; ")}`,
    );
  const matchedIds = document.matched.map((row) => row.fundClassId);
  if (new Set(matchedIds).size !== matchedIds.length)
    throw new Error("two source rows matched the same fund class");
  const missing = schemeRecordsOf(schemeName)
    .filter((record) => !matchedIds.includes(record.fundClassId))
    .map((record) => record.fundClassId);
  if (missing.length > 0)
    throw new Error(`${missing.length} scheme fund(s) not in the source: ${missing.join(", ")}`);

  let oneYearChecks = 0;
  let longerChecks = 0;
  const problems: string[] = [];
  for (const row of document.matched) {
    const record = checkSnapshot.records.find((item) => item.fundClassId === row.fundClassId);
    const platformOneYear = record?.returns?.[1];
    if (!platformOneYear || platformOneYear.dataAsOf !== document.dataAsOf) {
      if (row.oneYear === null && row.threeYears === null && record && !platformOneYear) {
        oneYearChecks += 1;
        continue;
      }
      problems.push(
        `${row.fundClassId} has no platform one-year return dated ${document.dataAsOf}` +
          (platformOneYear ? ` (platform is ${platformOneYear.dataAsOf}; pass --check-source)` : ""),
      );
      continue;
    }
    for (const [field, period] of CROSS_CHECK_PERIODS) {
      const platform = record?.returns?.[period];
      const value = row[field];
      const platformValue = period === 1 ? platform?.annualized : platform?.cumulative;
      if (period === 1) {
        if (value === null || typeof platformValue !== "number") {
          problems.push(`${row.fundClassId} one-year source ${value} vs platform ${platformValue}`);
          continue;
        }
        oneYearChecks += 1;
      } else if (
        value === null ||
        typeof platformValue !== "number" ||
        platform?.dataAsOf !== document.dataAsOf
      ) {
        continue;
      } else {
        longerChecks += 1;
      }
      if (value !== platformValue)
        problems.push(`${row.fundClassId} ${period}-year source ${value} vs platform ${platformValue}`);
    }
  }
  if (problems.length > 0) throw new Error(`cross-check failed: ${problems.join("; ")}`);

  const observations: OfficialCumulativeReturnObservation[] = document.matched.map((row) => ({
    fundClassId: row.fundClassId,
    periodYears: 3,
    basis: "cumulative",
    cumulative: row.threeYears,
    printed: row.printedThreeYears,
    dataAsOf: document.dataAsOf,
    sourceUrl: document.url,
    retrievedAt: document.retrievedAt,
    sourceSha256: document.sha256,
  }));
  return {
    observations,
    source: {
      kind: document.kind,
      schemeName,
      url: document.url,
      retrievedAt: document.retrievedAt,
      sha256: document.sha256,
      bytes: document.bytes,
      ...(document.page === undefined ? {} : { page: document.page }),
      dataAsOf: document.dataAsOf,
      rows: document.rows,
      matched: document.matched.length,
      // 官方印「-」或者 `N/A`：記錄為官方未提供（唔當 0），網站照講原因。
      officialNotDisclosed: document.matched
        .filter((row) => row.threeYears === null)
        .map((row) => row.fundClassId),
      oneYearCrossChecks: oneYearChecks,
      fiveTenYearCrossChecks: longerChecks,
    },
  };
}

// 每份文件獨立：一份作廢（讀唔到、對唔上、核對唔一致）只影響自己，其他照用（紅線 3 以文件為單位）。
const sources = [];
const rejected: { flag: string; entry: string; reason: string }[] = [];
const fresh: OfficialCumulativeReturnObservation[] = [];
const inputs = [
  ...summaries.map((entry) => ({ flag: "--summary", entry, read: () => readSummary(entry) })),
  ...bctResponses.map((entry) => ({ flag: "--bct", entry, read: () => readBct(entry) })),
];
for (const input of inputs) {
  try {
    const document = await input.read();
    const { observations, source } = verifyDocument(document);
    fresh.push(...observations);
    sources.push(source);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    rejected.push({ flag: input.flag, entry: input.entry, reason });
    console.error(`REJECTED ${input.flag} ${input.entry.split("|")[0]}: ${reason}`);
  }
}
if (sources.length === 0)
  throw new Error(`Every source was rejected: ${rejected.map((item) => item.reason).join(" | ")}`);

// 舊候選檔的累積紀錄一定要對得上今次平台快照，否則發布時先爆，喺呢度就停。
const orphaned = base.cumulative.filter((row) => !knownIds.has(row.fundClassId));
if (orphaned.length > 0)
  throw new Error(
    `Base candidate has cumulative rows for unknown fund classes: ${orphaned.map((row) => row.fundClassId).join(", ")}`,
  );
// 同一份批次入面同一隻基金唔可以有兩份披露（紅線 5）。
const freshIds = new Set<string>();
for (const row of fresh) {
  if (freshIds.has(row.fundClassId))
    throw new Error(`More than one summary disclosed ${row.fundClassId}`);
  freshIds.add(row.fundClassId);
}
// 每隻基金只留一筆累積：新文件截至日期較新先取代；同日但原文唔同即報錯。
const byFund = new Map(base.cumulative.map((row) => [row.fundClassId, row]));
const replaced: string[] = [];
const keptNewer: string[] = [];
for (const row of fresh) {
  const existing = byFund.get(row.fundClassId);
  if (existing && existing.dataAsOf > row.dataAsOf) {
    keptNewer.push(row.fundClassId);
    continue;
  }
  if (existing && existing.dataAsOf === row.dataAsOf) {
    if (existing.printed !== row.printed)
      throw new Error(
        `${row.fundClassId}: two disclosures dated ${row.dataAsOf} disagree (${existing.printed} vs ${row.printed})`,
      );
    continue;
  }
  if (existing) replaced.push(row.fundClassId);
  byFund.set(row.fundClassId, row);
}
const cumulative = [...byFund.values()].sort((a, b) =>
  a.fundClassId.localeCompare(b.fundClassId),
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
        "Official trustee monthly data: HSBC / Hang Seng Monthly Fund Performance Summary main table (pdftotext -layout) and BCT website fund performance responses. Exact English-name match within the scheme (BCT unit class by the Class X / Unit Class X contract), one-year cumulative cross-checked against the MPFA platform one-year return of the same date for every row; three-year cumulative stored as published (ADR 0014), never converted to annualized.",
      sources,
      annualizedRows: base.annualized.length,
      cumulativeRows: cumulative.length,
      replacedCumulative: replaced,
      keptNewerCumulative: keptNewer,
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
    })),
    rejected: rejected.length,
  }),
);
