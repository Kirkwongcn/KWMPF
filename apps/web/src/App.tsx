import { FormEvent, useEffect, useState } from "react";
import { SiteChrome } from "./SiteChrome";

type SearchResult = {
  id: string;
  fundClassName: string;
  constituentFundName: string;
  schemeName: string;
  trusteeName: string;
};

type Health = {
  version: string;
  status: "ok" | "error";
};

type Summary = {
  snapshotId: string | null;
  fundClassCount: number;
  schemeCount: number;
  trusteeCount: number;
  dataAsOf: { earliest: string; latest: string } | null;
};

export function App({ apiUrl }: { apiUrl: string }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    fetch(apiUrl)
      .then((response) => {
        if (!response.ok) throw new Error("Health check failed");
        return response.json() as Promise<Health>;
      })
      .then(setHealth)
      .catch(() => setHealth({ version: "未能取得", status: "error" }));
  }, [apiUrl]);

  useEffect(() => {
    fetch(`${new URL(apiUrl).origin}/summary`)
      .then((response) => {
        if (!response.ok) throw new Error("Summary unavailable");
        return response.json() as Promise<Summary>;
      })
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [apiUrl]);

  function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return setResults([]);
    fetch(`${new URL(apiUrl).origin}/search?q=${encodeURIComponent(query)}`)
      .then((response) => response.json() as Promise<SearchResult[]>)
      .then(setResults)
      .catch(() => setResults([]));
  }

  const apiStatus =
    health?.status === "ok"
      ? "正常"
      : health?.status === "error"
        ? "無法連線"
        : "檢查中";

  return (
    <SiteChrome
      isHome
      eyebrow="香港強積金研究"
      title="用可追溯資料，讀懂強積金選擇"
      subtitle="基金類別、比較組別、官方來源與截至日期，放在同一個清晰框架內。"
    >
      <section className="kw-section" aria-labelledby="search-title">
        <h2 className="kw-section__heading" id="search-title">
          搜尋及查閱
        </h2>
        <div className="kw-card kw-card--accent">
          <form className="search-form" onSubmit={search}>
            <label htmlFor="fund-search">搜尋基金、計劃或受託人</label>
            <div>
              <input
                className="kw-control"
                id="fund-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="例如：Principal、BCT"
              />
              <button className="kw-button" type="submit">
                搜尋
              </button>
            </div>
          </form>
          {results.length > 0 && (
            <ul aria-label="搜尋結果" className="search-results">
              {results.map((result) => (
                <li key={result.id}>
                  <a href={`/fund-classes/${encodeURIComponent(result.id)}`}>
                    {result.constituentFundName} · {result.fundClassName}
                  </a>
                  <span>
                    {result.schemeName}／{result.trusteeName}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="kw-home-actions">
            <a className="kw-button" href="/funds">
              按條件瀏覽基金
            </a>{" "}
            <a className="kw-button" href="/rankings">
              查看基金排名
            </a>{" "}
            <a className="kw-button" href="/schemes">
              比較強積金計劃
            </a>
          </p>
        </div>
      </section>

      <section className="kw-section" aria-labelledby="coverage-title">
        <h2 className="kw-section__heading" id="coverage-title">
          目前涵蓋範圍
        </h2>
        {summary?.snapshotId ? (
          <>
            <dl className="status-list">
              <div>
                <dt>已核實基金類別</dt>
                <dd>{summary.fundClassCount}</dd>
              </div>
              <div>
                <dt>強積金計劃</dt>
                <dd>{summary.schemeCount}</dd>
              </div>
              <div>
                <dt>受託人</dt>
                <dd>{summary.trusteeCount}</dd>
              </div>
              <div>
                <dt>資料截至</dt>
                <dd>
                  {summary.dataAsOf
                    ? summary.dataAsOf.earliest === summary.dataAsOf.latest
                      ? summary.dataAsOf.latest
                      : `${summary.dataAsOf.earliest} 至 ${summary.dataAsOf.latest}`
                    : "官方未提供"}
                </dd>
              </div>
            </dl>
            <p className="kw-muted">
              以上數字全部來自目前公開快照 <code>{summary.snapshotId}</code>
              ，並非預估值。不同基金的官方截至日期可能不同，比較時請留意。
            </p>
          </>
        ) : (
          <p className="kw-status kw-status--warning">尚未有已發布快照</p>
        )}
      </section>

      <section className="kw-section" aria-labelledby="principles-title">
        <h2 className="kw-section__heading" id="principles-title">
          我們怎樣處理資料
        </h2>
        <div className="kw-grid">
          <article className="kw-card">
            <h3>只用官方來源</h3>
            <p className="kw-muted">
              數值來自積金局強積金基金平台及受託人官方基金便覽。每項公開數值都保留來源連結、官方截至日期及擷取版本，可逐項追查。
            </p>
          </article>
          <article className="kw-card">
            <h3>同類別才比較</h3>
            <p className="kw-muted">
              排名只在相同基金種類及資產配置組別內進行，不會把股票基金與保守基金放在同一個名次表內。
            </p>
          </article>
          <article className="kw-card">
            <h3>缺失不補值</h3>
            <p className="kw-muted">
              官方按披露規則沒有提供的欄位會標示「官方未提供」，網站不會以估算、年化或第三方數值填補。
            </p>
          </article>
        </div>
        <p className="disclaimer">
          本網站不提供個人化建議、不設推薦總分，亦不會替你決定基金選擇。
        </p>
      </section>

      <section className="kw-section" aria-labelledby="service-title">
        <h2 className="kw-section__heading" id="service-title">
          服務狀態
        </h2>
        <dl className="status-list">
          <div>
            <dt>版本</dt>
            <dd>{health?.version ?? "檢查中"}</dd>
          </div>
          <div>
            <dt>服務狀態</dt>
            <dd>API：{apiStatus}</dd>
          </div>
        </dl>
      </section>
    </SiteChrome>
  );
}
