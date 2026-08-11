import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type RawArtifact = {
  sourceType: "mpf_fund_platform";
  path: string;
  url: string;
  retrievedAt: string;
  sha256?: string;
  bytes: number;
  parseStatus: "parsed" | "parse_failed" | "fetch_failed";
  dataAsOf?: string;
};

export function failedFetchArtifact(
  relativePath: string,
  url: string,
  retrievedAt: string,
): RawArtifact {
  return {
    sourceType: "mpf_fund_platform",
    path: relativePath,
    url,
    retrievedAt,
    bytes: 0,
    parseStatus: "fetch_failed",
  };
}

export async function createRunArchive(rawDirectory: string, runId: string) {
  const runDirectory = join(rawDirectory, runId);
  await mkdir(rawDirectory, { recursive: true });
  await mkdir(runDirectory);
  await mkdir(join(runDirectory, "details"));
  return runDirectory;
}

export async function archiveHtml(
  runDirectory: string,
  relativePath: string,
  url: string,
  html: string,
  retrievedAt: string,
  parseStatus: RawArtifact["parseStatus"],
): Promise<RawArtifact> {
  const bytes = Buffer.byteLength(html);
  await writeFile(join(runDirectory, relativePath), html, { flag: "wx" });
  return {
    sourceType: "mpf_fund_platform",
    path: relativePath,
    url,
    retrievedAt,
    sha256: createHash("sha256").update(html).digest("hex"),
    bytes,
    parseStatus,
  };
}

export async function writeArchiveManifest(
  runDirectory: string,
  runId: string,
  artifacts: RawArtifact[],
) {
  await writeFile(
    join(runDirectory, "manifest.json"),
    `${JSON.stringify(
      {
        runId,
        artifacts: artifacts.toSorted((a, b) => a.path.localeCompare(b.path)),
      },
      null,
      2,
    )}\n`,
    { flag: "wx" },
  );
}
