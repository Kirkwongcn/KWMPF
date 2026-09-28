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
import { parseSunLifeFundFactSheetXml } from "./sun-life-fund-fact-sheet-parser";
import { parseChinaLifeFundPerformance } from "./china-life-fund-performance-parser";
import { parseHsbcFundFactSheet } from "./hsbc-fund-fact-sheet-parser";
import { parseBocPrudentialFundPerformance } from "./boc-prudential-fund-performance-parser";
import { parseHaitongFundPerformance } from "./haitong-fund-performance-parser";
import { parseMyChoiceFundPerformance } from "./my-choice-fund-performance-parser";
import { parseMassFundPerformance } from "./mass-fund-performance-parser";
import { parseShkpFundPerformance } from "./shkp-fund-performance-parser";
import { parseFidelityFundPerformance } from "./fidelity-fund-performance-parser";
import { parseManulifeGlobalSelect } from "./manulife-global-select-parser";
import type { FundFactSheetReturn } from "./fund-fact-sheet-parser";
import {
  findAuditedFactSheetPeriodNonDisclosure,
  UnsupportedFactSheetParserError,
  type FactSheetSourceManifestEntry,
  type AuditedFactSheetPeriodNonDisclosure,
} from "./return-period-disclosure-audit";

const exec = promisify(execFile);
const manifestPath = process.argv[2];
const outputPath = process.argv[3];
if (!manifestPath || !outputPath) throw new Error("Usage: bun parse-fact-sheets.ts <manifest.json> <returns.json>");
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { entries: FactSheetSourceManifestEntry[] };
const pdfRoot = manifestPath.replace(/\.json$/, "");
const returns: FundFactSheetReturn[] = [];
const failures: Array<{ scheme: string; error: string }> = [];
const unsupportedParsers: Array<{ scheme: string; error: string }> = [];
const periodNotDisclosed: AuditedFactSheetPeriodNonDisclosure[] = [];

function parser(scheme: string, text: string, url: string): FundFactSheetReturn[] {
  if (scheme.startsWith("China Life")) return parseChinaLifeFundPerformance(text, url);
  if (scheme.startsWith("HSBC")) return parseHsbcFundFactSheet(text, url);
  if (scheme.startsWith("Hang Seng")) return parseHsbcFundFactSheet(text, url, "Hang Seng Mandatory Provident Fund – SuperTrust Plus");
  if (scheme.startsWith("BOC-Prudential")) return parseBocPrudentialFundPerformance(text, url);
  if (scheme.startsWith("Haitong")) return parseHaitongFundPerformance(text, url);
  if (scheme.startsWith("My Choice")) return parseMyChoiceFundPerformance(text, url);
  if (scheme.startsWith("MASS")) return parseMassFundPerformance(text, url);
  if (scheme.startsWith("SHKP")) return parseShkpFundPerformance(text, url);
  if (scheme.startsWith("Fidelity")) return parseFidelityFundPerformance(text, url);
  if (scheme === "Manulife Global Select (MPF) Scheme") return parseManulifeGlobalSelect(text, url);
  if (scheme.startsWith("AIA")) return parseAiaFundFactSheet(text, url);
  if (scheme.startsWith("AMTD")) return parseAmtdFundFactSheet(text, url);
  if (scheme === "BCT (MPF) Industry Choice") return parseBctFundFactSheet(text, url);
  if (scheme === "BCT (MPF) Pro Choice") return parseBctProFundPerformance(text, url);
  if (scheme === "BCT MPF - Simple Plan" || scheme === "BCT MPF - Smart Plan") return parsePrincipalFundFactSheet(text, url, scheme);
  if (scheme === "BCT MPF Scheme Series 800") return parsePrincipal800FundFactSheet(text, url, scheme);
  if (scheme.startsWith("BCT")) throw new UnsupportedFactSheetParserError("No 3-year official return parser for this BCT scheme");
  if (scheme.startsWith("BEA")) return parseFundFactSheet(text, url, scheme);
  if (scheme.startsWith("Principal")) return parsePrincipalFundFactSheet(text, url, scheme);
  if (scheme.includes("Series 800")) return parsePrincipal800FundFactSheet(text, url, scheme);
  return parseFundFactSheet(text, url);
}

for (const entry of manifest.entries) {
  if (entry.status !== "downloaded") continue;
  const auditedNonDisclosure = findAuditedFactSheetPeriodNonDisclosure(entry, 3);
  if (auditedNonDisclosure) {
    periodNotDisclosed.push(auditedNonDisclosure);
    continue;
  }
  const id = createHash("sha256").update(entry.scheme).digest("hex").slice(0, 16);
  try {
    const pdfPath = join(pdfRoot, `${id}.pdf`);
    if (entry.scheme.startsWith("Sun Life")) {
      const { stdout } = await exec("pdftohtml", ["-xml", "-stdout", pdfPath], { maxBuffer: 32 * 1024 * 1024 });
      returns.push(...parseSunLifeFundFactSheetXml(stdout, entry.factSheetUrl));
    } else {
      const { stdout } = await exec("pdftotext", ["-layout", pdfPath, "-"]);
      returns.push(...parser(entry.scheme, stdout, entry.factSheetUrl));
    }
  } catch (error) {
    const failure = { scheme: entry.scheme, error: error instanceof Error ? error.message : String(error) };
    if (error instanceof UnsupportedFactSheetParserError) unsupportedParsers.push(failure);
    else failures.push(failure);
  }
}

await mkdir(join(outputPath, ".."), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ returns, failures, unsupportedParsers, periodNotDisclosed }, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, parsed: returns.length, parserFailures: failures.length, unsupportedParsers: unsupportedParsers.length, periodNotDisclosed: periodNotDisclosed.length }));
