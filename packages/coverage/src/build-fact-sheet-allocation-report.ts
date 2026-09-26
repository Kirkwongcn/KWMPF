import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  parseFactSheetDisclosures,
  type FactSheetDisclosure,
  type FactSheetSource,
} from "./fact-sheet-allocation";
import { FACT_SHEET_SCHEMES, factSheetContract } from "./fact-sheet-allocation-contracts";
import {
  normalizeFundName,
  pairFactSheetDisclosures,
  type PlatformFund,
  type PairingResult,
} from "./fact-sheet-allocation-pairing";
import { markWordStarts, parsePdfXml } from "./pdf-xml";
import { loadTrusteeFactSheetLookup } from "./trustee-fact-sheet-lookup";

/**
 * 逐個計劃抽取便覽的配置及十大持倉，配對平台的成分基金，輸出覆蓋報告。
 *
 * 報告要答三條問題：邊隻基金配對到、邊隻配對唔到（點解）、以及配對到但官方冇披露
 * （點解）。冇披露唔等於出錯，但一定要寫明原因，唔可以靜靜哋當冇嘢。
 */

const run = promisify(execFile);

/** 一個計劃用咗嘅便覽檔案。逐隻基金一份時，一個計劃會有多過一項。 */
export type SchemeReportFile = {
  file: string;
  factSheetUrl: string;
  /** 逐隻基金一份時，呢一份覆蓋邊隻成分基金；一個計劃一份時冇呢一欄。 */
  constituentFund?: string;
  /** 呢一份便覽自己的截至日期。同一個計劃唔同基金可以唔同期。 */
  factSheetAsOf: string;
};

export type SchemeReport = {
  scheme: string;
  /** 計劃層面的來源連結；逐隻基金一份時，係列出全部便覽嗰一版。 */
  factSheetUrl: string;
  factSheetSource: FactSheetSource;
  /** 用咗嘅便覽逐份列出，連自己的截至日期同來源連結。 */
  factSheetFiles: SchemeReportFile[];
  /** 退回積金局副本的原因；用咗受託人版就冇呢一欄。 */
  trusteeFallbackReason?: string;
  /**
   * 全部基金共用同一期時嘅截至日期。逐隻基金一份便覽而期別唔一致就冇呢一欄——
   * 取最舊嗰個冚全份等於改寫其餘基金的官方日期，逐份日期見 `factSheetFiles`。
   */
  factSheetAsOf?: string;
  platformFunds: number;
  sections: number;
  error?: string;
} & Partial<Omit<PairingResult, "pairedDisclosures">>;

/**
 * 發布用的披露檔：逐個基金類別一筆，帶住便覽的原文披露及自己的截至日期。
 * 覆蓋報告只收數目，唔會帶住成份披露，所以兩份檔各自輸出。
 */
export type FactSheetDisclosureFile = {
  generatedAt: string;
  platformSnapshot: string;
  factSheetBatch: string;
  funds: {
    fundClassIds: string[];
    schemeName: string;
    constituentFundName: string;
    factSheetFile: string;
    factSheetUrl: string;
    factSheetSource: FactSheetSource;
    /** 有抄錄受託人來源但抽唔到，先至退回副本；未抄錄嘅計劃冇呢一欄。 */
    trusteeFallback?: true;
    factSheetAsOf: string;
    temporalScopes?: FactSheetDisclosure["temporalScopes"];
    allocations: FactSheetDisclosure["allocations"];
    topHoldings: FactSheetDisclosure["topHoldings"];
    unavailableFields: string[];
    unavailableReasons: Record<string, string>;
    unavailableKinds: FactSheetDisclosure["unavailableKinds"];
  }[];
};

export type FactSheetAllocationReport = {
  generatedAt: string;
  platformSnapshot: string;
  factSheetBatch: string;
  totals: {
    platformFunds: number;
    paired: number;
    withAllocation: number;
    withTopHoldings: number;
    unpairedPlatformFunds: number;
    trusteeSourced: number;
    unpairedDisclosures: number;
  };
  schemes: SchemeReport[];
};

/**
 * `pdftohtml -xml` 保留每段文字的座標同字體，`-layout` 的純文字做唔到。
 *
 * 但 `pdftohtml` 唔會講兩段緊貼的文字之間本來有冇空格，所以同時跑 `pdftotext -bbox`
 * 攞返 poppler 自己的切詞，標記邊一段係一個詞的開頭（見 `markWordStarts`）。
 */
export async function factSheetPages(pdfPath: string) {
  const maxBuffer = 256 * 1024 * 1024;
  const [xml, bbox] = await Promise.all([
    run("pdftohtml", ["-xml", "-i", "-hidden", "-stdout", pdfPath], { maxBuffer }),
    run("pdftotext", ["-bbox", pdfPath, "-"], { maxBuffer }),
  ]);
  return markWordStarts(parsePdfXml(xml.stdout), bbox.stdout);
}

/** 一個來源的全部便覽檔案：一個計劃一份時得一項，逐隻基金一份時逐份一項。 */
type FactSheetCandidate = {
  source: FactSheetSource;
  factSheetUrl: string;
  files: { file: string; factSheetUrl: string; constituentFund?: string }[];
};

export type ParsedFactSheet = {
  file: SchemeReportFile;
  disclosure: FactSheetDisclosure;
};

/**
 * 逐隻基金一份便覽時，認住一份便覽裡面唯一嗰隻基金。
 *
 * 兩條線都係報錯而唔係略過：一份只可以有一個區段（多過一個代表切錯，唔知邊個屬邊隻
 * 基金），而且區段的基金名要同名單上聲明嗰隻對得上（對唔上就係名單抄錯或者官網換咗
 * 檔，靜靜哋照用等於把另一隻基金的配置同持倉貼落去）。
 */
export function disclosureForFund(
  file: string,
  constituentFund: string,
  disclosures: FactSheetDisclosure[],
) {
  if (disclosures.length !== 1) {
    throw new Error(
      `${file} covers ${constituentFund} but holds ${disclosures.length} constituent fund sections`,
    );
  }
  const disclosure = disclosures[0]!;
  if (normalizeFundName(disclosure.constituentFundName) !== normalizeFundName(constituentFund)) {
    throw new Error(
      `${file} is listed for ${constituentFund} but its section is named ${disclosure.constituentFundName}`,
    );
  }
  return disclosure;
}

/** 逐份便覽抽披露，逐份記低自己的檔名、連結同截至日期。 */
export async function parseFactSheetCandidate(
  directory: string,
  candidate: FactSheetCandidate,
  contract: Parameters<typeof parseFactSheetDisclosures>[1],
): Promise<ParsedFactSheet[]> {
  const parsed: ParsedFactSheet[] = [];
  for (const entry of candidate.files) {
    const disclosures = parseFactSheetDisclosures(
      await factSheetPages(join(directory, entry.file)),
      contract,
    );
    if (entry.constituentFund === undefined) {
      for (const disclosure of disclosures) {
        parsed.push({
          file: { file: entry.file, factSheetUrl: entry.factSheetUrl, factSheetAsOf: disclosure.factSheetAsOf },
          disclosure,
        });
      }
      continue;
    }
    const disclosure = disclosureForFund(entry.file, entry.constituentFund, disclosures);
    parsed.push({
      file: {
        file: entry.file,
        factSheetUrl: entry.factSheetUrl,
        constituentFund: entry.constituentFund,
        factSheetAsOf: disclosure.factSheetAsOf,
      },
      disclosure,
    });
  }
  return parsed;
}

/** 全部便覽同一期先報計劃層面的截至日期；唔同期就逐份各自保留。 */
export function sharedFactSheetAsOf(files: SchemeReportFile[]) {
  const dates = new Set(files.map((file) => file.factSheetAsOf));
  return dates.size === 1 ? [...dates][0] : undefined;
}

export function platformFundsBySchemeName(
  records: { fundClassId: string; identity: { schemeName: string; constituentFundName: string } }[],
) {
  const funds = new Map<string, PlatformFund>();
  for (const record of records) {
    const { schemeName, constituentFundName } = record.identity;
    const key = `${schemeName} ${constituentFundName}`;
    const existing = funds.get(key);
    if (existing) existing.fundClassIds.push(record.fundClassId);
    else funds.set(key, { schemeName, constituentFundName, fundClassIds: [record.fundClassId] });
  }
  return [...funds.values()];
}

export function summarize(schemes: SchemeReport[], platformFunds: number) {
  const paired = schemes.flatMap((scheme) => scheme.paired ?? []);
  return {
    platformFunds,
    paired: paired.length,
    withAllocation: paired.filter((fund) => fund.allocationDimensions > 0).length,
    withTopHoldings: paired.filter((fund) => fund.topHoldings > 0).length,
    unpairedPlatformFunds: schemes.reduce(
      (total, scheme) => total + (scheme.unpairedPlatformFunds?.length ?? 0),
      0,
    ),
    // 用咗受託人官網最新一期的計劃數；其餘退回積金局副本，逐個計劃有 `trusteeFallbackReason`。
    trusteeSourced: schemes.filter((scheme) => scheme.factSheetSource === "trustee")
      .length,
    unpairedDisclosures: schemes.reduce(
      (total, scheme) => total + (scheme.unpairedDisclosures?.length ?? 0),
      0,
    ),
  };
}

function valuesAfter(flag: string) {
  return process.argv.flatMap((value, index) =>
    value === flag && process.argv[index + 1] ? [process.argv[index + 1] as string] : [],
  );
}

if (import.meta.main) {
  const platformPath = valuesAfter("--platform")[0];
  const linksPath = valuesAfter("--links")[0];
  const factSheetDirectory = valuesAfter("--fact-sheets")[0];
  const outputPath = valuesAfter("--output")[0];
  const disclosuresPath = valuesAfter("--disclosures")[0];

  if (!platformPath || !linksPath || !factSheetDirectory || !outputPath) {
    throw new Error(
      "Usage: bun --filter @kwmpf/coverage fact-sheet-allocation-report --platform <mpf-fund-platform.json> --links <fund-fact-sheet-links.json> --fact-sheets <directory of PDFs> --output <report.json> [--disclosures <disclosures.json>] [--trustee-sources <data/sources>]",
    );
  }

  const snapshot = JSON.parse(await readFile(platformPath, "utf8")) as {
    records: { fundClassId: string; identity: { schemeName: string; constituentFundName: string } }[];
  };
  const links = JSON.parse(await readFile(linksPath, "utf8")) as {
    scheme: string;
    factSheetUrl: string;
  }[];
  const platformFunds = platformFundsBySchemeName(snapshot.records);

  const trustees = await loadTrusteeFactSheetLookup(valuesAfter("--trustee-sources")[0]);

  const schemes: SchemeReport[] = [];
  const disclosureFunds: FactSheetDisclosureFile["funds"] = [];
  for (const scheme of FACT_SHEET_SCHEMES) {
    const link = links.find((candidate) => candidate.scheme === scheme);
    const funds = platformFunds.filter((fund) => fund.schemeName === scheme);
    if (!link) {
      schemes.push({
        scheme,
        factSheetUrl: "",
        factSheetSource: "mpfa-registry",
        factSheetFiles: [],
        platformFunds: funds.length,
        sections: 0,
        error: "no fact sheet link recorded in the MPFA register batch",
      });
      continue;
    }

    // 內容抓受託人官網最新一期，配對仍然用積金局登記冊那份權威名單。
    // 官網那份抽唔到（改版、下載失敗、版面對唔上契約）就退回積金局副本，
    // 但退回一定要寫低原因，唔可以靜靜哋當成最新版。
    const trustee = trustees.linkOf(scheme);
    const candidates: FactSheetCandidate[] = [
      ...(trustee
        ? [
            {
              source: "trustee" as const,
              factSheetUrl: trustee.factSheetUrl,
              files: trustee.funds
                ? trustee.funds.map((fund) => ({
                    file: fund.file,
                    factSheetUrl: fund.factSheetUrl,
                    constituentFund: fund.constituentFund,
                  }))
                : [{ file: trustee.file ?? "", factSheetUrl: trustee.factSheetUrl }],
            },
          ]
        : []),
      {
        source: "mpfa-registry" as const,
        factSheetUrl: link.factSheetUrl,
        files: [
          { file: link.factSheetUrl.split("/").at(-1) ?? "", factSheetUrl: link.factSheetUrl },
        ],
      },
    ];

    let chosen: FactSheetCandidate | undefined;
    let parsed: ParsedFactSheet[] | undefined;
    let platformNamePrefix: RegExp | undefined;
    let trusteeFallbackReason: string | undefined;
    for (const candidate of candidates) {
      // 同一個計劃嘅受託人版同積金局副本可以係完全唔同嘅版面（例如海通），
      // 兩個來源各自揀返啱嘅契約，唔可以夾硬共用一份。
      const contract = factSheetContract(scheme, candidate.source);
      try {
        parsed = await parseFactSheetCandidate(factSheetDirectory, candidate, contract);
        chosen = candidate;
        platformNamePrefix = contract.platformNamePrefix;
        break;
      } catch (error) {
        if (candidate.source === "trustee") {
          trusteeFallbackReason = (error as Error).message;
          continue;
        }
        schemes.push({
          scheme,
          factSheetUrl: candidate.factSheetUrl,
          factSheetSource: candidate.source,
          factSheetFiles: candidate.files.map((entry) => ({
            file: entry.file,
            factSheetUrl: entry.factSheetUrl,
            ...(entry.constituentFund ? { constituentFund: entry.constituentFund } : {}),
            factSheetAsOf: "",
          })),
          ...(trusteeFallbackReason ? { trusteeFallbackReason } : {}),
          platformFunds: funds.length,
          sections: 0,
          error: (error as Error).message,
        });
      }
    }
    if (!chosen || !parsed) continue;

    const disclosures = parsed.map((entry) => entry.disclosure);
    const fileOf = new Map(parsed.map((entry) => [entry.disclosure, entry.file]));
    const factSheetFiles = parsed.map((entry) => entry.file);

    const { pairedDisclosures, ...pairing } = pairFactSheetDisclosures(
      funds,
      disclosures,
      platformNamePrefix,
    );
    const sharedAsOf = sharedFactSheetAsOf(factSheetFiles);
    schemes.push({
      scheme,
      factSheetUrl: chosen.factSheetUrl,
      factSheetSource: chosen.source,
      factSheetFiles,
      ...(trusteeFallbackReason ? { trusteeFallbackReason } : {}),
      ...(sharedAsOf ? { factSheetAsOf: sharedAsOf } : {}),
      platformFunds: funds.length,
      sections: disclosures.length,
      ...pairing,
    });
    for (const { fundClassIds, disclosure } of pairedDisclosures) {
      const from = fileOf.get(disclosure)!;
      disclosureFunds.push({
        fundClassIds,
        schemeName: disclosure.schemeName,
        constituentFundName: disclosure.constituentFundName,
        factSheetFile: from.file,
        factSheetUrl: from.factSheetUrl,
        factSheetSource: chosen.source,
        ...(trusteeFallbackReason ? { trusteeFallback: true as const } : {}),
        factSheetAsOf: disclosure.factSheetAsOf,
        ...(disclosure.temporalScopes
          ? { temporalScopes: disclosure.temporalScopes }
          : {}),
        allocations: disclosure.allocations,
        topHoldings: disclosure.topHoldings,
        unavailableFields: disclosure.unavailableFields,
        unavailableReasons: disclosure.unavailableReasons,
        unavailableKinds: disclosure.unavailableKinds,
      });
    }
  }

  const report: FactSheetAllocationReport = {
    generatedAt: new Date().toISOString(),
    platformSnapshot: platformPath,
    factSheetBatch: linksPath,
    totals: summarize(schemes, platformFunds.length),
    schemes,
  };

  await writeFile(outputPath, `${JSON.stringify(report, undefined, 2)}\n`);
  if (disclosuresPath) {
    const file: FactSheetDisclosureFile = {
      generatedAt: report.generatedAt,
      platformSnapshot: platformPath,
      factSheetBatch: linksPath,
      funds: disclosureFunds,
    };
    await writeFile(disclosuresPath, `${JSON.stringify(file, undefined, 2)}\n`);
  }
  console.log(
    JSON.stringify(
      { outputPath, ...(disclosuresPath ? { disclosuresPath } : {}), ...report.totals },
      undefined,
      2,
    ),
  );
}
