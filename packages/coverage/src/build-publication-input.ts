import type { SourceRecord } from "./build-coverage";
import type { PublicationInput } from "./publication-preflight";

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
      ...(typeof record.fundOverview?.latestFer === "number"
        ? { latestFer: record.fundOverview.latestFer }
        : {}),
      ...(typeof record.fundOverview?.managementFee === "number"
        ? { managementFee: record.fundOverview.managementFee }
        : {}),
      ...(typeof record.fundOverview?.oci1yHkd === "number"
        ? { oci1yHkd: record.fundOverview.oci1yHkd }
        : {}),
    },
  }));
}
