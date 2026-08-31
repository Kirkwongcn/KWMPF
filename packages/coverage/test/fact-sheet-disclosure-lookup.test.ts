import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadFactSheetDisclosureLookup,
  toFactSheetDisclosureLookup,
  type FactSheetDisclosureFile,
  type FactSheetDisclosureFund,
} from "../src/fact-sheet-disclosure-lookup";

function fund(
  overrides: Partial<FactSheetDisclosureFund> = {},
): FactSheetDisclosureFund {
  return {
    fundClassIds: ["mpfa-cf-1", "mpfa-cf-2"],
    schemeName: "BCT (MPF) Pro Choice",
    constituentFundName: "Asian Equity Fund",
    factSheetFile: "MT00016.pdf",
    factSheetUrl: "https://www.mpfa.org.hk/assets/FF/MT00016.pdf",
    factSheetSource: "mpfa-registry",
    factSheetAsOf: "2025-12-31",
    allocations: [
      { heading: "Portfolio Allocation", entries: [{ label: "Equities", percent: 99.4 }] },
    ],
    topHoldings: [{ rank: 1, security: "TENCENT HOLDINGS LTD", percent: 9.36 }],
    unavailableFields: [],
    unavailableReasons: {},
    unavailableKinds: {},
    ...overrides,
  };
}

function file(funds: FactSheetDisclosureFund[]): FactSheetDisclosureFile {
  return {
    generatedAt: "2026-08-30T00:00:00.000Z",
    platformSnapshot: "data/sources/2026-08-29/mpf-fund-platform.json",
    factSheetBatch: "data/sources/2026-08-28/fund-fact-sheet-links.json",
    funds,
  };
}

async function sourcesDirectory(
  batches: Record<string, FactSheetDisclosureFile | null>,
) {
  const root = await mkdtemp(join(tmpdir(), "kwmpf-disclosures-"));
  for (const [name, batch] of Object.entries(batches)) {
    await mkdir(join(root, name), { recursive: true });
    if (batch)
      await writeFile(
        join(root, name, "fund-fact-sheet-disclosures.json"),
        JSON.stringify(batch),
      );
  }
  return root;
}

describe("fact sheet disclosure lookup", () => {
  it("shares one disclosure across the fund classes of the same constituent fund", () => {
    const lookup = toFactSheetDisclosureLookup("2026-08-28", file([fund()]));

    expect(lookup.disclosureOf("mpfa-cf-1")).toEqual(
      lookup.disclosureOf("mpfa-cf-2"),
    );
    expect(lookup.disclosureOf("mpfa-cf-1")?.topHoldings[0]?.security).toBe(
      "TENCENT HOLDINGS LTD",
    );
    expect(lookup.funds).toBe(2);
  });

  it("keeps the fact sheet's own as-of date instead of the platform's", () => {
    const lookup = toFactSheetDisclosureLookup(
      "2026-08-28",
      file([fund({ factSheetAsOf: "2026-03-31" })]),
    );

    expect(lookup.disclosureOf("mpfa-cf-1")?.factSheetAsOf).toBe("2026-03-31");
    expect(lookup.capturedAt).toBe("2026-08-28");
  });

  it("leaves out the fund class list the coverage report needs", () => {
    const lookup = toFactSheetDisclosureLookup("2026-08-28", file([fund()]));

    expect(lookup.disclosureOf("mpfa-cf-1")).not.toHaveProperty("fundClassIds");
  });

  it("answers a fund class the fact sheets never covered with nothing", () => {
    const lookup = toFactSheetDisclosureLookup("2026-08-28", file([fund()]));

    expect(lookup.disclosureOf("mpfa-cf-99")).toBeUndefined();
  });

  it("refuses a fund class listed twice, instead of silently keeping one", () => {
    // 兩份披露搶同一個基金類別，覆蓋其中一份等於把另一隻基金的持倉貼落去。
    expect(() =>
      toFactSheetDisclosureLookup(
        "2026-08-28",
        file([fund(), fund({ constituentFundName: "Global Equity Fund" })]),
      ),
    ).toThrow("mpfa-cf-1");
  });

  it("reads the newest dated batch and ignores non-date directories", async () => {
    const root = await sourcesDirectory({
      "2026-08-11": file([fund({ factSheetAsOf: "2025-06-30" })]),
      "2026-08-28": file([fund()]),
      lipper: null,
    });

    const lookup = await loadFactSheetDisclosureLookup(root);

    expect(lookup.capturedAt).toBe("2026-08-28");
    expect(lookup.disclosureOf("mpfa-cf-1")?.factSheetAsOf).toBe("2025-12-31");
  });

  it("falls back to the newest batch that actually carries the disclosures file", async () => {
    const root = await sourcesDirectory({
      "2026-08-11": file([fund()]),
      "2026-08-28": null,
    });

    expect((await loadFactSheetDisclosureLookup(root)).capturedAt).toBe(
      "2026-08-11",
    );
  });

  it("says so when no dated batch carries the disclosures file", async () => {
    const root = await sourcesDirectory({ lipper: null });

    await expect(loadFactSheetDisclosureLookup(root)).rejects.toThrow(
      "fund-fact-sheet-disclosures.json",
    );
  });
});
