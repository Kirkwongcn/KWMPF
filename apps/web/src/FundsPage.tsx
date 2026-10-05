import { useEffect, useState } from "react";
import { SiteChrome } from "./SiteChrome";
import { CompareToggle } from "./CompareTray";
import { fundClassLabel, joinFundParts } from "./fundClassLabel";

type Freshness = {
  status: "verified" | "stale";
  dataAsOf: string;
  graceDays: number;
  ageDays: number | null;
};

type FundSummary = {
  id: string;
  fundClassName: string;
  constituentFundName: string;
  schemeName: string;
  trusteeName: string;
  fundType: string;
  fundCategory?: string;
  comparisonGroup?: string;
  comparisonGroupFamily?: string;
  riskClass?: number;
  fundRiskIndicator?: number;
  annualizedReturn1y?: number;
  annualizedReturn3y?: number;
  annualizedReturn5y?: number;
  annualizedReturn10y?: number;
  returnsFreshness?: Record<string, Freshness>;
  managementFee?: number;
  latestFer?: number;
  feeCaps?: string[];
  fundSizeHkdMillion?: number;
  fundSizeAsOf?: string;
  fundSizeFreshness?: Freshness;
  dataAsOf?: string;
  freshness?: Freshness;
};

type Classification = {
  provider: string;
  capturedAt: string;
  official: true;
};

type PublishedFilters = {
  snapshotId: string | null;
  categories?: string[];
  families?: string[];
  classification?: Classification | null;
  fundTypes: string[];
  trustees: string[];
  riskClasses: number[];
};

const unavailable = "官方未提供";
const PAGE_SIZE = 50;

export function classificationNote(classification: Classification | null) {
  return classification
    ? `基金類型只採用${classification.provider}的官方分類（擷取 ${classification.capturedAt}），本站不另設分類。`
    : "基金類型只採用積金局強積金基金平台的官方分類，本站不另設分類。";
}

function percent(value?: number, capped = false) {
  if (typeof value !== "number") return unavailable;
  return `${value}%${capped ? "（上限）" : ""}`;
}

type SortKey =
  | "name"
  | "return"
  | "return3y"
  | "return5y"
  | "return10y"
  | "volatility"
  | "risk"
  | "size"
  | "fer"
  | "fee";

// 預設方向同 API 一致：回報及規模高至低，波幅、風險級別及收費低至高。
const DEFAULT_ORDER: Record<Exclude<SortKey, "name">, "asc" | "desc"> = {
  return: "desc",
  return3y: "desc",
  return5y: "desc",
  return10y: "desc",
  volatility: "asc",
  risk: "asc",
  size: "desc",
  fer: "asc",
  fee: "asc",
};

const SORT_KEYS = new Set<string>(["name", ...Object.keys(DEFAULT_ORDER)]);

function readSort(): SortKey {
  const value = new URLSearchParams(window.location.search).get("sort");
  return value && SORT_KEYS.has(value) ? (value as SortKey) : "name";
}

function readOrder(): "asc" | "desc" | undefined {
  const value = new URLSearchParams(window.location.search).get("order");
  return value === "asc" || value === "desc" ? value : undefined;
}

const RETURN_COLUMNS = [
  ["1", "1年", "annualizedReturn1y", "return"],
  ["3", "3年", "annualizedReturn3y", "return3y"],
  ["5", "5年", "annualizedReturn5y", "return5y"],
  ["10", "10年", "annualizedReturn10y", "return10y"],
] as const;

function ReturnCell({
  fund,
  period,
  field,
}: {
  fund: FundSummary;
  period: string;
  field: (typeof RETURN_COLUMNS)[number][2];
}) {
  const value = fund[field];
  if (typeof value !== "number")
    return (
      <td className="kw-num kw-num--empty">
        <span aria-hidden="true">—</span>
        <span className="kw-visually-hidden">未有數值</span>
      </td>
    );
  const freshness =
    fund.returnsFreshness?.[period] ??
    (period === "1" ? fund.freshness : undefined);
  const stale = freshness?.status === "stale";
  return (
    <td
      className={`kw-num${stale ? " kw-num--stale" : ""}${value < 0 ? " kw-num--negative" : ""}`}
      title={freshness ? `截至 ${freshness.dataAsOf}` : undefined}
    >
      {value}%
      {stale && (
        <span className="kw-data-state kw-data-state--stale">
          過期
          <span className="kw-visually-hidden">
            ，截至 {freshness?.dataAsOf}
          </span>
        </span>
      )}
    </td>
  );
}

function SortHeader({
  sortKey,
  label,
  title,
  sort,
  order,
  onSort,
}: {
  sortKey: Exclude<SortKey, "name">;
  label: string;
  title?: string;
  sort: SortKey;
  order: "asc" | "desc" | undefined;
  onSort: (key: SortKey) => void;
}) {
  const active = sort === sortKey;
  const direction = active ? (order ?? DEFAULT_ORDER[sortKey]) : undefined;
  return (
    <th
      scope="col"
      className="kw-num"
      aria-sort={
        direction === "asc"
          ? "ascending"
          : direction === "desc"
            ? "descending"
            : undefined
      }
    >
      <button
        type="button"
        className={`kw-sort${active ? " is-active" : ""}`}
        title={title}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span className="kw-sort__arrow" aria-hidden="true">
          {direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕"}
        </span>
      </button>
    </th>
  );
}

export function FundsPage({
  apiBaseUrl,
  initialCategory = "all",
  initialFundType = "all",
  initialTrustee = "all",
  initialRiskClass = "all",
  initialQuery = "",
  initialFamily = new URLSearchParams(window.location.search).get("family") ??
    "all",
}: {
  apiBaseUrl: string;
  initialCategory?: string;
  initialFundType?: string;
  initialTrustee?: string;
  initialRiskClass?: string;
  initialQuery?: string;
  initialFamily?: string;
}) {
  const [filters, setFilters] = useState<PublishedFilters | null>(null);
  const [family, setFamily] = useState(initialFamily);
  const [category, setCategory] = useState(initialCategory);
  const [fundType, setFundType] = useState(initialFundType);
  const [trustee, setTrustee] = useState(initialTrustee);
  const [riskClass, setRiskClass] = useState(initialRiskClass);
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [results, setResults] = useState<FundSummary[] | null>(null);
  const [totalMatches, setTotalMatches] = useState(0);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(
    () => Number(new URLSearchParams(window.location.search).get("page")) || 1,
  );
  const [sort, setSort] = useState<SortKey>(readSort);
  const [order, setOrder] = useState<"asc" | "desc" | undefined>(readOrder);

  function pushFilters(
    overrides: Partial<{
      family: string;
      category: string;
      fundType: string;
      trustee: string;
      riskClass: string;
      query: string;
      page: number;
      sort: SortKey;
      order: "asc" | "desc" | undefined;
    }> = {},
  ) {
    const next = {
      family,
      category,
      fundType,
      trustee,
      riskClass,
      query: submittedQuery,
      page: 1,
      sort,
      order,
      ...overrides,
    };
    const params = new URLSearchParams(window.location.search);
    for (const key of [
      "q",
      "family",
      "category",
      "fundType",
      "trustee",
      "riskClass",
      "page",
      "sort",
      "order",
    ])
      params.delete(key);
    setPage(next.page);
    if (next.query.trim()) params.set("q", next.query.trim());
    if (next.family !== "all") params.set("family", next.family);
    if (next.category !== "all") params.set("category", next.category);
    if (next.fundType !== "all") params.set("fundType", next.fundType);
    if (next.trustee !== "all") params.set("trustee", next.trustee);
    if (next.riskClass !== "all") params.set("riskClass", next.riskClass);
    if (next.page > 1) params.set("page", String(next.page));
    if (next.sort !== "name") params.set("sort", next.sort);
    if (next.sort !== "name" && next.order) params.set("order", next.order);
    const search = params.toString();
    window.history.pushState(
      {},
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}`,
    );
  }

  function changeSort(key: SortKey) {
    if (key === "name") {
      setSort("name");
      setOrder(undefined);
      pushFilters({ sort: "name", order: undefined });
      return;
    }
    const current = sort === key ? (order ?? DEFAULT_ORDER[key]) : undefined;
    const nextOrder =
      current === undefined
        ? DEFAULT_ORDER[key]
        : current === "asc"
          ? "desc"
          : "asc";
    setSort(key);
    setOrder(nextOrder);
    pushFilters({ sort: key, order: nextOrder });
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
          families: [],
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
      setFamily(params.get("family") ?? "all");
      setCategory(params.get("category") ?? "all");
      setFundType(params.get("fundType") ?? "all");
      setTrustee(params.get("trustee") ?? "all");
      setRiskClass(params.get("riskClass") ?? "all");
      setQuery(nextQuery);
      setSubmittedQuery(nextQuery);
      setPage(Number(params.get("page")) || 1);
      setSort(readSort());
      setOrder(readOrder());
    }
    window.addEventListener("popstate", restoreFilters);
    return () => window.removeEventListener("popstate", restoreFilters);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (submittedQuery.trim()) params.set("q", submittedQuery.trim());
    if (family !== "all") params.set("family", family);
    if (category !== "all") params.set("category", category);
    if (fundType !== "all") params.set("fundType", fundType);
    if (trustee !== "all") params.set("trustee", trustee);
    if (riskClass !== "all") params.set("riskClass", riskClass);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    params.set("sort", sort);
    if (sort !== "name" && order) params.set("order", order);

    setFailed(false);
    setResults(null);
    fetch(`${apiBaseUrl}/search?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Search unavailable");
        const totalHeader = response.headers.get("X-Total-Matches");
        const total = totalHeader === null ? NaN : Number(totalHeader);
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
  }, [
    apiBaseUrl,
    submittedQuery,
    family,
    category,
    fundType,
    trustee,
    riskClass,
    page,
    sort,
    order,
  ]);

  const pageCount = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));
  const sortProps = { sort, order, onSort: changeSort };
  const oneYearDates = new Set(
    (results ?? []).map(
      (fund) =>
        fund.returnsFreshness?.["1"]?.dataAsOf ??
        fund.freshness?.dataAsOf ??
        fund.dataAsOf,
    ),
  );
  const activeFilterCount = [family, category, fundType, trustee, riskClass]
    .filter((value) => value !== "all")
    .concat(submittedQuery.trim() ? ["q"] : []).length;
  const categoriesInFamily =
    family === "all"
      ? filters?.categories
      : filters?.categories?.filter((value) => value.startsWith(family));

  return (
    <SiteChrome
      eyebrow="基金瀏覽"
      title="搵基金"
      subtitle="按積金局基金類型、受託人及風險篩選全部基金；撳欄位標題即可排序。"
      current="funds"
    >
      <section className="kw-section" aria-labelledby="filters-title">
        <h2 className="kw-visually-hidden" id="filters-title">
          篩選條件
        </h2>
        <form
          className="kw-screener-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmittedQuery(query);
            pushFilters({ query });
          }}
        >
          <label htmlFor="filter-query">關鍵字</label>
          <input
            className="kw-control"
            id="filter-query"
            value={query}
            type="search"
            maxLength={120}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="基金、計劃或受託人名稱，例如：滙豐、富達、保守基金"
          />
          <button className="kw-button" type="submit">
            搜尋
          </button>
        </form>
        <div className="kw-chips" role="group" aria-label="按基金大類篩選">
          {["all", ...(filters?.families ?? [])].map((value) => (
            <button
              key={value}
              type="button"
              className="kw-chip"
              aria-pressed={family === value}
              onClick={() => {
                setFamily(value);
                setCategory("all");
                pushFilters({ family: value, category: "all" });
              }}
            >
              {value === "all" ? "全部" : value}
            </button>
          ))}
        </div>
        <div className="kw-filters kw-filters--row">
          <p className="kw-filter">
            <label htmlFor="filter-category">積金局基金類型</label>
            <select
              className="kw-control"
              id="filter-category"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                pushFilters({ category: event.target.value });
              }}
            >
              <option value="all">
                {family === "all" ? "全部基金類型" : `全部${family}`}
              </option>
              {categoriesInFamily?.map((value) => (
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
          {activeFilterCount > 0 && (
            <p className="kw-filter kw-filter--action">
              <button
                type="button"
                className="kw-button kw-button--secondary"
                onClick={() => {
                  setFamily("all");
                  setCategory("all");
                  setFundType("all");
                  setTrustee("all");
                  setRiskClass("all");
                  setQuery("");
                  setSubmittedQuery("");
                  pushFilters({
                    family: "all",
                    category: "all",
                    fundType: "all",
                    trustee: "all",
                    riskClass: "all",
                    query: "",
                  });
                }}
              >
                清除篩選
              </button>
            </p>
          )}
        </div>
        <p className="kw-muted" role="note">
          {classificationNote(filters?.classification ?? null)}
        </p>
      </section>

      <section className="kw-section" aria-labelledby="results-title">
        <div className="kw-results-head">
          <h2 className="kw-section__heading" id="results-title">
            基金列表
          </h2>
          {results !== null && !failed && results.length > 0 && (
            <p
              className="kw-muted"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {`共 ${totalMatches} 隻符合條件；第 ${page} / ${pageCount} 頁，顯示 ${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + results.length} 隻。`}
            </p>
          )}
        </div>
        {sort !== "name" && category === "all" && (
          <p className="kw-status kw-status--warning">
            而家係唔同基金類型一齊排序，只方便瀏覽；同類比較請揀一個積金局基金類型，或者用
            <a href="/rankings">同類排名</a>。
          </p>
        )}
        {failed ? (
          <p className="kw-status kw-status--warning" role="alert">
            暫時無法讀取已發布資料
          </p>
        ) : results === null ? (
          <p className="kw-status" role="status" aria-live="polite">
            正在讀取基金…
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
            <p className="kw-table-hint" id="fund-table-scroll-hint">
              左右滑動可查看其餘欄位
            </p>
            <div
              className="kw-table-wrap kw-screener-wrap"
              tabIndex={0}
              role="region"
              aria-label="基金列表"
              aria-describedby="fund-table-scroll-hint"
            >
              <table className="kw-table kw-screener">
                <thead>
                  <tr className="kw-screener__groups">
                    <th scope="colgroup" colSpan={2}>
                      <span className="kw-visually-hidden">基金</span>
                    </th>
                    <th scope="colgroup" colSpan={5}>
                      年率化回報
                    </th>
                    <th scope="colgroup" colSpan={2}>
                      風險
                    </th>
                    <th scope="colgroup">規模</th>
                    <th scope="colgroup" colSpan={2}>
                      收費
                    </th>
                  </tr>
                  <tr>
                    <th scope="col" className="kw-screener__fund">
                      <button
                        type="button"
                        className={`kw-sort${sort === "name" ? " is-active" : ""}`}
                        onClick={() => changeSort("name")}
                      >
                        基金
                        <span className="kw-sort__arrow" aria-hidden="true">
                          {sort === "name" ? "▲" : "↕"}
                        </span>
                      </button>
                    </th>
                    <th scope="col">積金局基金類型</th>
                    {RETURN_COLUMNS.map(([, label, , key]) => (
                      <SortHeader
                        key={key}
                        sortKey={key}
                        label={label}
                        {...sortProps}
                      />
                    ))}
                    <th scope="col" className="kw-nowrap">
                      截至
                    </th>
                    <SortHeader
                      sortKey="volatility"
                      {...sortProps}
                      label="三年波幅"
                      title="官方基金風險指標（年率化標準差）"
                    />
                    <SortHeader
                      sortKey="risk"
                      {...sortProps}
                      label="風險級別"
                    />
                    <SortHeader
                      sortKey="size"
                      {...sortProps}
                      label="百萬港元"
                      title="基金規模（港幣百萬元）"
                    />
                    <SortHeader
                      sortKey="fer"
                      {...sortProps}
                      label="開支比率"
                      title="最新基金開支比率（FER）"
                    />
                    <SortHeader sortKey="fee" {...sortProps} label="管理費" />
                  </tr>
                </thead>
                <tbody>
                  {results.map((fund) => {
                    const classLabel = fundClassLabel(fund.fundClassName);
                    const label = joinFundParts(
                      fund.constituentFundName,
                      classLabel,
                    );
                    return (
                      <tr key={fund.id}>
                        <th scope="row" className="kw-screener__fund">
                          <div className="kw-screener__name">
                            <CompareToggle
                              compact
                              item={{
                                id: fund.id,
                                label: joinFundParts(label, fund.schemeName),
                                group: fund.comparisonGroup,
                              }}
                            />
                            <span>
                              <a
                                href={`/fund-classes/${encodeURIComponent(fund.id)}`}
                              >
                                {fund.constituentFundName}
                              </a>
                              {classLabel && (
                                <span className="kw-muted"> {classLabel}</span>
                              )}
                              <span className="kw-screener__scheme">
                                {fund.schemeName}
                                <span className="kw-screener__trustee">
                                  {fund.trusteeName}
                                </span>
                              </span>
                            </span>
                          </div>
                        </th>
                        <td className="kw-screener__type">
                          {/* 只顯示積金局基金類型；冇就講明，唔用基金種類補位。 */}
                          {fund.comparisonGroup ?? unavailable}
                        </td>
                        {RETURN_COLUMNS.map(([period, , field]) => (
                          <ReturnCell
                            key={period}
                            fund={fund}
                            period={period}
                            field={field}
                          />
                        ))}
                        <td className="kw-nowrap kw-screener__date">
                          {fund.returnsFreshness?.["1"]?.dataAsOf ??
                            fund.freshness?.dataAsOf ??
                            fund.dataAsOf ??
                            unavailable}
                        </td>
                        <td className="kw-num">
                          {typeof fund.fundRiskIndicator === "number"
                            ? `${fund.fundRiskIndicator}%`
                            : "—"}
                        </td>
                        <td className="kw-num">{fund.riskClass ?? "—"}</td>
                        <td
                          className={`kw-num${fund.fundSizeFreshness?.status === "stale" ? " kw-num--stale" : ""}`}
                          title={
                            fund.fundSizeAsOf
                              ? `截至 ${fund.fundSizeAsOf}`
                              : undefined
                          }
                        >
                          {fund.fundSizeHkdMillion ?? "—"}
                          {fund.fundSizeFreshness?.status === "stale" && (
                            <span className="kw-data-state kw-data-state--stale">
                              過期
                              <span className="kw-visually-hidden">
                                ，截至 {fund.fundSizeAsOf}
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="kw-num">
                          {typeof fund.latestFer === "number"
                            ? `${fund.latestFer}%`
                            : "—"}
                        </td>
                        <td className="kw-num kw-nowrap">
                          {percent(
                            fund.managementFee,
                            fund.feeCaps?.includes("managementFee"),
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="kw-muted kw-screener__legend">
              {oneYearDates.size === 1 && [...oneYearDates][0]
                ? `本頁一年回報截至 ${[...oneYearDates][0]}`
                : "本頁各基金一年回報截至日期不一"}
              （見「截至」欄）。其他期間及基金規模各有自己的截至日期，滑鼠停留數值可見；三年回報來自受託人便覽。
              「—」＝未有數值；「過期」＝超出網站時效門檻，只作參考、不入排名。
            </p>
            <nav className="kw-pagination" aria-label="基金結果頁次">
              <button
                className="kw-button kw-button--secondary"
                disabled={page <= 1}
                onClick={() => pushFilters({ page: page - 1 })}
              >
                上一頁
              </button>
              <span>
                第 {page} / {pageCount} 頁
              </span>
              <button
                className="kw-button kw-button--secondary"
                disabled={page * PAGE_SIZE >= totalMatches}
                onClick={() => pushFilters({ page: page + 1 })}
              >
                下一頁
              </button>
            </nav>
          </>
        )}
        <p className="kw-muted">
          結果只包含目前已發布快照內、通過核實的基金。官方未提供的欄位不會以估算值填補。
        </p>
      </section>
    </SiteChrome>
  );
}
