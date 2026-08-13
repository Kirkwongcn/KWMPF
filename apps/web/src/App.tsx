import { FormEvent, useEffect, useState } from "react";

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

export function App({ apiUrl }: { apiUrl: string }) {
  const [health, setHealth] = useState<Health | null>(null);
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
    <>
      <header className="kw-header">
        <div className="kw-shell kw-header__inner">
          <a className="kw-brand" href="/" aria-label="KWMPF 首頁">
            <span className="kw-brand__mark">kW</span>
            <span>
              <small>Kirk Wong Research</small>
              <strong>KWMPF</strong>
            </span>
          </a>
          <nav className="kw-nav" aria-label="主要導覽">
            <a href="/rankings">基金排名</a>
            <a href="/schemes">計劃比較</a>
          </nav>
        </div>
      </header>
      <section className="kw-hero" aria-labelledby="page-title">
        <div className="kw-hero__inner">
          <p className="kw-eyebrow">香港強積金研究</p>
          <h1 id="page-title">用可追溯資料，讀懂強積金選擇</h1>
          <p className="kw-hero__subtitle">
            基金類別、比較組別、官方來源與截至日期，放在同一個清晰框架內。
          </p>
        </div>
      </section>
      <main className="kw-main">
        <section className="kw-section" aria-labelledby="search-title">
          <h2 className="kw-section__heading" id="search-title">
            搜尋及查閱
          </h2>
          <div className="kw-grid">
            <div className="kw-card kw-card--accent">
              <p className="kw-eyebrow">Research desk</p>
              <h2>搜尋基金、計劃或受託人</h2>
              <p className="kw-muted">
                我們正在建立一個可追溯資料來源的強積金比較工具。網站只提供資料比較及投資教育，不構成投資建議。
              </p>
              <dl className="kw-grid">
                <div>
                  <dt>版本</dt>
                  <dd>{health?.version ?? "檢查中"}</dd>
                </div>
                <div>
                  <dt>服務狀態</dt>
                  <dd>API：{apiStatus}</dd>
                </div>
              </dl>
              <form className="kw-grid" onSubmit={search}>
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
              <p>
                <a className="kw-button" href="/rankings">
                  查看基金排名
                </a>{" "}
                <a className="kw-button" href="/schemes">
                  比較強積金計劃
                </a>
              </p>
              {results.length > 0 && (
                <ul aria-label="搜尋結果" className="kw-grid">
                  {results.map((result) => (
                    <li className="kw-card" key={result.id}>
                      <a
                        href={`/fund-classes/${encodeURIComponent(result.id)}`}
                      >
                        {result.constituentFundName} · {result.fundClassName}
                      </a>
                      <span>
                        {result.schemeName}／{result.trusteeName}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
