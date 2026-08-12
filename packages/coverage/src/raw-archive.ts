import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
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
  await mkdir(runDirectory, { recursive: true });
  await mkdir(join(runDirectory, "details"), { recursive: true });
  return runDirectory;
}

export async function readArchivedHtml(runDirectory: string, relativePath: string) {
  try {
    await access(join(runDirectory, relativePath));
    return await readFile(join(runDirectory, relativePath), "utf8");
  } catch {
    return undefined;
  }
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
  try {
    await writeFile(join(runDirectory, relativePath), html, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = await readFile(join(runDirectory, relativePath), "utf8");
    return {
      sourceType: "mpf_fund_platform",
      path: relativePath,
      url,
      retrievedAt,
      sha256: createHash("sha256").update(existing).digest("hex"),
      bytes: Buffer.byteLength(existing),
      parseStatus,
    };
  }
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
    { flag: "w" },
  );
}
