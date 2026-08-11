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
    <main>
      <section aria-labelledby="page-title">
        <p className="eyebrow">香港強積金比較</p>
        <h1 id="page-title">KWMPF 正在建立中</h1>
        <p className="intro">
          我們正在建立一個可追溯資料來源的強積金比較工具。網站只提供資料比較及投資教育，不構成投資建議。
        </p>
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
        <form className="search-form" onSubmit={search}>
          <label htmlFor="fund-search">搜尋基金、計劃或受託人</label>
          <div>
            <input
              id="fund-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如：Principal、BCT"
            />
            <button type="submit">搜尋</button>
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
      </section>
    </main>
  );
}
