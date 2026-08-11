import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  archiveHtml,
  createRunArchive,
  failedFetchArtifact,
  writeArchiveManifest,
} from "../src/raw-archive";

describe("raw acquisition archive", () => {
  it("writes immutable versioned evidence and a per-artifact manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "kwmpf-raw-"));
    const run = await createRunArchive(root, "run-1");
    const artifact = await archiveHtml(
      run,
      "details/1.html",
      "https://example.test/1",
      "<html>one</html>",
      "2026-08-11T00:00:00Z",
      "parsed",
    );
    await writeArchiveManifest(run, "run-1", [artifact]);

    expect(artifact).toMatchObject({
      sourceType: "mpf_fund_platform",
      path: "details/1.html",
      url: "https://example.test/1",
      retrievedAt: "2026-08-11T00:00:00Z",
      bytes: 16,
      parseStatus: "parsed",
    });
    expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(await readFile(join(run, "manifest.json"), "utf8"))).toEqual({
      runId: "run-1",
      artifacts: [artifact],
    });
    await expect(
      archiveHtml(
        run,
        "details/1.html",
        "https://example.test/1",
        "replacement",
        "2026-08-11T00:01:00Z",
        "parsed",
      ),
    ).rejects.toMatchObject({ code: "EEXIST" });
    await expect(createRunArchive(root, "run-1")).rejects.toMatchObject({
      code: "EEXIST",
    });
  });

  it("records a failed fetch without inventing content evidence", () => {
    expect(
      failedFetchArtifact(
        "details/2.html",
        "https://example.test/2",
        "2026-08-11T00:02:00Z",
      ),
    ).toEqual({
      sourceType: "mpf_fund_platform",
      path: "details/2.html",
      url: "https://example.test/2",
      retrievedAt: "2026-08-11T00:02:00Z",
      bytes: 0,
      parseStatus: "fetch_failed",
    });
  });
});
