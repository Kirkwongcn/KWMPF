import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseSourceSnapshot } from "./input";
import { parseHkifaLipperMpfTable } from "./hkifa-lipper-mpf-table-parser";
import { HKIFA_LIPPER_SCHEME_PREFIXES, proposeHkifaLipperMap } from "./hkifa-lipper-fund-map";

/**
 * 由 HKIFA 轉載嘅 Lipper 表同同期積金局平台快照，產生 Lipper 行名 → 基金類別對照表（ADR 0015）。
 *
 * 用法：
 *   bun src/build-hkifa-lipper-map.ts --hkifa "<url>|<pdf>" --check-source <同期平台快照> --output <map.json>
 *
 * 規則見 `hkifa-lipper-fund-map.ts`。對照表產生後要人手覆核（每行有 Lipper 行名、積金局英文名同類別），
 * 再提交到 `data/reference/hkifa-lipper-fund-map.json`；每月建候選只用對照表，唔會再推斷。
 */

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const hkifa = argument("--hkifa");
const checkSourcePath = argument("--check-source");
const outputPath = argument("--output");
if (!hkifa || !checkSourcePath || !outputPath)
  throw new Error('Usage: bun src/build-hkifa-lipper-map.ts --hkifa "<url>|<pdf>" --check-source <platform.json> --output <map.json>');
const [url, path] = hkifa.split("|");
if (!url?.startsWith("https://") || !path) throw new Error(`Bad --hkifa value: ${hkifa}`);

const bytes = await readFile(path);
const table = parseHkifaLipperMpfTable(
  execFileSync("pdftotext", ["-bbox", path, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }),
);
const snapshot = parseSourceSnapshot(JSON.parse(await readFile(checkSourcePath, "utf8")));
const { entries, rejected } = proposeHkifaLipperMap(table.rows, snapshot.records, table.dataAsOf);

await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      generatedFrom: {
        url,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        dataAsOf: table.dataAsOf,
        checkSource: checkSourcePath,
      },
      rules:
        "Scheme by the fixed Lipper prefix table; a row maps to a fund class only when exactly one class in that scheme has an MPFA platform one-year cumulative return equal to the Lipper one-year % Growth on the same date AND every word of the Lipper fund name (after the fixed abbreviation table) appears in that class's English fund and class name. Classes Lipper does not list stay unmapped (never borrowed from another class).",
      schemePrefixes: HKIFA_LIPPER_SCHEME_PREFIXES,
      entries,
      rejected,
    },
    null,
    2,
  )}\n`,
);
console.log(JSON.stringify({ outputPath, dataAsOf: table.dataAsOf, entries: entries.length, rejected: rejected.length }));
