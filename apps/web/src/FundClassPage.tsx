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
    latestFer?: number;
    managementFee: number;
    oci1yHkd?: number;
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
};

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
  return (
    <SiteChrome
      eyebrow={fundClass.schemeName}
      title={fundClass.constituentFundName}
      subtitle={joinFundParts(
        fundClassLabel(fundClass.fundClassName),
        `${fundClass.fundType}／${fundClass.fundCategory}`,
      )}
    >
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
        </dl>
        <p className="kw-muted" role="note">
          年率化回報是每年平均變幅，適合與其他基金比較；累積回報是整段期間的總變幅，反映同一筆本金實際增減。兩者均為積金局公布數值，網站不會自行換算。
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
            <div>
              <dt>當前管理費</dt>
              <dd>{formatNumber(fundClass.managementFee, 2, "%")}</dd>
            </div>
            <div>
              <dt>其他費用（OCI）</dt>
              <dd>
                {typeof fundClass.oci1yHkd === "number"
                  ? `HK$${fundClass.oci1yHkd.toFixed(2)}`
                  : unavailable}
              </dd>
            </div>
          </dl>
          <p>配置及持倉資料的截至日期可能不同，使用時請留意可比性限制。</p>
          {(fundClass.riskClass === undefined ||
            fundClass.latestFer === undefined ||
            fundClass.oci1yHkd === undefined) && (
            <p role="note">
              顯示「官方未提供」代表積金局資料按適用披露規則沒有該欄位；常見原因包括基金運作年期不足或保證／資本保存安排。網站不會以估算值補足。
            </p>
          )}
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
