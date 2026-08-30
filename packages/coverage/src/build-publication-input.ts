import type { SourceRecord } from "./build-coverage";
import type { PublicationInput } from "./publication-preflight";

function returnsAsOf(record: SourceRecord) {
  return (
    record.returns?.[1]?.dataAsOf ??
    record.returns?.[5]?.dataAsOf ??
    record.returns?.[10]?.dataAsOf ??
    record.sinceLaunchReturn?.dataAsOf
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
    unavailableFields: record.unavailableFields,
    publicFields: {
      ...(typeof record.returns?.[1]?.annualized === "number"
        ? { annualizedReturn1y: record.returns[1].annualized }
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
      ...(record.launchDate ? { launchDate: record.launchDate } : {}),
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
