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
  riskClass?: number;
  annualizedReturn1y?: number;
  managementFee?: number;
  latestFer?: number;
  dataAsOf?: string;
};

type PublishedFilters = {
  snapshotId: string | null;
  fundTypes: string[];
  trustees: string[];
  riskClasses: number[];
};

const unavailable = "官方未提供";

function percent(value?: number) {
  return typeof value === "number" ? `${value.toFixed(2)}%` : unavailable;
}

export function FundsPage({
  apiBaseUrl,
  initialFundType = "all",
  initialTrustee = "all",
  initialRiskClass = "all",
  initialQuery = "",
}: {
  apiBaseUrl: string;
  initialFundType?: string;
  initialTrustee?: string;
  initialRiskClass?: string;
  initialQuery?: string;
}) {
  const [filters, setFilters] = useState<PublishedFilters | null>(null);
  const [fundType, setFundType] = useState(initialFundType);
  const [trustee, setTrustee] = useState(initialTrustee);
  const [riskClass, setRiskClass] = useState(initialRiskClass);
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [results, setResults] = useState<FundSummary[] | null>(null);
  const [totalMatches, setTotalMatches] = useState(0);
  const [failed, setFailed] = useState(false);

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
          fundTypes: [],
          trustees: [],
          riskClasses: [],
        }),
      );
  }, [apiBaseUrl]);

  const hasCriteria =
    fundType !== "all" ||
    trustee !== "all" ||
    riskClass !== "all" ||
    submittedQuery.trim() !== "";

  useEffect(() => {
    if (!hasCriteria) {
      setResults(null);
      setFailed(false);
      return;
    }
    const params = new URLSearchParams();
    if (submittedQuery.trim()) params.set("q", submittedQuery.trim());
    if (fundType !== "all") params.set("fundType", fundType);
    if (trustee !== "all") params.set("trustee", trustee);
    if (riskClass !== "all") params.set("riskClass", riskClass);

    setFailed(false);
    fetch(`${apiBaseUrl}/search?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Search unavailable");
        const total = Number(response.headers.get("X-Total-Matches"));
        const payload = (await response.json()) as FundSummary[];
        setResults(payload);
        setTotalMatches(Number.isFinite(total) ? total : payload.length);
      })
      .catch(() => {
        setResults(null);
        setTotalMatches(0);
        setFailed(true);
      });
  }, [apiBaseUrl, hasCriteria, submittedQuery, fundType, trustee, riskClass]);

  return (
    <SiteChrome
      eyebrow="基金瀏覽"
      title="按條件瀏覽基金"
      subtitle="用基金種類、受託人及官方風險級別篩選已發布基金，每項數值均標示官方截至日期。"
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
            }}
          >
            <p className="kw-filter">
              <label htmlFor="filter-fund-type">基金種類</label>
              <select
                className="kw-control"
                id="filter-fund-type"
                value={fundType}
                onChange={(event) => setFundType(event.target.value)}
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
                onChange={(event) => setTrustee(event.target.value)}
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
                onChange={(event) => setRiskClass(event.target.value)}
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
        </div>
      </section>

      <section className="kw-section" aria-labelledby="results-title">
        <h2 className="kw-section__heading" id="results-title">
          瀏覽結果
        </h2>
        {failed ? (
          <p className="kw-status kw-status--warning">暫時無法讀取已發布資料</p>
        ) : !hasCriteria ? (
          <p className="kw-muted">
            先選擇一項篩選條件或輸入關鍵字，才會查詢已發布快照。
          </p>
        ) : results === null ? (
          <p className="kw-muted">讀取中⋯⋯</p>
        ) : results.length === 0 ? (
          <p className="kw-status kw-status--warning">
            沒有符合條件的已發布基金。
          </p>
        ) : (
          <>
            <p className="kw-muted">
              {totalMatches > results.length
                ? `共 ${totalMatches} 隻符合條件，以下顯示首 ${results.length} 隻。可加入更多篩選條件收窄範圍。`
                : `共 ${results.length} 隻已發布基金。`}
            </p>
            <div className="kw-table-wrap">
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
                      </td>
                      <td className="kw-nowrap">
                        {percent(fund.managementFee)}
                      </td>
                      <td>{fund.riskClass ?? unavailable}</td>
                      <td>
                        {fund.schemeName}
                        <br />
                        <span className="kw-muted">{fund.trusteeName}</span>
                      </td>
                      <td>{fund.fundCategory ?? fund.fundType}</td>
                      <td className="kw-nowrap">
                        {fund.dataAsOf ?? unavailable}
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
