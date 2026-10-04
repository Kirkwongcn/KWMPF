import { describe, expect, it } from "vitest";
import { applyChartAllocations } from "../src/fact-sheet-chart-merge";
import type { FactSheetDisclosureFund } from "../src/fact-sheet-disclosure-lookup";
import type { ChartAllocationFile } from "../src/fact-sheet-chart-read";

const fund = (name: string, kind = "chart-only"): FactSheetDisclosureFund => ({
  fundClassIds: [`id-${name}`],
  schemeName: "Sun Life Rainbow MPF Scheme",
  constituentFundName: name,
  factSheetFile: "SunLife_Rainbow.pdf",
  factSheetUrl: "https://example.test/sl.pdf",
  factSheetSource: "trustee",
  factSheetAsOf: "2026-06-30",
  allocations: [],
  topHoldings: [],
  unavailableFields: ["allocation"],
  unavailableReasons: { allocation: "drawn as a chart" },
  unavailableKinds: { allocation: kind as "chart-only" },
});

const chart: ChartAllocationFile = {
  generatedAt: "2026-10-04T16:00:00.000Z",
  method: { renderer: "pdftoppm -r 300" },
  funds: [
    {
      schemeName: "Sun Life Rainbow MPF Scheme",
      constituentFundName: "Alpha Fund",
      factSheetFile: "SunLife_Rainbow.pdf",
      sourceSha256: "abc",
      page: 22,
      heading: "Portfolio Allocation 投資組合分佈",
      status: "ok",
      entries: [
        { label: "金融 Financials", percent: 71.2 },
        { label: "現金及其他 Cash and Others", percent: 28.8 },
      ],
      printed: ["71.2%", "28.80%"],
      total: 100,
      reads: ["rapidocr", "tesseract"],
    },
    {
      schemeName: "Sun Life Rainbow MPF Scheme",
      constituentFundName: "Beta Fund",
      factSheetFile: "SunLife_Rainbow.pdf",
      sourceSha256: "abc",
      page: 23,
      status: "rejected",
      reason: "row 2 differs",
    },
  ],
};

describe("merging chart-read allocations", () => {
  it("fills a chart-only allocation, keeps the printed form and labels the source", () => {
    const funds = [fund("Alpha Fund"), fund("Beta Fund")];
    expect(applyChartAllocations(funds, chart, () => "abc")).toEqual({ applied: 1, stale: [] });
    expect(funds[0]).toMatchObject({
      allocations: [
        {
          heading: "Portfolio Allocation 投資組合分佈",
          entries: [
            { label: "金融 Financials", percent: 71.2, printed: "71.2%" },
            { label: "現金及其他 Cash and Others", percent: 28.8, printed: "28.80%" },
          ],
        },
      ],
      allocationSource: { method: "chart-read", readAt: chart.generatedAt, total: 100, page: 22 },
      unavailableFields: [],
      unavailableKinds: {},
      unavailableReasons: {},
    });
    // 讀圖拒絕的基金照舊係官方以圖表披露。
    expect(funds[1]).toMatchObject({ allocations: [], unavailableKinds: { allocation: "chart-only" } });
  });

  it("does not reuse a reading once the fact sheet file has changed", () => {
    const funds = [fund("Alpha Fund")];
    expect(applyChartAllocations(funds, chart, () => "changed")).toEqual({
      applied: 0,
      stale: ["Sun Life Rainbow MPF Scheme Alpha Fund (SunLife_Rainbow.pdf)"],
    });
    expect(funds[0]!.allocations).toEqual([]);
  });

  it("never overrides an allocation that was not chart-only", () => {
    const funds = [fund("Alpha Fund", "not-disclosed")];
    expect(applyChartAllocations(funds, chart, () => "abc").applied).toBe(0);
    expect(funds[0]!.unavailableKinds.allocation).toBe("not-disclosed");
  });

  it("refuses two readings for one fund", () => {
    const twice = { ...chart, funds: [chart.funds[0]!, chart.funds[0]!] };
    expect(() => applyChartAllocations([fund("Alpha Fund")], twice, () => "abc")).toThrow(
      /2 chart-read records/,
    );
  });
});
