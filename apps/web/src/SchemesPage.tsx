import { useEffect, useState } from "react";
import { SiteChrome } from "./SiteChrome";

type Scheme = {
  schemeName: string;
  trusteeName: string;
  fundClassCount: number;
  fundTypes: string[];
  riskClassDistribution: Record<string, number>;
  fundClassIds: string[];
};

export function SchemesPage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [schemes, setSchemes] = useState<Scheme[] | null>(null);
  useEffect(() => {
    fetch(`${apiBaseUrl}/schemes`)
      .then((response) => response.json() as Promise<Scheme[]>)
      .then(setSchemes)
      .catch(() => setSchemes([]));
  }, [apiBaseUrl]);

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
        {schemes === null && <p className="kw-status">正在載入計劃資料…</p>}
        {schemes !== null && schemes.length === 0 && (
          <p className="kw-status kw-status--warning">
            目前沒有已發布的計劃資料。
          </p>
        )}
        <div className="kw-grid scheme-list">
          {schemes?.map((scheme) => (
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
                  <dt>風險級別分布</dt>
                  <dd>
                    {Object.entries(scheme.riskClassDistribution)
                      .map(([risk, count]) => `級別 ${risk}: ${count}`)
                      .join("、")}
                  </dd>
                </div>
              </dl>
              <ul>
                {scheme.fundClassIds.map((id) => (
                  <li key={id}>
                    <a href={`/fund-classes/${encodeURIComponent(id)}`}>{id}</a>
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
