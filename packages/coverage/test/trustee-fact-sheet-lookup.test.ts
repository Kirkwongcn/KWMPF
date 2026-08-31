import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadTrusteeFactSheetLookup,
  toTrusteeFactSheetLookup,
  type TrusteeFactSheetLink,
} from "../src/trustee-fact-sheet-lookup";

const links: TrusteeFactSheetLink[] = [
  {
    scheme: "BCT MPF - Simple Plan",
    factSheetUrl: "https://www.bcthk.com/wr/Simple-Fund-Fact-Sheet",
    file: "BCT_Simple.pdf",
  },
  {
    scheme: "BCT (MPF) Industry Choice",
    factSheetUrl: "https://www.bcthk.com/IS-Fund-Fact-Sheet",
    file: "BCT_IS.pdf",
  },
];

async function sourcesDirectory(batches: Record<string, TrusteeFactSheetLink[] | null>) {
  const root = await mkdtemp(join(tmpdir(), "kwmpf-trustee-"));
  for (const [name, batch] of Object.entries(batches)) {
    await mkdir(join(root, name), { recursive: true });
    if (batch)
      await writeFile(
        join(root, name, "trustee-fact-sheet-links.json"),
        JSON.stringify(batch),
      );
  }
  return root;
}

describe("trustee fact sheet lookup", () => {
  it("resolves a scheme to the trustee's own download link and local file", () => {
    const lookup = toTrusteeFactSheetLookup("2026-08-31", links);

    expect(lookup.linkOf("BCT MPF - Simple Plan")).toEqual(links[0]);
    expect(lookup.schemes).toBe(2);
  });

  it("refuses a link that is not served over HTTPS", () => {
    expect(() =>
      toTrusteeFactSheetLookup("2026-08-31", [
        { ...links[0]!, factSheetUrl: "http://www.bcthk.com/wr/Simple-Fund-Fact-Sheet" },
      ]),
    ).toThrow("BCT MPF - Simple Plan");
  });

  it("refuses an entry that does not name the local file", () => {
    // 受託人的連結會不預告改版，所以檔名明寫，不由 URL 尾段推算。
    expect(() =>
      toTrusteeFactSheetLookup("2026-08-31", [{ ...links[0]!, file: "" }]),
    ).toThrow("must name a local file");
  });

  it("refuses a scheme listed twice, instead of silently keeping one", () => {
    expect(() => toTrusteeFactSheetLookup("2026-08-31", [...links, links[0]!])).toThrow(
      "BCT MPF - Simple Plan",
    );
  });

  it("reads the newest dated batch and ignores non-date directories", async () => {
    const root = await sourcesDirectory({
      "2026-08-11": [links[0]!],
      "2026-08-31": links,
      lipper: null,
    });

    const lookup = await loadTrusteeFactSheetLookup(root);

    expect(lookup.capturedAt).toBe("2026-08-31");
    expect(lookup.linkOf("BCT (MPF) Industry Choice")?.file).toBe("BCT_IS.pdf");
  });

  it("treats a missing list as nothing transcribed yet, not as an error", async () => {
    // 對照 `assertFactSheetCoverage`：積金局的連結必須齊，受託人這份本來就唔齊。
    const root = await sourcesDirectory({ "2026-08-11": null });

    const lookup = await loadTrusteeFactSheetLookup(root);

    expect(lookup.schemes).toBe(0);
    expect(lookup.linkOf("BCT MPF - Simple Plan")).toBeUndefined();
    expect(lookup.capturedAt).toBeUndefined();
  });

  it("treats a missing sources directory as nothing transcribed yet", async () => {
    const lookup = await loadTrusteeFactSheetLookup("/nonexistent/kwmpf/sources");

    expect(lookup.schemes).toBe(0);
  });
});
