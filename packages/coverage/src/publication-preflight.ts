type PublicFields = {
  annualizedReturn1y?: number;
  annualizedReturn5y?: number;
  annualizedReturn10y?: number;
  cumulativeReturn1y?: number;
  cumulativeReturn5y?: number;
  cumulativeReturn10y?: number;
  riskClass?: number;
  latestFer?: number;
  managementFee?: number;
  oci1yHkd?: number;
  fundSizeHkdMillion?: number;
  fundSizeAsOf?: string;
  returnsAsOf?: string;
  launchDate?: string;
  calendarYearReturns?: Record<string, number>;
  sinceLaunchReturnAnnualized?: number;
  sinceLaunchReturnCumulative?: number;
};

export type PublicationInput = {
  fundClassId: string;
  identity: { trusteeName: string; schemeName: string; constituentFundName: string; fundClassName: string };
  current: boolean;
  status: string;
  dataAsOf?: string;
  sourceUrl?: string;
  unavailableFields?: string[];
  publicFields?: PublicFields;
};

const requiredFields = ["annualizedReturn1y", "riskClass", "latestFer", "managementFee", "oci1yHkd"] as const;

export function buildPublicationPreflight(records: PublicationInput[]) {
  const issues = records.flatMap((record) => {
    const missing = requiredFields.filter(
      (field) =>
        typeof record.publicFields?.[field] !== "number" &&
        !record.unavailableFields?.includes(field),
    );
    if (!record.sourceUrl) missing.push("sourceUrl" as never);
    if (!record.dataAsOf) missing.push("dataAsOf" as never);
    if (!record.current || record.status !== "verified") missing.push("verifiedCurrent" as never);
    return missing.length > 0 ? [{ fundClassId: record.fundClassId, missing }] : [];
  });
  return { ready: issues.length === 0, accepted: records.length - issues.length, blocked: issues.length, issues };
}
