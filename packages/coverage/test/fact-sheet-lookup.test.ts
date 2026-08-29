import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertFactSheetCoverage,
  FACT_SHEET_REGISTER_URL,
  loadFactSheetLookup,
  toFactSheetLookup,
} from "../src/fact-sheet-lookup";

const links = [
  {
    scheme: "BCT (MPF) Pro Choice",
    factSheetUrl: "https://www.mpfa.org.hk/assets/FF/MT00016.pdf",
  },
  {
    scheme: "SHKP MPF Employer Sponsored Scheme",
    factSheetUrl: "https://www.mpfa.org.hk/assets/FF/ES00020.pdf",
  },
];

async function sourcesDirectory(
  batches: Record<string, { scheme: string; factSheetUrl: string }[] | null>,
) {
  const root = await mkdtemp(join(tmpdir(), "kwmpf-fact-sheets-"));
  for (const [name, batch] of Object.entries(batches)) {
    await mkdir(join(root, name), { recursive: true });
    if (batch)
      await writeFile(
        join(root, name, "fund-fact-sheet-links.json"),
        JSON.stringify(batch),
      );
  }
  return root;
}

describe("fact sheet lookup", () => {
  it("resolves a scheme to its official fact sheet and records the register", () => {
    const lookup = toFactSheetLookup("2026-08-28", links);

    expect(lookup.urlOf("BCT (MPF) Pro Choice")).toBe(
      "https://www.mpfa.org.hk/assets/FF/MT00016.pdf",
    );
    expect(lookup.capturedAt).toBe("2026-08-28");
    expect(lookup.registerUrl).toBe(FACT_SHEET_REGISTER_URL);
  });

  it("refuses a link that is not served over HTTPS", () => {
    expect(() =>
      toFactSheetLookup("2026-08-28", [
        {
          scheme: "Insecure Scheme",
          factSheetUrl: "http://www.mpfa.org.hk/assets/FF/MT00016.pdf",
        },
      ]),
    ).toThrow("Insecure Scheme");
  });

  it("refuses a scheme listed twice, instead of silently keeping one", () => {
    expect(() => toFactSheetLookup("2026-08-28", [...links, links[0]!])).toThrow(
      "BCT (MPF) Pro Choice",
    );
  });

  it("reads the newest dated batch and ignores non-date directories", async () => {
    const root = await sourcesDirectory({
      "2026-08-11": [links[0]!],
      "2026-08-28": links,
      lipper: null,
    });

    const lookup = await loadFactSheetLookup(root);

    expect(lookup.capturedAt).toBe("2026-08-28");
    expect(lookup.urlOf("SHKP MPF Employer Sponsored Scheme")).toBe(
      "https://www.mpfa.org.hk/assets/FF/ES00020.pdf",
    );
  });

  it("falls back to the newest batch that actually carries the links file", async () => {
    const root = await sourcesDirectory({
      "2026-08-11": links,
      "2026-08-13": null,
    });

    expect((await loadFactSheetLookup(root)).capturedAt).toBe("2026-08-11");
  });

  it("says so when no dated batch carries the links file", async () => {
    const root = await sourcesDirectory({ lipper: null });

    await expect(loadFactSheetLookup(root)).rejects.toThrow(
      "fund-fact-sheet-links.json",
    );
  });

  it("refuses to seed a scheme the register never covered", () => {
    expect(() =>
      assertFactSheetCoverage(toFactSheetLookup("2026-08-28", links), [
        "BCT (MPF) Pro Choice",
        "Unlisted Scheme",
      ]),
    ).toThrow("Unlisted Scheme");
  });
});
