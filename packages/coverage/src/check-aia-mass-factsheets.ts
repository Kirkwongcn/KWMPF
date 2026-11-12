import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  aiaListing,
  compareAnnualized,
  latestAiaPdf,
  type Target,
} from "./annualized-factsheet-review";
import { parseAiaFundFactSheet } from "./aia-fund-fact-sheet-parser";
import { parseMassFundPerformance } from "./mass-fund-performance-parser";
import { splitReturnObservations } from "./official-return-overlay";

const [basePath, output] = process.argv.slice(2);
if (!basePath || !output)
  throw new Error(
    "Expected current return candidate path and output directory",
  );
await mkdir(output, { recursive: true });
const baseline = splitReturnObservations(
  JSON.parse(await readFile(basePath, "utf8")),
).annualized;
// Fixed identities and literal PDF fund names independently verified for the 34 November expiry records.
const audit = JSON.parse(
  await readFile(
    "data/coverage/2026-11-12-annualized-factsheet-review.json",
    "utf8",
  ),
) as { verified: Target[] };
const aia = audit.verified.filter(
  (x) => x.scheme === "AIA MPF - Prime Value Choice",
);
const mass = audit.verified.filter(
  (x) => x.scheme === "MASS Mandatory Provident Fund Scheme",
);
if (
  aia.length !== 20 ||
  mass.length !== 14 ||
  new Set([...aia, ...mass].map((x) => x.id)).size !== 34
)
  throw new Error("Invalid reviewed fund list");

function download(url: string): Buffer {
  return execFileSync(
    "curl",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--proto",
      "=https",
      "--retry",
      "1",
      "--max-time",
      "30",
      url,
    ],
    { maxBuffer: 25 * 1024 * 1024 },
  );
}
const reports = [];
const errors = [];
for (const group of [aia, ...mass.map((row) => [row])]) {
  let url = group === aia ? aiaListing : group[0]!.url;
  try {
    if (group === aia)
      url = latestAiaPdf(download(aiaListing).toString("utf8"));
    else if (
      !/^https:\/\/app2\.yflife\.com\/MPFWeb\/pdf\/fact_sheet\/[A-Z0-9]+_E\.pdf$/.test(
        url,
      )
    )
      throw new Error("Unexpected MASS source URL");
    const bytes = download(url);
    if (bytes.subarray(0, 5).toString() !== "%PDF-")
      throw new Error("Expected a PDF");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const pdf = join(output, sha256 + ".pdf");
    await writeFile(pdf, bytes);
    const layout = execFileSync(
      "pdftotext",
      ["-layout", "-enc", "UTF-8", pdf, "-"],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
    const returns =
      group === aia
        ? parseAiaFundFactSheet(layout, url)
        : parseMassFundPerformance(layout, url);
    const retrievedAt = new Date().toISOString();
    const rows = compareAnnualized(
      group,
      returns,
      baseline,
      retrievedAt.slice(0, 10),
    );
    const additionalFundNames = returns
      .filter(
        (r) => !group.some((target) => target.name === r.constituentFundName),
      )
      .map((r) => r.constituentFundName);
    reports.push({ url, sha256, retrievedAt, additionalFundNames, rows });
    if (
      additionalFundNames.length === 0 &&
      rows.every((row) => row.status === "unchanged")
    )
      await unlink(pdf);
  } catch (error) {
    errors.push({
      url,
      fundClassIds: group.map((x) => x.id),
      error: String(error),
    });
  }
}
const rows = reports.flatMap((r) => r.rows);
const summary = {
  checked: rows.length,
  newer: rows.filter((r) => r.status === "newer").length,
  revisions: rows.filter((r) => r.status === "same-date-revision").length,
  older: rows.filter((r) => r.status === "older").length,
  failures: errors.length,
};
await writeFile(
  join(output, "review.json"),
  JSON.stringify({ summary, reports, errors }, null, 2) + "\n",
);
console.log(JSON.stringify(summary));
if (errors.length) process.exitCode = 1;
