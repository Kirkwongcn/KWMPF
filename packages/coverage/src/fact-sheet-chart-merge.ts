import { factSheetContract } from "./fact-sheet-allocation-contracts";
import type { FactSheetDisclosureFund } from "./fact-sheet-disclosure-lookup";
import type { ChartAllocationFile, ChartAllocationRecord } from "./fact-sheet-chart-read";

/**
 * 覆核期間 JSON 可能被人手改過：合併前再核一次，數值同印出原樣、合計、圖例清單有任何
 * 一樣對唔上就報錯，唔會靜靜發布（讀圖時嘅核對結果唔可以當成永遠成立）。
 */
function assertConsistent(record: Extract<ChartAllocationRecord, { status: "ok" }>) {
  const where = `${record.schemeName} ${record.constituentFundName}`;
  const spec = factSheetContract(record.schemeName, "trustee").allocation.chartRead;
  if (!spec) throw new Error(`${where}: contract has no chartRead`);
  if (record.entries.length < 2 || record.entries.length !== record.printed.length) {
    throw new Error(`${where}: ${record.entries.length} entries but ${record.printed.length} printed values`);
  }
  const labels = new Set(spec.vocabulary.map((entry) => entry.label));
  let total = 0;
  const decimals = Math.max(...record.printed.map((value) => value.replace("%", "").split(".")[1]?.length ?? 0));
  for (const [index, entry] of record.entries.entries()) {
    const printed = record.printed[index]!;
    if (!/^-?\d+(\.\d+)?%$/.test(printed) || Number(printed.slice(0, -1)) !== entry.percent) {
      throw new Error(`${where}: "${printed}" does not match ${entry.percent}`);
    }
    if (!labels.has(entry.label)) throw new Error(`${where}: "${entry.label}" is not in the legend list`);
    total += Math.round(entry.percent * 10 ** decimals);
  }
  total /= 10 ** decimals;
  if (total !== record.total || Math.abs(total - 100) > spec.sumTolerance) {
    throw new Error(`${where}: entries total ${total}, recorded ${record.total}`);
  }
}

/**
 * 把已覆核的讀圖結果（`fund-fact-sheet-chart-allocations.json`，ADR 0013）合併入披露檔。
 *
 * 只會填官方以圖表披露（`chart-only`）嘅配置；同一計劃、同一基金、同一份檔案，而且
 * 檔案 SHA-256 同讀圖嗰陣一樣先用——便覽換咗版就唔可以沿用舊圖的讀數。讀圖拒絕
 * （`rejected`）嘅基金照舊係 `chart-only`。
 */
export function applyChartAllocations(
  funds: FactSheetDisclosureFund[],
  chart: ChartAllocationFile,
  sha256Of: (factSheetFile: string) => string | undefined,
) {
  let applied = 0;
  const stale: string[] = [];
  for (const fund of funds) {
    if (fund.unavailableKinds.allocation !== "chart-only") continue;
    const records = chart.funds.filter(
      (record) =>
        record.schemeName === fund.schemeName &&
        record.constituentFundName === fund.constituentFundName &&
        record.factSheetFile === fund.factSheetFile,
    );
    if (records.length > 1) {
      throw new Error(
        `${fund.schemeName} ${fund.constituentFundName}: ${records.length} chart-read records`,
      );
    }
    const record = records[0];
    if (!record || record.status !== "ok") continue;
    assertConsistent(record);
    if (record.sourceSha256 !== sha256Of(fund.factSheetFile)) {
      stale.push(`${fund.schemeName} ${fund.constituentFundName} (${fund.factSheetFile})`);
      continue;
    }
    fund.allocations = [
      {
        heading: record.heading ?? "",
        entries: record.entries.map((entry, index) => ({
          ...entry,
          printed: record.printed[index]!,
        })),
      },
    ];
    fund.allocationSource = {
      method: "chart-read",
      readAt: chart.generatedAt,
      reads: record.reads,
      total: record.total,
      page: record.page ?? 0,
    };
    fund.unavailableFields = fund.unavailableFields.filter((field) => field !== "allocation");
    delete fund.unavailableReasons.allocation;
    delete fund.unavailableKinds.allocation;
    applied += 1;
  }
  return { applied, stale };
}
