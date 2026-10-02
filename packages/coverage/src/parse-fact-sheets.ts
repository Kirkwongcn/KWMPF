import { createReadStream } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { parseAiaFundFactSheet } from "./aia-fund-fact-sheet-parser";
import { parseAmtdFundFactSheet } from "./amtd-fund-fact-sheet-parser";
import { parseBctFundFactSheet } from "./bct-fund-fact-sheet-parser";
import { parseBctProFundPerformance } from "./bct-pro-fund-performance-parser";
import { parseFundFactSheet } from "./fund-fact-sheet-parser";
import { parsePrincipalFundFactSheet, parsePrincipal800FundFactSheet } from "./principal-fund-fact-sheet-parser";
import { parseSunLifeFundFactSheetXmlAudit } from "./sun-life-fund-fact-sheet-parser";
import { parseBeaFundFactSheetXmlAudit } from "./bea-fund-fact-sheet-parser";
import { parseChinaLifeFundPerformance } from "./china-life-fund-performance-parser";
import { parseHsbcFundFactSheet } from "./hsbc-fund-fact-sheet-parser";
import { parseBocPrudentialFundPerformance } from "./boc-prudential-fund-performance-parser";
import { parseHaitongFundPerformance } from "./haitong-fund-performance-parser";
import { parseMyChoiceFundPerformance } from "./my-choice-fund-performance-parser";
import { parseMassFundPerformance } from "./mass-fund-performance-parser";
import { parseShkpFundPerformance } from "./shkp-fund-performance-parser";
import { parseFidelityFundPerformanceAudit } from "./fidelity-fund-performance-parser";
import { parseManulifeGlobalSelect } from "./manulife-global-select-parser";
import type {
  FundFactSheetReturn,
  FundReturnUnavailable,
} from "./fund-fact-sheet-parser";
import {
  findAuditedFactSheetPeriodNonDisclosure,
  UnsupportedFactSheetParserError,
  type FactSheetSourceManifestEntry,
  type AuditedFactSheetPeriodNonDisclosure,
} from "./return-period-disclosure-audit";

const exec = promisify(execFile);

async function sha256File(path: string): Promise<string> {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}
async function pdfXml(path: string) {
  return (await exec("pdftohtml", ["-xml", "-stdout", path], { maxBuffer: 32 * 1024 * 1024 })).stdout;
}
async function pdfWordBoxes(path: string) {
  return (await exec("pdftotext", ["-bbox", path, "-"], { maxBuffer: 32 * 1024 * 1024 })).stdout;
}
const manifestPath = process.argv[2];
const outputPath = process.argv[3];
if (!manifestPath || !outputPath) throw new Error("Usage: bun parse-fact-sheets.ts <manifest.json> <returns.json>");
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { entries: FactSheetSourceManifestEntry[] };
const pdfRoot = manifestPath.replace(/\.json$/, "");
const returns: FundFactSheetReturn[] = [];
type FactSheetParseDiagnostic = {
  scheme: string;
  sourceUrl: string;
  manifestSha256?: string;
  sourceSha256?: string;
  error: string;
};
const failures: FactSheetParseDiagnostic[] = [];
const unsupportedParsers: FactSheetParseDiagnostic[] = [];
const periodNotDisclosed: AuditedFactSheetPeriodNonDisclosure[] = [];
const fundPeriodNotDisclosed: (FundReturnUnavailable & {
  sourceSha256: string;
})[] = [];

function parser(
  scheme: string,
  text: string,
  url: string,
): FundFactSheetReturn[] {
  if (scheme.startsWith("China Life")) return parseChinaLifeFundPerformance(text, url);
  if (scheme.startsWith("HSBC")) return parseHsbcFundFactSheet(text, url);
  if (scheme.startsWith("Hang Seng")) return parseHsbcFundFactSheet(text, url, "Hang Seng Mandatory Provident Fund – SuperTrust Plus");
  if (scheme.startsWith("BOC-Prudential")) return parseBocPrudentialFundPerformance(text, url);
  if (scheme.startsWith("Haitong")) return parseHaitongFundPerformance(text, url);
  if (scheme.startsWith("My Choice")) return parseMyChoiceFundPerformance(text, url);
  if (scheme.startsWith("MASS")) return parseMassFundPerformance(text, url);
  if (scheme.startsWith("SHKP")) return parseShkpFundPerformance(text, url);
  if (scheme === "Manulife Global Select (MPF) Scheme") return parseManulifeGlobalSelect(text, url);
  if (scheme.startsWith("AIA")) return parseAiaFundFactSheet(text, url);
  if (scheme.startsWith("AMTD")) return parseAmtdFundFactSheet(text, url);
  if (scheme === "BCT (MPF) Industry Choice") return parseBctFundFactSheet(text, url);
  if (scheme === "BCT (MPF) Pro Choice") return parseBctProFundPerformance(text, url);
  if (scheme === "BCT MPF - Simple Plan" || scheme === "BCT MPF - Smart Plan") return parsePrincipalFundFactSheet(text, url, scheme);
  if (scheme === "BCT MPF Scheme Series 800") return parsePrincipal800FundFactSheet(text, url, scheme);
  if (scheme.startsWith("BCT")) throw new UnsupportedFactSheetParserError("No 3-year official return parser for this BCT scheme");
  if (scheme.startsWith("Principal")) return parsePrincipalFundFactSheet(text, url, scheme);
  if (scheme.includes("Series 800")) return parsePrincipal800FundFactSheet(text, url, scheme);
  return parseFundFactSheet(text, url);
}

for (const entry of manifest.entries) {
  if (entry.status !== "downloaded") continue;
  const id = createHash("sha256").update(entry.scheme).digest("hex").slice(0, 16);
  let sourceSha256: string | undefined;
  try {
    const pdfPath = join(pdfRoot, `${id}.pdf`);
    sourceSha256 = await sha256File(pdfPath);
    if (!entry.sha256) {
      throw new Error(`Downloaded PDF manifest is missing SHA-256 for ${entry.scheme}`);
    }
    if (entry.sha256 !== sourceSha256) {
      throw new Error(`Downloaded PDF SHA-256 does not match the manifest for ${entry.scheme}`);
    }
    const auditedNonDisclosure = findAuditedFactSheetPeriodNonDisclosure(entry, 3);
    if (auditedNonDisclosure) {
      periodNotDisclosed.push(auditedNonDisclosure);
      continue;
    }
    const parsed = entry.scheme.startsWith("Fidelity")
      ? parseFidelityFundPerformanceAudit(await pdfWordBoxes(pdfPath), entry.factSheetUrl)
      : entry.scheme.startsWith("Sun Life")
        ? parseSunLifeFundFactSheetXmlAudit(await pdfXml(pdfPath), entry.factSheetUrl)
        : entry.scheme.startsWith("BEA")
          ? parseBeaFundFactSheetXmlAudit(await pdfXml(pdfPath), entry.factSheetUrl, entry.scheme)
          : undefined;
    if (parsed) {
      returns.push(...parsed.returns);
      fundPeriodNotDisclosed.push(
        ...parsed.unavailable.map((row) => ({
          ...row,
          sourceSha256: sourceSha256!,
        })),
      );
    } else {
      const { stdout } = await exec("pdftotext", ["-layout", pdfPath, "-"]);
      returns.push(...parser(entry.scheme, stdout, entry.factSheetUrl));
    }
  } catch (error) {
    const failure: FactSheetParseDiagnostic = {
      scheme: entry.scheme,
      sourceUrl: entry.factSheetUrl,
      manifestSha256: entry.sha256,
      sourceSha256,
      error: error instanceof Error ? error.message : String(error),
    };
    if (error instanceof UnsupportedFactSheetParserError) unsupportedParsers.push(failure);
    else failures.push(failure);
  }
}

await mkdir(join(outputPath, ".."), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({ returns, failures, unsupportedParsers, periodNotDisclosed, fundPeriodNotDisclosed }, null, 2)}\n`,
);
console.log(JSON.stringify({ outputPath, parsed: returns.length, parserFailures: failures.length, unsupportedParsers: unsupportedParsers.length, periodNotDisclosed: periodNotDisclosed.length }));
