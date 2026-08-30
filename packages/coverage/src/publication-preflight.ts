type PublicFields = {
  annualizedReturn1y?: number;
  annualizedReturn5y?: number;
  annualizedReturn10y?: number;
  cumulativeReturn1y?: number;
  cumulativeReturn5y?: number;
  cumulativeReturn10y?: number;
  riskClass?: number;
  // 官方的基金風險指標（年度化標準差）。成立不足三年的基金官方寫 `n.a.`，
  // 會走 `unavailableFields`，所以不列入 `requiredFields`。
  fundRiskIndicator?: number;
  latestFer?: number;
  managementFee?: number;
  oci1yHkd?: number;
  trusteeCustodianFee?: number;
  empfPlatformFee?: number;
  memberServicingFee?: number;
  investmentManagementFee?: number;
  guaranteeCharge?: number;
  joiningFee?: number;
  annualFee?: number;
  contributionCharge?: number;
  bidSpread?: number;
  offerSpread?: number;
  withdrawalCharge?: number;
  oci3yHkd?: number;
  oci5yHkd?: number;
  // 帶 `Up to` 前綴的費用欄位名稱：披露的是上限，不是實際費率。
  feeCaps?: string[];
  // 非單一費率的費用披露原文（例如按成員人數分級的年費）。
  feeDisclosures?: Record<string, string>;
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
        // 官方以文字披露的費用（例如 `1.18% p.a. - 1.8% p.a.` 這類區間）是已知資料，
        // 只是不能化成單一數字，照樣可以發布。
        typeof record.publicFields?.feeDisclosures?.[field] !== "string" &&
        !record.unavailableFields?.includes(field),
    );
    if (!record.sourceUrl) missing.push("sourceUrl" as never);
    if (!record.dataAsOf) missing.push("dataAsOf" as never);
    if (!record.current || record.status !== "verified") missing.push("verifiedCurrent" as never);
    return missing.length > 0 ? [{ fundClassId: record.fundClassId, missing }] : [];
  });
  return { ready: issues.length === 0, accepted: records.length - issues.length, blocked: issues.length, issues };
}
