import type { FactSheetDisclosureFund } from "./fact-sheet-disclosure-lookup";
import type { ChartAllocationFile } from "./fact-sheet-chart-read";

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
