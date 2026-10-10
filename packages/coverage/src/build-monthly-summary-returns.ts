import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseSourceSnapshot } from "./input";
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
 * 由滙豐／恒生《每月基金表現摘要》讀出官方三年累積回報（ADR 0014），併入新一份
 * 受託人回報候選檔。年率化紀錄原樣保留；累積紀錄只會由截至日期較新的取代。
 *
 * 用法：
 *   bun src/build-monthly-summary-returns.ts --source <platform.json> \
 *     --base-candidate <old-candidate.json> \
 *     --summary "<scheme>|<url>|<pdf>|<retrievedAt>" [--summary …] \
 *     --output <new-candidate.json> --report <report.json> \
 *     [--check-source <platform.json>]
 *
 * `--check-source` 係用嚟做一年交叉核對的平台快照（預設同 --source），日期要同摘要一樣。
 *
 * 任何一份文件有一行對唔上、同名多過一個類別、或者一年累積回報同積金局平台同期一年回報
 * 唔一致（代表讀錯欄），成份文件作廢並報錯，唔出局部資料。
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
if (!sourcePath || !basePath || !outputPath || !reportPath || summaries.length === 0)
  throw new Error(
    'Usage: bun src/build-monthly-summary-returns.ts --source <platform.json> --base-candidate <candidate.json> --summary "<scheme>|<url>|<pdf>|<retrievedAt>" --output <candidate.json> --report <report.json>',
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

const sources = [];
const fresh: OfficialCumulativeReturnObservation[] = [];
for (const entry of summaries) {
  const [schemeName, url, pdfPath, retrievedAt] = entry.split("|");
  if (!schemeName || !url || !pdfPath || !retrievedAt)
    throw new Error(`Bad --summary value: ${entry}`);
  const bytes = await readFile(pdfPath);
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-")
    throw new Error(`${pdfPath}: not a PDF`);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { page, summary } = summaryPage(pdfPath);
  const schemeRecords = snapshot.records.filter(
    (record) => record.identity.schemeName === schemeName,
  );
  if (schemeRecords.length === 0) throw new Error(`Unknown scheme: ${schemeName}`);
  const matches = matchSummaryRows(
    summary.rows,
    schemeRecords.map((record) => ({
      fundClassId: record.fundClassId,
      constituentFundName: record.identity.constituentFundName,
    })),
  );
  const failed = matches.filter((match) => match.status !== "matched");
  if (failed.length > 0)
    throw new Error(
      `${schemeName}: ${failed.length} row(s) not matched exactly: ${failed
        .map((match) => `${match.row.englishName} (${match.status})`)
        .join("; ")}`,
    );

  // 同期一年累積回報 = 一年年率化回報；唔一致即係讀錯欄，成份作廢。
  const oneYearChecks = matches.flatMap((match) => {
    if (match.status !== "matched") return [];
    const record = checkSnapshot.records.find(
      (item) => item.fundClassId === match.fundClassId,
    );
    const platform = record?.returns?.[1];
    if (!platform || platform.dataAsOf !== summary.dataAsOf || typeof platform.annualized !== "number")
      return [];
    return [
      {
        fundClassId: match.fundClassId,
        summary: match.row.cumulative.oneYear,
        platform: platform.annualized,
        agrees: match.row.cumulative.oneYear === platform.annualized,
      },
    ];
  });
  // 每一行都要核對到；平台日期唔同就用 --check-source 提供同期快照，唔可以跳過。
  if (oneYearChecks.length !== matches.length)
    throw new Error(
      `${schemeName}: one-year cross-check covered ${oneYearChecks.length} of ${matches.length} rows; pass --check-source with a platform snapshot dated ${summary.dataAsOf}`,
    );
  const disagreements = oneYearChecks.filter((check) => !check.agrees);
  if (disagreements.length > 0)
    throw new Error(
      `${schemeName}: one-year cross-check failed for ${disagreements
        .map((check) => `${check.fundClassId} summary ${check.summary} vs platform ${check.platform}`)
        .join("; ")}`,
    );

  const missing = schemeRecords
    .filter((record) => !matches.some((match) => match.status === "matched" && match.fundClassId === record.fundClassId))
    .map((record) => record.fundClassId);
  if (missing.length > 0)
    throw new Error(
      `${schemeName}: ${missing.length} scheme fund(s) not in the summary main table: ${missing.join(", ")}`,
    );
  const notDisclosed: string[] = [];
  for (const match of matches) {
    if (match.status !== "matched") continue;
    const printed = match.row.printed[3]!;
    // 官方印「-」：記錄為官方未提供（唔當 0），網站照講原因。
    if (match.row.cumulative.threeYears === null) notDisclosed.push(match.fundClassId);
    fresh.push({
      fundClassId: match.fundClassId,
      periodYears: 3,
      basis: "cumulative",
      cumulative: match.row.cumulative.threeYears,
      printed,
      dataAsOf: summary.dataAsOf,
      sourceUrl: url,
      retrievedAt,
      sourceSha256: sha256,
    });
  }
  sources.push({
    schemeName,
    url,
    retrievedAt,
    sha256,
    bytes: bytes.length,
    page,
    dataAsOf: summary.dataAsOf,
    rows: summary.rows.length,
    matched: matches.length,
    officialNotDisclosed: notDisclosed,
    schemeFundsNotInSummary: missing,
    oneYearCrossChecks: oneYearChecks.length,
  });
}

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
        "Official HSBC / Hang Seng Monthly Fund Performance Summary main table (pdftotext -layout), exact English-name match within the scheme, one-year cumulative cross-checked against the MPFA platform one-year return of the same date; three-year cumulative stored as published (ADR 0014), never converted to annualized.",
      sources,
      annualizedRows: base.annualized.length,
      cumulativeRows: cumulative.length,
      replacedCumulative: replaced,
      keptNewerCumulative: keptNewer,
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
  }),
);
