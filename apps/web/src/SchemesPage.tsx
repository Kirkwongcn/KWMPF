import { useEffect, useState } from "react";

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
    <main>
      <section aria-labelledby="schemes-title">
        <p className="eyebrow">香港強積金比較</p>
        <h1 id="schemes-title">強積金計劃比較</h1>
        <p className="intro">
          只統計同一發布快照內已核實的基金類別；每項統計均可追查至基金詳情。
        </p>
        <div className="scheme-list">
          {schemes?.map((scheme) => (
            <article key={scheme.schemeName} className="scheme-card">
              <h2>{scheme.schemeName}</h2>
              <p>{scheme.trusteeName}</p>
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
    </main>
  );
}
