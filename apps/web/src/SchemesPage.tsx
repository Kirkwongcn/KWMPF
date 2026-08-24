import { useEffect, useMemo, useState } from "react";
import { SiteChrome } from "./SiteChrome";

type Scheme = {
  schemeName: string;
  trusteeName: string;
  fundClassCount: number;
  fundTypes: string[];
  riskClassDistribution: Record<string, number>;
  managementFee: {
    min: number;
    median: number;
    max: number;
    fundCount: number;
  } | null;
  funds: {
    id: string;
    constituentFundName: string;
    fundClassName: string;
    fundType: string;
    riskClass?: number;
  }[];
};

export function SchemesPage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [schemes, setSchemes] = useState<Scheme[] | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "fee">("name");
  useEffect(() => {
    fetch(`${apiBaseUrl}/schemes`)
      .then((response) => response.json() as Promise<Scheme[]>)
      .then(setSchemes)
      .catch(() => setSchemes([]));
  }, [apiBaseUrl]);

  const sortedSchemes = useMemo(() => {
    if (!schemes) return schemes;
    if (sortBy === "name")
      return [...schemes].sort((a, b) =>
        a.schemeName.localeCompare(b.schemeName),
      );
    return [...schemes].sort((a, b) => {
      if (!a.managementFee) return b.managementFee ? 1 : 0;
      if (!b.managementFee) return -1;
      return a.managementFee.median - b.managementFee.median;
    });
  }, [schemes, sortBy]);

  return (
    <SiteChrome
      current="schemes"
      eyebrow="香港強積金比較"
      title="強積金計劃比較"
      subtitle="只統計同一發布快照內已核實的基金類別；每項統計均可追查至基金詳情。"
    >
      <section className="kw-section" aria-labelledby="schemes-title">
        <h2 className="kw-section__heading" id="schemes-title">
          計劃概覽
        </h2>
        <div className="kw-ranking-controls">
          <label htmlFor="scheme-sort">排序</label>
          <select
            className="kw-control"
            id="scheme-sort"
            value={sortBy}
            onChange={(event) =>
              setSortBy(event.target.value as "name" | "fee")
            }
          >
            <option value="name">按計劃名稱</option>
            <option value="fee">按官方管理費中位數</option>
          </select>
          <p className="kw-muted">
            管理費不等於總開支；基金開支比率（FER）才反映完整成本，請於基金詳情查閱。
          </p>
        </div>
        {schemes === null && <p className="kw-status">正在載入計劃資料…</p>}
        {schemes !== null && schemes.length === 0 && (
          <p className="kw-status kw-status--warning">
            目前沒有已發布的計劃資料。
          </p>
        )}
        <div className="kw-grid scheme-list">
          {sortedSchemes?.map((scheme) => (
            <article key={scheme.schemeName} className="kw-card scheme-card">
              <h3>{scheme.schemeName}</h3>
              <p className="kw-muted">{scheme.trusteeName}</p>
              <dl className="status-list">
                <div>
                  <dt>基金類別數量</dt>
                  <dd>{scheme.fundClassCount}</dd>
                </div>
                <div>
                  <dt>基金種類</dt>
                  <dd>{scheme.fundTypes.join("、")}</dd>
                </div>
                <div>
                  <dt>官方管理費</dt>
                  <dd>
                    {scheme.managementFee ? (
                      <>
                        {scheme.managementFee.min.toFixed(2)}% –{" "}
                        {scheme.managementFee.max.toFixed(2)}%
                        <small className="kw-fee-note">
                          中位數 {scheme.managementFee.median.toFixed(2)}%
                        </small>
                        <small className="kw-fee-note">
                          {scheme.fundClassCount} 隻基金中{" "}
                          {scheme.managementFee.fundCount} 隻有官方管理費
                        </small>
                      </>
                    ) : (
                      "官方未提供"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>風險級別分布</dt>
                  <dd>
                    {Object.entries(scheme.riskClassDistribution)
                      .map(([risk, count]) => `級別 ${risk}: ${count}`)
                      .join("、")}
                  </dd>
                </div>
              </dl>
              <ul className="kw-fund-list">
                {scheme.funds.map((fund) => (
                  <li key={fund.id}>
                    <a href={`/fund-classes/${encodeURIComponent(fund.id)}`}>
                      <strong>{fund.constituentFundName}</strong>
                      <small>
                        {fund.fundClassName} · {fund.fundType}
                      </small>
                    </a>
                    <span className="kw-muted">
                      {typeof fund.riskClass === "number"
                        ? `風險級別 ${fund.riskClass}`
                        : "風險級別官方未提供"}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </SiteChrome>
  );
}
