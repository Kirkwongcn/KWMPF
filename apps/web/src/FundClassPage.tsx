import { useEffect, useState } from "react";

type PublishedFundClass = {
  snapshotId: string;
  fundClass: {
    trusteeName: string;
    schemeName: string;
    constituentFundName: string;
    fundClassName: string;
    fundType: string;
    fundCategory: string;
    annualizedReturn1y: number;
    riskClass: number;
    latestFer: number;
    managementFee: number;
    oci1yHkd: number;
  };
  provenance: {
    sourceUrl: string;
    dataAsOf: string;
    retrievedAt: string;
    verificationStatus: "verified";
  };
};

export function FundClassPage({
  apiBaseUrl,
  fundClassId,
}: {
  apiBaseUrl: string;
  fundClassId: string;
}) {
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
      <main>
        <p>未能取得基金資料。</p>
      </main>
    );
  if (!publication)
    return (
      <main>
        <p>正在載入基金資料…</p>
      </main>
    );

  const { fundClass, provenance, snapshotId } = publication;
  return (
    <main>
      <section aria-labelledby="fund-title">
        <p className="eyebrow">{fundClass.schemeName}</p>
        <h1 id="fund-title">{fundClass.constituentFundName}</h1>
        <p className="intro">
          {fundClass.fundClassName} · {fundClass.fundType}／
          {fundClass.fundCategory}
        </p>
        <dl className="status-list">
          <div>
            <dt>一年回報</dt>
            <dd>{fundClass.annualizedReturn1y.toFixed(2)}%</dd>
          </div>
          <div>
            <dt>風險級別</dt>
            <dd>{fundClass.riskClass}</dd>
          </div>
          <div>
            <dt>基金開支比率</dt>
            <dd>{fundClass.latestFer.toFixed(5)}%</dd>
          </div>
        </dl>
        <div className="provenance">
          <h2>費用及資料限制</h2>
          <dl className="status-list">
            <div>
              <dt>基金開支比率（歷史財政期）</dt>
              <dd>{fundClass.latestFer.toFixed(5)}%</dd>
            </div>
            <div>
              <dt>當前管理費</dt>
              <dd>{fundClass.managementFee.toFixed(2)}%</dd>
            </div>
            <div>
              <dt>其他費用（OCI）</dt>
              <dd>HK${fundClass.oci1yHkd.toFixed(2)}</dd>
            </div>
          </dl>
          <p>配置及持倉資料的截至日期可能不同，使用時請留意可比性限制。</p>
          <h2>資料來源及驗證</h2>
          <p>資料截至：{provenance.dataAsOf}</p>
          <p>擷取版本：{provenance.retrievedAt}</p>
          <p>驗證狀態：已驗證</p>
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
    </main>
  );
}
