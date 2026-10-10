import type { SourceRecord } from "./build-coverage";
import type { PublicationInput } from "./publication-preflight";

function returnsAsOf(record: SourceRecord) {
  return (
    record.returns?.[1]?.dataAsOf ??
    record.returns?.[3]?.dataAsOf ??
    record.returns?.[5]?.dataAsOf ??
    record.returns?.[10]?.dataAsOf ??
    record.sinceLaunchReturn?.dataAsOf
  );
}

function returnSources(record: SourceRecord) {
  return Object.fromEntries(
    Object.entries(record.returns ?? {}).flatMap(([period, value]) =>
      value
        ? [
            [
              period,
              {
                dataAsOf: value.dataAsOf,
                sourceUrl: value.sourceUrl ?? record.sourceUrl ?? "",
                ...(value.retrievedAt ? { retrievedAt: value.retrievedAt } : {}),
              },
            ],
          ]
        : [],
    ),
  );
}

// 官方詳情頁已披露的費用組成部分，逐個原樣帶入 payload；缺失的欄位留空，不補 0。
const feeFields = [
  "oci1yHkd",
  "oci3yHkd",
  "oci5yHkd",
  "trusteeCustodianFee",
  "empfPlatformFee",
  "memberServicingFee",
  "investmentManagementFee",
  "guaranteeCharge",
  "joiningFee",
  "annualFee",
  "contributionCharge",
  "bidSpread",
  "offerSpread",
  "withdrawalCharge",
] as const;

function numericFundOverviewFields(record: SourceRecord) {
  return Object.fromEntries(
    feeFields.flatMap((field) => {
      const value = record.fundOverview?.[field];
      return typeof value === "number" ? [[field, value]] : [];
    }),
  );
}

export function buildPublicationInputs(records: SourceRecord[]): PublicationInput[] {
  return records.map((record) => ({
    fundClassId: record.fundClassId,
    identity: record.identity,
    current: record.current,
    status: record.currentStatus ?? (record.current ? "verified" : "stale"),
    dataAsOf: record.dataAsOf,
    sourceUrl: record.sourceUrl,
    unavailableFields:
      record.cumulativeReturns?.[3] &&
      record.cumulativeReturns[3].cumulative === null
        ? [...(record.unavailableFields ?? []), "cumulativeReturn3y"]
        : record.unavailableFields,
    publicFields: {
      ...(typeof record.returns?.[1]?.annualized === "number"
        ? { annualizedReturn1y: record.returns[1].annualized }
        : {}),
      ...(typeof record.returns?.[3]?.annualized === "number"
        ? { annualizedReturn3y: record.returns[3].annualized }
        : {}),
      ...(typeof record.returns?.[5]?.annualized === "number"
        ? { annualizedReturn5y: record.returns[5].annualized }
        : {}),
      ...(typeof record.returns?.[10]?.annualized === "number"
        ? { annualizedReturn10y: record.returns[10].annualized }
        : {}),
      ...(typeof record.returns?.[1]?.cumulative === "number"
        ? { cumulativeReturn1y: record.returns[1].cumulative }
        : {}),
      ...(typeof record.returns?.[5]?.cumulative === "number"
        ? { cumulativeReturn5y: record.returns[5].cumulative }
        : {}),
      ...(typeof record.returns?.[10]?.cumulative === "number"
        ? { cumulativeReturn10y: record.returns[10].cumulative }
        : {}),
      // 受託人官方三年累積（ADR 0014）：有數值先出 cumulativeReturn3y；官方印「-」
      // 只出來源（printed "-"），並列入 unavailableFields，唔當 0。
      ...(record.cumulativeReturns?.[3]
        ? {
            ...(typeof record.cumulativeReturns[3].cumulative === "number"
              ? { cumulativeReturn3y: record.cumulativeReturns[3].cumulative }
              : {}),
            cumulativeReturnSources: {
              "3": {
                printed: record.cumulativeReturns[3].printed,
                dataAsOf: record.cumulativeReturns[3].dataAsOf,
                sourceUrl: record.cumulativeReturns[3].sourceUrl,
                retrievedAt: record.cumulativeReturns[3].retrievedAt,
              },
            },
          }
        : {}),
      ...(typeof record.fundOverview?.riskClass === "number"
        ? { riskClass: record.fundOverview.riskClass }
        : {}),
      ...(typeof record.fundOverview?.fundRiskIndicator === "number"
        ? { fundRiskIndicator: record.fundOverview.fundRiskIndicator }
        : {}),
      ...(typeof record.fundOverview?.latestFer === "number"
        ? { latestFer: record.fundOverview.latestFer }
        : {}),
      ...(typeof record.fundOverview?.managementFee === "number"
        ? { managementFee: record.fundOverview.managementFee }
        : {}),
      ...numericFundOverviewFields(record),
      ...(Array.isArray(record.fundOverview?.feeCaps)
        ? { feeCaps: record.fundOverview.feeCaps as string[] }
        : {}),
      ...(record.fundOverview?.feeDisclosures
        ? {
            feeDisclosures: record.fundOverview.feeDisclosures as Record<
              string,
              string
            >,
          }
        : {}),
      ...(typeof record.fundSizeHkdMillion === "number"
        ? { fundSizeHkdMillion: record.fundSizeHkdMillion }
        : {}),
      ...(record.fundSizeAsOf ? { fundSizeAsOf: record.fundSizeAsOf } : {}),
      ...(returnsAsOf(record) ? { returnsAsOf: returnsAsOf(record) } : {}),
      ...(Object.keys(returnSources(record)).length > 0
        ? { returnSources: returnSources(record) }
        : {}),
      ...(record.launchDate ? { launchDate: record.launchDate } : {}),
      ...(record.financialPeriodEndDate
        ? { financialPeriodEndDate: record.financialPeriodEndDate }
        : {}),
      ...(record.calendarYearReturns &&
      Object.keys(record.calendarYearReturns).length
        ? { calendarYearReturns: record.calendarYearReturns }
        : {}),
      ...(record.sinceLaunchReturn
        ? {
            sinceLaunchReturnAnnualized: record.sinceLaunchReturn.annualized,
            sinceLaunchReturnCumulative: record.sinceLaunchReturn.cumulative,
          }
        : {}),
    },
  }));
}
