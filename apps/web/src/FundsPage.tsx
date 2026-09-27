import { useEffect, useState } from "react";
import { SiteChrome } from "./SiteChrome";
import { fundClassLabel, joinFundParts } from "./fundClassLabel";

type FundSummary = {
  id: string;
  fundClassName: string;
  constituentFundName: string;
  schemeName: string;
  trusteeName: string;
  fundType: string;
  fundCategory?: string;
  comparisonGroup?: string;
  riskClass?: number;
  annualizedReturn1y?: number;
  managementFee?: number;
  latestFer?: number;
  feeCaps?: string[];
  dataAsOf?: string;
  freshness?: {
    status: "verified" | "stale";
    dataAsOf: string;
    graceDays: number;
    ageDays: number | null;
  };
};

type Classification = {
  provider: string;
  dataset: string;
  capturedAt: string;
};

type PublishedFilters = {
  snapshotId: string | null;
  categories?: string[];
  classification?: Classification | null;
  fundTypes: string[];
  trustees: string[];
  riskClasses: number[];
};

const unavailable = "官方未提供";

export function classificationNote(classification: Classification | null) {
  return classification
    ? `同類比較分類採用 ${classification.provider}「${classification.dataset}」（期別 ${classification.capturedAt}），屬非官方來源，與官方平台的基金種類分開列示。`
    : "同類比較分類屬非官方來源，與官方平台的基金種類分開列示。";
}

function percent(value?: number, capped = false) {
  if (typeof value !== "number") return unavailable;
  return `${value}%${capped ? "（上限）" : ""}`;
}

export function FundsPage({
  apiBaseUrl,
  initialCategory = "all",
  initialFundType = "all",
  initialTrustee = "all",
  initialRiskClass = "all",
  initialQuery = "",
}: {
  apiBaseUrl: string;
  initialCategory?: string;
  initialFundType?: string;
  initialTrustee?: string;
  initialRiskClass?: string;
  initialQuery?: string;
}) {
  const [filters, setFilters] = useState<PublishedFilters | null>(null);
  const [category, setCategory] = useState(initialCategory);
  const [fundType, setFundType] = useState(initialFundType);
  const [trustee, setTrustee] = useState(initialTrustee);
  const [riskClass, setRiskClass] = useState(initialRiskClass);
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [results, setResults] = useState<FundSummary[] | null>(null);
  const [totalMatches, setTotalMatches] = useState(0);
  const [failed, setFailed] = useState(false);

  function pushFilters(
    overrides: Partial<{
      category: string;
      fundType: string;
      trustee: string;
      riskClass: string;
      query: string;
    }> = {},
  ) {
    const next = {
      category,
      fundType,
      trustee,
      riskClass,
      query: submittedQuery,
      ...overrides,
    };
    const params = new URLSearchParams();
    if (next.query.trim()) params.set("q", next.query.trim());
    if (next.category !== "all") params.set("category", next.category);
    if (next.fundType !== "all") params.set("fundType", next.fundType);
    if (next.trustee !== "all") params.set("trustee", next.trustee);
    if (next.riskClass !== "all") params.set("riskClass", next.riskClass);
    const search = params.toString();
    window.history.pushState(
      {},
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}`,
    );
  }

  useEffect(() => {
    fetch(`${apiBaseUrl}/filters`)
      .then((response) => {
        if (!response.ok) throw new Error("Filters unavailable");
        return response.json() as Promise<PublishedFilters>;
      })
      .then(setFilters)
      .catch(() =>
        setFilters({
          snapshotId: null,
          categories: [],
          classification: null,
          fundTypes: [],
          trustees: [],
          riskClasses: [],
        }),
      );
  }, [apiBaseUrl]);

  useEffect(() => {
    function restoreFilters() {
      const params = new URLSearchParams(window.location.search);
      const nextQuery = params.get("q") ?? "";
      setCategory(params.get("category") ?? "all");
      setFundType(params.get("fundType") ?? "all");
      setTrustee(params.get("trustee") ?? "all");
      setRiskClass(params.get("riskClass") ?? "all");
      setQuery(nextQuery);
      setSubmittedQuery(nextQuery);
    }
    window.addEventListener("popstate", restoreFilters);
    return () => window.removeEventListener("popstate", restoreFilters);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (submittedQuery.trim()) params.set("q", submittedQuery.trim());
    if (category !== "all") params.set("category", category);
    if (fundType !== "all") params.set("fundType", fundType);
    if (trustee !== "all") params.set("trustee", trustee);
    if (riskClass !== "all") params.set("riskClass", riskClass);

    setFailed(false);
    fetch(`${apiBaseUrl}/search?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Search unavailable");
        const total = Number(response.headers.get("X-Total-Matches"));
        const payload = (await response.json()) as FundSummary[];
        setResults(payload);
        setTotalMatches(Number.isFinite(total) ? total : payload.length);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setResults(null);
        setTotalMatches(0);
        setFailed(true);
      });
    return () => controller.abort();
  }, [apiBaseUrl, submittedQuery, category, fundType, trustee, riskClass]);

  return (
    <SiteChrome
      eyebrow="基金瀏覽"
      title="按條件瀏覽基金"
      subtitle="按基金種類、受託人及官方風險級別篩選基金；數值均附官方截至日期。"
      current="funds"
    >
      <section className="kw-section" aria-labelledby="filters-title">
        <h2 className="kw-section__heading" id="filters-title">
          篩選條件
        </h2>
        <div className="kw-card kw-card--accent">
          <form
            className="kw-filters"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmittedQuery(query);
              pushFilters({ query });
            }}
          >
            <p className="kw-filter">
              <label htmlFor="filter-category">同類比較分類</label>
              <select
                className="kw-control"
                id="filter-category"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  pushFilters({ category: event.target.value });
                }}
              >
                <option value="all">全部同類比較分類</option>
                {filters?.categories?.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </p>
            <p className="kw-filter">
              <label htmlFor="filter-fund-type">官方基金種類</label>
              <select
                className="kw-control"
                id="filter-fund-type"
                value={fundType}
                onChange={(event) => {
                  setFundType(event.target.value);
                  pushFilters({ fundType: event.target.value });
                }}
              >
                <option value="all">全部基金種類</option>
                {filters?.fundTypes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </p>
            <p className="kw-filter">
              <label htmlFor="filter-trustee">受託人</label>
              <select
                className="kw-control"
                id="filter-trustee"
                value={trustee}
                onChange={(event) => {
                  setTrustee(event.target.value);
                  pushFilters({ trustee: event.target.value });
                }}
              >
                <option value="all">全部受託人</option>
                {filters?.trustees.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </p>
            <p className="kw-filter">
              <label htmlFor="filter-risk-class">風險級別</label>
              <select
                className="kw-control"
                id="filter-risk-class"
                value={riskClass}
                onChange={(event) => {
                  setRiskClass(event.target.value);
                  pushFilters({ riskClass: event.target.value });
                }}
              >
                <option value="all">全部風險級別</option>
                {filters?.riskClasses.map((value) => (
                  <option key={value} value={String(value)}>
                    風險級別 {value}
                  </option>
                ))}
              </select>
            </p>
            <p className="kw-filter">
              <label htmlFor="filter-query">關鍵字</label>
              <span className="kw-filter__inline">
                <input
                  className="kw-control"
                  id="filter-query"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="例如：Principal、BCT"
                />
                <button className="kw-button" type="submit">
                  套用
                </button>
              </span>
            </p>
          </form>
          <p className="kw-muted" role="note">
            {classificationNote(filters?.classification ?? null)}
          </p>
        </div>
      </section>

      <section className="kw-section" aria-labelledby="results-title">
        <h2 className="kw-section__heading" id="results-title">
          瀏覽結果
        </h2>
        {failed ? (
          <p className="kw-status kw-status--warning" role="alert">
            暫時無法讀取已發布資料
          </p>
        ) : results === null ? (
          <p className="kw-status" role="status" aria-live="polite">
            正在讀取基金，並按官方一年回報排序⋯⋯
          </p>
        ) : results.length === 0 ? (
          <p
            className="kw-status kw-status--warning"
            role="status"
            aria-live="polite"
          >
            沒有符合條件的已發布基金。
          </p>
        ) : (
          <>
            <p
              className="kw-muted"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {totalMatches > results.length
                ? `共 ${totalMatches} 隻符合條件，以下顯示首 ${results.length} 隻。可加入更多篩選條件收窄範圍。`
                : `共 ${results.length} 隻已發布基金。`}
            </p>
            <p className="kw-table-hint" id="fund-table-scroll-hint">
              左右滑動可查看其餘欄位
            </p>
            <div
              className="kw-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="基金瀏覽結果"
              aria-describedby="fund-table-scroll-hint"
            >
              <table className="kw-table">
                <thead>
                  <tr>
                    <th scope="col">基金</th>
                    <th scope="col">一年回報</th>
                    <th scope="col">管理費</th>
                    <th scope="col">風險級別</th>
                    <th scope="col">計劃／受託人</th>
                    <th scope="col">比較組別</th>
                    <th scope="col">資料截至</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((fund) => (
                    <tr key={fund.id}>
                      <th scope="row">
                        <a
                          href={`/fund-classes/${encodeURIComponent(fund.id)}`}
                        >
                          {fund.constituentFundName}
                        </a>
                        {fundClassLabel(fund.fundClassName) && (
                          <span className="kw-muted">
                            {" "}
                            {fundClassLabel(fund.fundClassName)}
                          </span>
                        )}
                      </th>
                      <td className="kw-return">
                        {percent(fund.annualizedReturn1y)}
                        {fund.freshness?.status === "stale" && (
                          <span className="kw-data-state kw-data-state--stale">
                            過期
                          </span>
                        )}
                      </td>
                      <td className="kw-nowrap">
                        {percent(
                          fund.managementFee,
                          fund.feeCaps?.includes("managementFee"),
                        )}
                      </td>
                      <td>{fund.riskClass ?? unavailable}</td>
                      <td>
                        {fund.schemeName}
                        <br />
                        <span className="kw-muted">{fund.trusteeName}</span>
                      </td>
                      <td>
                        {fund.comparisonGroup ??
                          fund.fundCategory ??
                          fund.fundType}
                      </td>
                      <td className="kw-nowrap">
                        {fund.freshness?.dataAsOf ??
                          fund.dataAsOf ??
                          unavailable}
                        {fund.freshness?.status === "stale" && (
                          <span className="kw-data-state kw-data-state--stale">
                            過期
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="kw-muted">
          結果只包含目前已發布快照內、通過核實的基金。官方未提供的欄位會標示「
          {unavailable}
          」，網站不會以估算值填補。
        </p>
      </section>
    </SiteChrome>
  );
}
