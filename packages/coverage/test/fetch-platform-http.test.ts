import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RawArtifact } from "../src/raw-archive";
import { createRunArchive, writeArchiveManifest } from "../src/raw-archive";
import { fetchAndArchiveHtml } from "../src/fetch-platform-http";

describe("official platform fetch failures", () => {
  it("archives each HTTP 451 protection-page retry before failing closed", async () => {
    const root = await mkdtemp(join(tmpdir(), "kwmpf-fetch-failure-"));
    try {
      const runDirectory = await createRunArchive(root, "run-451");
      const artifacts: RawArtifact[] = [];
      const body =
        "<html>This page can't be displayed. incident ID: 451-example</html>";
      let calls = 0;
      const fetchImpl: typeof fetch = async () => {
        calls += 1;
        return new Response(body, { status: 451 });
      };

      await expect(
        fetchAndArchiveHtml(
          "https://mfp.mpfa.org.hk/mobile/eng/cf_detail.jsp?cf_id=498",
          runDirectory,
          "details/498.html",
          artifacts,
          { fetchImpl, wait: async () => {} },
        ),
      ).rejects.toThrow("returned a platform protection page");

      expect(calls).toBe(4);
      expect(artifacts).toHaveLength(4);
      for (const [index, artifact] of artifacts.entries()) {
        expect(artifact).toMatchObject({
          path: `details/498.html.attempt-${index + 1}.html`,
          url: "https://mfp.mpfa.org.hk/mobile/eng/cf_detail.jsp?cf_id=498",
          httpStatus: 451,
          attempt: index + 1,
          parseStatus: "fetch_failed",
          error: "https://mfp.mpfa.org.hk/mobile/eng/cf_detail.jsp?cf_id=498 returned a platform protection page",
          bytes: Buffer.byteLength(body),
        });
        expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(await readFile(join(runDirectory, artifact.path), "utf8")).toBe(body);
      }

      await writeArchiveManifest(runDirectory, "run-451", artifacts);
      expect(JSON.parse(await readFile(join(runDirectory, "manifest.json"), "utf8"))).toEqual({
        runId: "run-451",
        artifacts,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("records network failures without inventing HTML evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "kwmpf-fetch-network-"));
    try {
      const runDirectory = await createRunArchive(root, "run-network");
      const artifacts: RawArtifact[] = [];
      let calls = 0;
      const fetchImpl: typeof fetch = async () => {
        calls += 1;
        throw new TypeError("network unavailable");
      };

      await expect(
        fetchAndArchiveHtml(
          "https://mfp.mpfa.org.hk/eng/mpp_list.jsp",
          runDirectory,
          "fund-information-table.html",
          artifacts,
          { fetchImpl, wait: async () => {} },
        ),
      ).rejects.toThrow("network unavailable");

      expect(calls).toBe(4);
      expect(artifacts).toHaveLength(4);
      expect(artifacts).toEqual(
        Array.from({ length: 4 }, (_, index) => ({
          sourceType: "mpf_fund_platform",
          path: `fund-information-table.html.attempt-${index + 1}.fetch-failed`,
          url: "https://mfp.mpfa.org.hk/eng/mpp_list.jsp",
          retrievedAt: expect.any(String),
          bytes: 0,
          parseStatus: "fetch_failed",
          attempt: index + 1,
          error: "network unavailable",
        })),
      );

      await writeArchiveManifest(runDirectory, "run-network", artifacts);
      expect(JSON.parse(await readFile(join(runDirectory, "manifest.json"), "utf8"))).toMatchObject({
        runId: "run-network",
        artifacts,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
