import { useEffect, useState } from "react";
import { SiteChrome } from "./SiteChrome";
import { fundClassLabel, joinFundParts } from "./fundClassLabel";

type PublishedFundClass = {
  snapshotId: string;
  comparisonGroup?: string;
  classification?: {
    provider: string;
    dataset: string;
    capturedAt: string;
  } | null;
  fundClass: {
    lipperCategory?: string;
    trusteeName: string;
    schemeName: string;
    constituentFundName: string;
    fundClassName: string;
    fundType: string;
    fundCategory: string;
    annualizedReturn1y: number;
    annualizedReturn5y?: number;
    annualizedReturn10y?: number;
    cumulativeReturn1y?: number;
    cumulativeReturn5y?: number;
    cumulativeReturn10y?: number;
    riskClass?: number;
    fundRiskIndicator?: number;
    latestFer?: number;
    managementFee?: number;
    oci1yHkd?: number;
    oci3yHkd?: number;
    oci5yHkd?: number;
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
    feeCaps?: string[];
    feeDisclosures?: Record<string, string>;
    fundSizeHkdMillion?: number;
    fundSizeAsOf?: string;
    returnsAsOf?: string;
    launchDate?: string;
    calendarYearReturns?: Record<string, number>;
    sinceLaunchReturnAnnualized?: number;
    sinceLaunchReturnCumulative?: number;
  };
  provenance: {
    sourceUrl: string;
    dataAsOf: string;
    retrievedAt: string;
    verificationStatus: "verified";
  };
  freshness?: {
    status: "verified" | "stale";
    dataAsOf: string;
    graceDays: number;
    ageDays: number | null;
  };
  fundSizeFreshness?: {
    status: "verified" | "stale";
    dataAsOf: string;
    graceDays: number;
    ageDays: number | null;
  };
};

type FeeField =
  | "managementFee"
  | "trusteeCustodianFee"
  | "empfPlatformFee"
  | "memberServicingFee"
  | "investmentManagementFee"
  | "guaranteeCharge"
  | "joiningFee"
  | "annualFee"
  | "contributionCharge"
  | "bidSpread"
  | "offerSpread"
  | "withdrawalCharge"
  | "oci1yHkd"
  | "oci3yHkd"
  | "oci5yHkd";

const recurringFeeRows: Array<[string, FeeField]> = [
  ["管理費", "managementFee"],
  ["受託人／保管人費", "trusteeCustodianFee"],
  ["積金易平台費", "empfPlatformFee"],
  ["成員服務費", "memberServicingFee"],
  ["投資管理費", "investmentManagementFee"],
  ["保證費", "guaranteeCharge"],
];

const oneOffChargeRows: Array<[string, FeeField]> = [
  ["加入費", "joiningFee"],
  ["年費", "annualFee"],
  ["供款收費", "contributionCharge"],
  ["買入差價", "bidSpread"],
  ["賣出差價", "offerSpread"],
  ["提取收費", "withdrawalCharge"],
];

const ociRows: Array<[string, FeeField]> = [
  ["一年", "oci1yHkd"],
  ["三年", "oci3yHkd"],
  ["五年", "oci5yHkd"],
];

const feeLabels: Record<string, string> = Object.fromEntries(
  [...recurringFeeRows, ...oneOffChargeRows, ...ociRows].map(
    ([label, field]) => [field, label],
  ),
);

export function FundClassPage({
  apiBaseUrl,
  fundClassId,
}: {
  apiBaseUrl: string;
  fundClassId: string;
}) {
  const unavailable = "官方未提供";
  const formatNumber = (
    value: number | undefined,
    digits: number,
    suffix = "",
  ) =>
    typeof value === "number"
      ? `${value.toFixed(digits)}${suffix}`
      : unavailable;
  const [publication, setPublication] = useState<PublishedFundClass | null>(
    null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`${apiBaseUrl}/fund-classes/${encodeURIComponent(fundClassId)}`)
      .then((response) => {
        if (!response.ok) throw new Error("Fund class unavailable");
        return response.json() as Promise<PublishedFundClass>;
      })
      .then(setPublication)
      .catch(() => setFailed(true));
  }, [apiBaseUrl, fundClassId]);

  if (failed)
    return (
      <SiteChrome eyebrow="基金詳情" title="未能取得基金資料">
        <section className="kw-section">
          <p className="kw-status kw-status--negative">未能取得基金資料。</p>
        </section>
      </SiteChrome>
    );
  if (!publication)
    return (
      <SiteChrome eyebrow="基金詳情" title="載入中">
        <section className="kw-section">
          <p className="kw-status">正在載入基金資料…</p>
        </section>
      </SiteChrome>
    );

  const { fundClass, provenance, snapshotId, freshness } = publication;
  const comparisonGroup = publication.comparisonGroup ?? fundClass.fundCategory;
  const fundSizeFreshness = publication.fundSizeFreshness;
  const calendarYears = Object.keys(fundClass.calendarYearReturns ?? {}).sort(
    (a, b) => Number(b) - Number(a),
  );
  const feeCaps = fundClass.feeCaps ?? [];
  const feeDisclosureRows = Object.entries(fundClass.feeDisclosures ?? {});
  const capSuffix = (field: FeeField) =>
    feeCaps.includes(field) ? "（上限）" : "";
  // 官方費率的小數位數由披露本身決定（例如 1.205%、0.575%），
  // 固定成兩位小數會把披露值改寫成另一個數字，所以照原值顯示。
  const feeRate = (field: FeeField) => {
    const value = fundClass[field];
    if (typeof value !== "number")
      return fundClass.feeDisclosures?.[field] ? "見下方文字披露" : unavailable;
    return `${value}%${capSuffix(field)}`;
  };
  const feeAmount = (field: FeeField) => {
    const value = fundClass[field];
    if (typeof value !== "number")
      return fundClass.feeDisclosures?.[field] ? "見下方文字披露" : unavailable;
    return `HK$${value.toLocaleString("en-US")}${capSuffix(field)}`;
  };
  const datesDiffer = Boolean(
    fundClass.fundSizeAsOf &&
    fundClass.returnsAsOf &&
    fundClass.fundSizeAsOf !== fundClass.returnsAsOf,
  );
  return (
    <SiteChrome
      eyebrow={fundClass.schemeName}
      title={fundClass.constituentFundName}
      subtitle={joinFundParts(
        fundClassLabel(fundClass.fundClassName),
        `${fundClass.fundType}／${fundClass.fundCategory}`,
      )}
    >
      <section className="kw-section" aria-labelledby="fund-profile-title">
        <h2 className="kw-section__heading" id="fund-profile-title">
          基金概況
        </h2>
        <div className="kw-card">
          <dl className="status-list">
            <div>
              <dt>基金規模</dt>
              <dd>
                {typeof fundClass.fundSizeHkdMillion === "number"
                  ? `HK$${fundClass.fundSizeHkdMillion.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} 百萬`
                  : unavailable}
                {fundClass.fundSizeAsOf
                  ? `（截至 ${fundClass.fundSizeAsOf}）`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>成立日期</dt>
              <dd>{fundClass.launchDate ?? unavailable}</dd>
            </div>
          </dl>
          {fundSizeFreshness?.status === "stale" && (
            <p className="kw-status kw-status--warning">
              基金規模已超出官方披露寬限期（{fundSizeFreshness.graceDays}{" "}
              日），截至日期仍為 {fundSizeFreshness.dataAsOf}。
            </p>
          )}
          {datesDiffer && (
            <p className="kw-muted" role="note">
              基金規模截至 {fundClass.fundSizeAsOf}，回報截至{" "}
              {fundClass.returnsAsOf}，兩者期別不同，並非完全可比。
            </p>
          )}
          <p className="kw-muted">
            成立日期是靜態事實，不設過期；基金規模按月披露，沿用月度寬限期。
          </p>
        </div>
      </section>
      <section className="kw-section" aria-labelledby="fund-figures-title">
        <h2 className="kw-section__heading" id="fund-figures-title">
          主要數據
        </h2>
        <div className="kw-table-scroll">
          <table className="kw-table" aria-label="回報">
            <thead>
              <tr>
                <th scope="col">期間</th>
                <th scope="col">年率化回報</th>
                <th scope="col">累積回報</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  [
                    "一年",
                    fundClass.annualizedReturn1y,
                    fundClass.cumulativeReturn1y,
                  ],
                  [
                    "五年",
                    fundClass.annualizedReturn5y,
                    fundClass.cumulativeReturn5y,
                  ],
                  [
                    "十年",
                    fundClass.annualizedReturn10y,
                    fundClass.cumulativeReturn10y,
                  ],
                  [
                    "成立至今",
                    fundClass.sinceLaunchReturnAnnualized,
                    fundClass.sinceLaunchReturnCumulative,
                  ],
                ] as const
              ).map(([horizon, annualized, cumulative]) => (
                <tr key={horizon}>
                  <th scope="row">{horizon}</th>
                  <td className="kw-return">
                    {formatNumber(annualized, 2, "%")}
                  </td>
                  <td className="kw-return">
                    {formatNumber(cumulative, 2, "%")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="status-list">
          <div>
            <dt>風險級別</dt>
            <dd>{fundClass.riskClass ?? unavailable}</dd>
          </div>
          <div>
            <dt>基金風險指標</dt>
            <dd>
              {typeof fundClass.fundRiskIndicator === "number"
                ? formatNumber(fundClass.fundRiskIndicator, 2, "%")
                : unavailable}
            </dd>
          </div>
        </dl>
        <p className="kw-muted" role="note">
          基金風險指標是過去三年的年度化標準差，數字越高代表過往價格波動越大；風險級別是積金局按該指標劃分的
          1 至 7 級。成立不足三年的基金官方不會提供指標。
        </p>
        <p className="kw-muted" role="note">
          年率化回報是每年平均變幅，適合與其他基金比較；累積回報是整段期間的總變幅，反映同一筆本金實際增減。兩者均為積金局公布數值，網站不會自行換算。
        </p>
      </section>
      <section className="kw-section" aria-labelledby="fund-calendar-title">
        <h2 className="kw-section__heading" id="fund-calendar-title">
          年度回報
        </h2>
        {calendarYears.length === 0 ? (
          <p className="kw-status">官方未提供年度回報。</p>
        ) : (
          <div className="kw-table-scroll">
            <table className="kw-table" aria-label="年度回報">
              <thead>
                <tr>
                  <th scope="col">年度</th>
                  <th scope="col">曆年回報</th>
                </tr>
              </thead>
              <tbody>
                {calendarYears.map((year) => (
                  <tr key={year}>
                    <th scope="row">{year}</th>
                    <td className="kw-return">
                      {formatNumber(
                        fundClass.calendarYearReturns?.[year],
                        2,
                        "%",
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="kw-muted" role="note">
          年度回報是該個曆年的累積回報，不是年率化回報，不可與上表的年率化數字直接比較。官方沒有公布的年度不會顯示。
        </p>
      </section>
      <section className="kw-section" aria-labelledby="fund-fees-title">
        <h2 className="kw-section__heading" id="fund-fees-title">
          費用及資料限制
        </h2>
        <div className="kw-card provenance">
          <dl className="status-list">
            <div>
              <dt>基金開支比率（歷史財政期）</dt>
              <dd>{formatNumber(fundClass.latestFer, 5, "%")}</dd>
            </div>
          </dl>
          <div className="kw-table-scroll">
            <table className="kw-table" aria-label="經常性費用">
              <caption>經常性費用（每年）</caption>
              <thead>
                <tr>
                  <th scope="col">項目</th>
                  <th scope="col">披露費率</th>
                </tr>
              </thead>
              <tbody>
                {recurringFeeRows.map(([label, field]) => (
                  <tr key={field}>
                    <th scope="row">{label}</th>
                    <td className="kw-return">{feeRate(field)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="kw-table-scroll">
            <table className="kw-table" aria-label="一次性及交易收費">
              <caption>一次性及交易收費</caption>
              <thead>
                <tr>
                  <th scope="col">項目</th>
                  <th scope="col">披露收費</th>
                </tr>
              </thead>
              <tbody>
                {oneOffChargeRows.map(([label, field]) => (
                  <tr key={field}>
                    <th scope="row">{label}</th>
                    <td className="kw-return">{feeRate(field)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="kw-table-scroll">
            <table className="kw-table" aria-label="持續成本說明">
              <caption>持續成本說明（OCI）</caption>
              <thead>
                <tr>
                  <th scope="col">期間</th>
                  <th scope="col">每 HK$1,000 投資的成本</th>
                </tr>
              </thead>
              <tbody>
                {ociRows.map(([label, field]) => (
                  <tr key={field}>
                    <th scope="row">{label}</th>
                    <td className="kw-return">{feeAmount(field)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {feeCaps.length > 0 && (
            <p className="kw-muted" role="note">
              標示「上限」的項目，官方原文寫的是 <code>Up to</code>
              ，即披露的是收費上限而非實際費率；實際扣費可能較低。
            </p>
          )}
          {feeDisclosureRows.length > 0 && (
            <div>
              <p className="kw-muted">
                以下項目不是單一費率，官方以文字披露，原文照錄：
              </p>
              <dl className="status-list fee-disclosures">
                {feeDisclosureRows.map(([field, text]) => (
                  <div key={field}>
                    <dt>{feeLabels[field] ?? field}</dt>
                    <dd>{text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <p>配置及持倉資料的截至日期可能不同，使用時請留意可比性限制。</p>
          <p role="note">
            顯示「官方未提供」代表積金局資料按適用披露規則沒有該欄位；常見原因包括基金運作年期不足或保證／資本保存安排。網站不會以估算值補足。
          </p>
        </div>
      </section>
      <section className="kw-section" aria-labelledby="fund-source-title">
        <h2 className="kw-section__heading" id="fund-source-title">
          資料來源及驗證
        </h2>
        <div className="kw-card provenance">
          <p>資料截至：{provenance.dataAsOf}</p>
          <p>擷取版本：{provenance.retrievedAt}</p>
          <p>驗證狀態：已驗證</p>
          {freshness && (
            <>
              <p
                className={
                  freshness.status === "stale"
                    ? "kw-status kw-status--warning"
                    : "kw-status kw-status--positive"
                }
              >
                {freshness.status === "stale" ? "資料過期" : "資料現行"}
              </p>
              <p>
                {freshness.status === "stale"
                  ? `這項資料已超出官方披露寬限期（${freshness.graceDays} 日），截至日期仍為 ${freshness.dataAsOf}。數值繼續顯示以供參考，但不會參與排名。`
                  : `資料在官方披露寬限期（${freshness.graceDays} 日）之內。`}
              </p>
            </>
          )}
          <p>
            公開快照：<code>{snapshotId}</code>
          </p>
          <a href={provenance.sourceUrl} rel="noreferrer" target="_blank">
            積金局原始資料
          </a>
          <p className="disclaimer">
            資料比較不代表投資建議；過往表現不代表未來結果。請查閱受託人最新文件。
          </p>
        </div>
      </section>
      <section className="kw-section" aria-labelledby="fund-peers-title">
        <h2 className="kw-section__heading" id="fund-peers-title">
          同組比較
        </h2>
        <div className="kw-card">
          <p>
            這隻基金的比較組別是 <strong>{comparisonGroup}</strong>
            。排名只在同一組別內進行，不會與其他基金種類混合。
          </p>
          <p className="kw-muted">
            {publication.classification
              ? `分類來自 ${publication.classification.provider}「${publication.classification.dataset}」（期別 ${publication.classification.capturedAt}），屬非官方來源。官方平台基金種類為 ${fundClass.fundType}／${fundClass.fundCategory}。`
              : `官方平台基金種類為 ${fundClass.fundType}／${fundClass.fundCategory}。`}
          </p>
          <p className="kw-home-actions">
            <a
              className="kw-button"
              href={`/rankings?period=1&group=${encodeURIComponent(comparisonGroup)}`}
            >
              查看同組基金排名
            </a>
          </p>
        </div>
      </section>
    </SiteChrome>
  );
}
