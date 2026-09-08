import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadTrusteeFactSheetLookup,
  toTrusteeFactSheetLookup,
  type TrusteeFactSheetFund,
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

/** MASS 逐隻成分基金各自一份便覽，官網冇合併版，所以一個計劃有多份檔案。 */
const massFunds: TrusteeFactSheetFund[] = [
  {
    constituentFund: "Global Stable Fund",
    factSheetUrl: "https://app2.yflife.com/MPFWeb/pdf/fact_sheet/GLSF_E.pdf",
    file: "MASS_GLSF.pdf",
  },
  {
    constituentFund: "Global Growth Fund",
    factSheetUrl: "https://app2.yflife.com/MPFWeb/pdf/fact_sheet/GLGF_E.pdf",
    file: "MASS_GLGF.pdf",
  },
];

const massLink: TrusteeFactSheetLink = {
  scheme: "MASS Mandatory Provident Fund Scheme",
  factSheetUrl: "https://www.yflife.com/en/product/mpf-hongkong/fund-price-history/",
  funds: massFunds,
};

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

  it("resolves a scheme whose trustee publishes one fact sheet per fund", () => {
    const lookup = toTrusteeFactSheetLookup("2026-08-31", [massLink]);

    expect(lookup.linkOf("MASS Mandatory Provident Fund Scheme")?.funds).toEqual(
      massLink.funds,
    );
    // 計劃層面嘅連結係列出全部便覽嗰一版，唔係其中一份 PDF。
    expect(lookup.linkOf("MASS Mandatory Provident Fund Scheme")?.file).toBeUndefined();
  });

  it("refuses an entry that names both one file and a per-fund list", () => {
    // 兩者都寫即係唔知邊個作準；靜靜哋揀其中一個等於猜。
    expect(() =>
      toTrusteeFactSheetLookup("2026-08-31", [{ ...massLink, file: "MASS.pdf" }]),
    ).toThrow("not both");
  });

  it("refuses a per-fund entry that does not name the constituent fund it covers", () => {
    expect(() =>
      toTrusteeFactSheetLookup("2026-08-31", [
        { ...massLink, funds: [{ ...massFunds[0]!, constituentFund: " " }] },
      ]),
    ).toThrow("must name the constituent fund");
  });

  it("refuses a per-fund link that is not served over HTTPS", () => {
    expect(() =>
      toTrusteeFactSheetLookup("2026-08-31", [
        {
          ...massLink,
          funds: [
            {
              ...massFunds[0]!,
              factSheetUrl: "http://app2.yflife.com/MPFWeb/pdf/fact_sheet/GLSF_E.pdf",
            },
          ],
        },
      ]),
    ).toThrow("Global Stable Fund");
  });

  it("refuses a per-fund entry that does not name the local file", () => {
    expect(() =>
      toTrusteeFactSheetLookup("2026-08-31", [
        { ...massLink, funds: [{ ...massFunds[0]!, file: "" }] },
      ]),
    ).toThrow("must name a local file");
  });

  it("refuses a fund listed twice, instead of silently keeping one of its fact sheets", () => {
    expect(() =>
      toTrusteeFactSheetLookup("2026-08-31", [
        { ...massLink, funds: [massFunds[0]!, { ...massFunds[1]!, constituentFund: "Global Stable Fund" }] },
      ]),
    ).toThrow("more than once");
  });

  it("refuses two funds pointing at the same file", () => {
    // 兩隻基金指去同一份便覽，等於把其中一隻嘅配置及持倉貼落另一隻度。
    expect(() =>
      toTrusteeFactSheetLookup("2026-08-31", [
        { ...massLink, funds: [massFunds[0]!, { ...massFunds[1]!, file: massFunds[0]!.file }] },
      ]),
    ).toThrow("for more than one fund");
  });

  it("refuses an empty per-fund list", () => {
    expect(() =>
      toTrusteeFactSheetLookup("2026-08-31", [{ ...massLink, funds: [] }]),
    ).toThrow("names no funds");
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
