import { useEffect, useState } from "react";
import { SiteChrome } from "./SiteChrome";
import { ValueBars } from "./DataCharts";
import { joinFundParts, fundClassLabel } from "./fundClassLabel";
import {
  COMPARE_LIMIT,
  CompareItem,
  readCompareItems,
  writeCompareItems,
} from "./compareStore";

type ComparedFund = {
  snapshotId: string;
  comparisonGroup?: string;
  fundClass: {
    constituentFundName: string;
    fundClassName: string;
    schemeName: string;
    trusteeName?: string;
    annualizedReturn1y?: number;
    annualizedReturn3y?: number;
    annualizedReturn5y?: number;
    annualizedReturn10y?: number;
    calendarYearReturns?: Record<string, number>;
    managementFee?: number;
    latestFer?: number;
    fundRiskIndicator?: number;
    riskClass?: number;
    launchDate?: string;
    fundSizeHkdMillion?: number;
    fundSizeAsOf?: string;
    feeCaps?: string[];
    returnSources?: Record<string, { dataAsOf: string; sourceUrl: string }>;
    cumulativeReturn3y?: number;
    cumulativeReturnSources?: Record<
      string,
      { printed: string; dataAsOf: string; sourceUrl: string }
    >;
  };
  provenance: { sourceUrl: string; dataAsOf: string };
  returnsFreshness?: Record<string, { status: string; dataAsOf: string }>;
  fundSizeFreshness?: { status: string; dataAsOf: string };
  cumulativeReturnsFreshness?: Record<
    string,
    { status: string; dataAsOf: string }
  >;
};

type SearchHit = {
  id: string;
  constituentFundName: string;
  fundClassName: string;
  schemeName: string;
  comparisonGroup?: string;
};

const periods = [
  ["1", "annualizedReturn1y"],
  ["3", "annualizedReturn3y"],
  ["5", "annualizedReturn5y"],
  ["10", "annualizedReturn10y"],
] as const;

function readIds() {
  const raw = new URLSearchParams(window.location.search).get("ids");
  if (raw === null)
    return { raw: "", ids: readCompareItems().map((i) => i.id) };
  return { raw, ids: [...new Set(raw.split(",").filter(Boolean))] };
}

function fundLabel(fund: ComparedFund) {
  return joinFundParts(
    fund.fundClass.constituentFundName,
    fundClassLabel(fund.fundClass.fundClassName),
  );
}

/** 同一類型、至少兩個可比數值時，標示該行最高／最低位置；唔代表好壞。 */
function extremes(values: (number | undefined)[]) {
  const known = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  if (known.length < 2) return null;
  const max = Math.max(...known),
    min = Math.min(...known);
  return max === min ? null : { max, min };
}

function Marker({
  value,
  range,
}: {
  value: number | undefined;
  range: { max: number; min: number } | null;
}) {
  if (!range || typeof value !== "number") return null;
  if (value === range.max)
    return <span className="kw-mark kw-mark--high">最高</span>;
  if (value === range.min)
    return <span className="kw-mark kw-mark--low">最低</span>;
  return null;
}

function FundPicker({
  apiBaseUrl,
  selected,
  onAdd,
}: {
  apiBaseUrl: string;
  selected: string[];
  onAdd: (hit: SearchHit) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setHits(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(
        `${apiBaseUrl}/search?${new URLSearchParams({ q: term, pageSize: "8" })}`,
        { signal: controller.signal },
      )
        .then((response) => {
          if (!response.ok) throw new Error("Search unavailable");
          return response.json() as Promise<SearchHit[]>;
        })
        .then(setHits)
        .catch(() => {
          if (!controller.signal.aborted) setHits([]);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [apiBaseUrl, query]);
  const full = selected.length >= COMPARE_LIMIT;
  return (
    <div className="kw-picker">
      <label htmlFor="compare-add">加入基金</label>
      <input
        id="compare-add"
        className="kw-control"
        type="search"
        maxLength={120}
        value={query}
        disabled={full}
        placeholder={
          full
            ? `已選滿 ${COMPARE_LIMIT} 隻，請先移除一隻`
            : "輸入基金、計劃或受託人名稱"
        }
        onChange={(event) => setQuery(event.target.value)}
        aria-describedby="compare-add-hint"
      />
      <p className="kw-muted" id="compare-add-hint">
        最多 {COMPARE_LIMIT} 隻；亦可以喺<a href="/funds">搵基金</a>或
        <a href="/rankings">同類排名</a>撳「＋」加入。
      </p>
      {hits !== null && (
        <ul className="kw-picker__results" aria-label="搜尋結果">
          {hits.length === 0 ? (
            <li className="kw-muted">搵唔到相符基金</li>
          ) : (
            hits.map((hit) => {
              const added = selected.includes(hit.id);
              return (
                <li key={hit.id}>
                  <span>
                    <strong>
                      {joinFundParts(
                        hit.constituentFundName,
                        fundClassLabel(hit.fundClassName),
                      )}
                    </strong>
                    <small>
                      {joinFundParts(hit.schemeName, hit.comparisonGroup)}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="kw-button kw-button--secondary"
                    disabled={added || full}
                    onClick={() => {
                      onAdd(hit);
                      setQuery("");
                    }}
                  >
                    {added ? "已加入" : "加入"}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

export function FundComparePage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [{ ids }, setSelection] = useState(readIds);
  const tooMany = ids.length > COMPARE_LIMIT;
  const [funds, setFunds] = useState<ComparedFund[] | null>(null),
    [failed, setFailed] = useState(false),
    [partial, setPartial] = useState<Record<string, string | null>>({}),
    [period, setPeriod] = useState("1");
  const key = ids.join(",");
  const loadedFunds =
    funds !== null && funds.length === ids.length && ids.length > 0
      ? funds
      : null;

  // 喺本頁加減基金時，比較清單跟住本頁選擇更新；名稱優先用已載入的基金。
  function itemsFor(next: string[], extra?: CompareItem): CompareItem[] {
    const stored = readCompareItems();
    return next.map((id) => {
      if (extra?.id === id) return extra;
      const index = ids.indexOf(id);
      const fund = loadedFunds?.[index];
      if (fund)
        return {
          id,
          label: joinFundParts(fundLabel(fund), fund.fundClass.schemeName),
          group: fund.comparisonGroup,
        };
      return stored.find((item) => item.id === id) ?? { id, label: id };
    });
  }

  function updateIds(next: string[], items?: CompareItem[]) {
    const params = new URLSearchParams(window.location.search);
    if (next.length > 0) params.set("ids", next.join(","));
    else params.delete("ids");
    const search = params.toString().replace(/%2C/gu, ",");
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}`,
    );
    if (items) writeCompareItems(items);
    setSelection({ raw: next.join(","), ids: next });
  }

  useEffect(() => {
    if (ids.length === 0 || tooMany) {
      setFunds(ids.length === 0 ? [] : null);
      return;
    }
    const controller = new AbortController();
    setFailed(false);
    setPartial({});
    Promise.allSettled(
      ids.map((id) =>
        fetch(`${apiBaseUrl}/fund-classes/${encodeURIComponent(id)}`, {
          signal: controller.signal,
        }).then(async (response) => {
          if (!response.ok) throw new Error("Unavailable");
          return response.json() as Promise<ComparedFund>;
        }),
      ),
    ).then((settled) => {
      if (controller.signal.aborted) return;
      const next = settled.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      // 只讀取，唔改使用者自己嘅比較清單；分享連結唔會覆蓋佢。
      if (
        next.length === ids.length &&
        new Set(next.map((fund) => fund.snapshotId)).size === 1
      ) {
        setFunds(next);
        return;
      }
      setPartial(
        Object.fromEntries(
          settled.map((result, index) => [
            ids[index]!,
            result.status === "fulfilled"
              ? joinFundParts(
                  fundLabel(result.value),
                  result.value.fundClass.schemeName,
                )
              : null,
          ]),
        ),
      );
      setFailed(true);
    });
    return () => controller.abort();
    // 以 id 清單作依賴；ids 陣列每次 render 都係新物件。
  }, [apiBaseUrl, key]);

  const loaded = loadedFunds;
  const sameGroup =
    loaded !== null &&
    loaded.every(
      (fund) =>
        fund.comparisonGroup &&
        fund.comparisonGroup === loaded[0]?.comparisonGroup,
    );
  const periodField = periods.find((item) => item[0] === period)![1];
  const years = loaded
    ? [
        ...new Set(
          loaded.flatMap((fund) =>
            Object.keys(fund.fundClass.calendarYearReturns ?? {}),
          ),
        ),
      ]
        .sort()
        .reverse()
        .slice(0, 5)
    : [];
  const rangeOf = (values: (number | undefined)[]) =>
    sameGroup ? extremes(values) : null;
  const verifiedReturn = (fund: ComparedFund, key: string) =>
    fund.returnsFreshness?.[key]?.status === "verified"
      ? fund.fundClass[periods.find((item) => item[0] === key)![1]]
      : undefined;

  return (
    <SiteChrome
      title="比較基金"
      current="compare"
      subtitle="最多四隻基金並列；每個數值保留自己的截至日期及官方來源。"
    >
      {tooMany ? (
        <p className="kw-status">
          請在基金瀏覽頁選取 1 至 4 個基金。（網址包含 {ids.length} 個基金）
        </p>
      ) : (
        <FundPicker
          apiBaseUrl={apiBaseUrl}
          selected={ids}
          onAdd={(hit) => {
            const next = [...ids, hit.id];
            updateIds(
              next,
              itemsFor(next, {
                id: hit.id,
                label: joinFundParts(
                  hit.constituentFundName,
                  fundClassLabel(hit.fundClassName),
                  hit.schemeName,
                ),
                group: hit.comparisonGroup,
              }),
            );
          }}
        />
      )}
      {tooMany ? null : ids.length === 0 ? (
        <p className="kw-status">
          未揀基金。用上面搜尋加入，或者喺搵基金頁撳「＋」。
        </p>
      ) : failed ? (
        <>
          <p className="kw-status" role="alert">
            未能取得同一快照的所有基金。請重新整理，或移除以下其中一隻再試。
          </p>
          <ul className="kw-compare-failed" aria-label="目前選取">
            {ids.map((id) => {
              const known =
                partial[id] ??
                readCompareItems().find((item) => item.id === id)?.label;
              const label =
                partial[id] === null
                  ? `找不到這隻基金（代號 ${id}）`
                  : (known ?? id);
              return (
                <li key={id}>
                  <span>{label}</span>
                  <button
                    type="button"
                    className="kw-compare__remove"
                    aria-label={`移除：${label}`}
                    onClick={() => {
                      const next = ids.filter((item) => item !== id);
                      updateIds(next, itemsFor(next));
                    }}
                  >
                    移除
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : !loaded ? (
        <p className="kw-status" role="status">
          正在載入基金比較…
        </p>
      ) : (
        <>
          {!sameGroup && loaded.length > 1 && (
            <p className="kw-status kw-status--warning">
              所選基金屬不同積金局基金類型，以下只並列數據，不標示最高／最低。
            </p>
          )}
          <div
            className="kw-table-wrap kw-compare-wrap"
            tabIndex={0}
            role="region"
            aria-label="基金並列數據"
          >
            <table className="kw-table kw-compare">
              <caption>原始數值與來源（過期值仍保留）</caption>
              <thead>
                <tr>
                  <th scope="col" className="kw-compare__label">
                    項目
                  </th>
                  {loaded.map((fund, index) => (
                    <th
                      scope="col"
                      key={ids[index]}
                      className="kw-compare__fund"
                    >
                      <a
                        href={`/fund-classes/${encodeURIComponent(ids[index]!)}`}
                      >
                        {fundLabel(fund)}
                      </a>
                      <small>{fund.fundClass.schemeName}</small>
                      <button
                        type="button"
                        className="kw-compare__remove"
                        aria-label={`移除：${fundLabel(fund)}`}
                        onClick={() => {
                          const next = ids.filter((_, i) => i !== index);
                          updateIds(next, itemsFor(next));
                        }}
                      >
                        移除
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="kw-compare__section">
                  <th scope="rowgroup" colSpan={loaded.length + 1}>
                    概覽
                  </th>
                </tr>
                <tr>
                  <th scope="row">積金局基金類型</th>
                  {loaded.map((fund, index) => (
                    <td key={index}>{fund.comparisonGroup ?? "未提供"}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">受託人</th>
                  {loaded.map((fund, index) => (
                    <td key={index}>{fund.fundClass.trusteeName ?? "—"}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">成立日期</th>
                  {loaded.map((fund, index) => (
                    <td key={index}>{fund.fundClass.launchDate ?? "—"}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">基金規模（百萬港元）</th>
                  {loaded.map((fund, index) => (
                    <td
                      key={index}
                      className={`kw-num${fund.fundSizeFreshness?.status === "stale" ? " kw-num--stale" : ""}`}
                    >
                      {fund.fundClass.fundSizeHkdMillion ?? "—"}
                      {fund.fundClass.fundSizeAsOf && (
                        <small>
                          {fund.fundSizeFreshness?.status === "stale"
                            ? "過期 · "
                            : ""}
                          截至 {fund.fundClass.fundSizeAsOf}
                        </small>
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="kw-compare__section">
                  <th scope="rowgroup" colSpan={loaded.length + 1}>
                    年率化回報
                  </th>
                </tr>
                {periods.map(([key, field]) => {
                  const range = rangeOf(
                    loaded.map((fund) => verifiedReturn(fund, key)),
                  );
                  return (
                    <tr key={key}>
                      <th scope="row">{key} 年</th>
                      {loaded.map((fund, index) => {
                        const value = fund.fundClass[field];
                        const freshness = fund.returnsFreshness?.[key];
                        return (
                          <td
                            key={index}
                            className={`kw-num${freshness?.status === "stale" ? " kw-num--stale" : ""}`}
                          >
                            {typeof value === "number" ? (
                              <>
                                {value}%
                                <Marker
                                  value={verifiedReturn(fund, key)}
                                  range={range}
                                />
                                <small>
                                  {freshness?.status === "stale"
                                    ? "過期 · "
                                    : ""}
                                  {freshness?.dataAsOf
                                    ? `截至 ${freshness.dataAsOf}`
                                    : "日期未記錄"}{" "}
                                  ·{" "}
                                  <a
                                    href={
                                      fund.fundClass.returnSources?.[key]
                                        ?.sourceUrl ?? fund.provenance.sourceUrl
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    官方來源
                                  </a>
                                </small>
                              </>
                            ) : (
                              "未取得"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {loaded.some(
                  (fund) => fund.fundClass.cumulativeReturnSources?.["3"],
                ) && (
                  <>
                    <tr className="kw-compare__section">
                      <th scope="rowgroup" colSpan={loaded.length + 1}>
                        累積回報（受託人官方，非年率化）
                      </th>
                    </tr>
                    <tr>
                      <th scope="row">3 年累積</th>
                      {(() => {
                        const verified = (fund: ComparedFund) =>
                          fund.cumulativeReturnsFreshness?.["3"]?.status ===
                          "verified"
                            ? fund.fundClass.cumulativeReturn3y
                            : undefined;
                        const range = rangeOf(loaded.map(verified));
                        return loaded.map((fund, index) => {
                          const source =
                            fund.fundClass.cumulativeReturnSources?.["3"];
                          const stale =
                            fund.cumulativeReturnsFreshness?.["3"]?.status ===
                            "stale";
                          return (
                            <td
                              key={index}
                              className={`kw-num${stale ? " kw-num--stale" : ""}`}
                            >
                              {source ? (
                                <>
                                  {typeof fund.fundClass.cumulativeReturn3y !==
                                  "number"
                                    ? "官方未提供"
                                    : `${source.printed}%`}
                                  <Marker
                                    value={verified(fund)}
                                    range={range}
                                  />
                                  <small>
                                    {stale ? "過期 · " : ""}截至{" "}
                                    {source.dataAsOf} ·{" "}
                                    <a
                                      href={source.sourceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      受託人每月數據
                                    </a>
                                  </small>
                                </>
                              ) : (
                                "未取得"
                              )}
                            </td>
                          );
                        });
                      })()}
                    </tr>
                  </>
                )}
                {years.length > 0 && (
                  <tr className="kw-compare__section">
                    <th scope="rowgroup" colSpan={loaded.length + 1}>
                      曆年回報
                    </th>
                  </tr>
                )}
                {years.map((year) => {
                  const range = rangeOf(
                    loaded.map(
                      (fund) => fund.fundClass.calendarYearReturns?.[year],
                    ),
                  );
                  return (
                    <tr key={year}>
                      <th scope="row">{year} 年</th>
                      {loaded.map((fund, index) => {
                        const value =
                          fund.fundClass.calendarYearReturns?.[year];
                        return (
                          <td key={index} className="kw-num">
                            {typeof value === "number" ? `${value}%` : "—"}
                            <Marker value={value} range={range} />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="kw-compare__section">
                  <th scope="rowgroup" colSpan={loaded.length + 1}>
                    風險
                  </th>
                </tr>
                <tr>
                  <th scope="row">三年波幅</th>
                  {loaded.map((fund, index) => (
                    <td key={index} className="kw-num">
                      {typeof fund.fundClass.fundRiskIndicator === "number"
                        ? `${fund.fundClass.fundRiskIndicator}%`
                        : "未取得"}
                      <Marker
                        value={fund.fundClass.fundRiskIndicator}
                        range={rangeOf(
                          loaded.map(
                            (item) => item.fundClass.fundRiskIndicator,
                          ),
                        )}
                      />
                      <small>
                        平台截至 {fund.provenance.dataAsOf} ·{" "}
                        <a
                          href={fund.provenance.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          官方來源
                        </a>
                      </small>
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">風險級別</th>
                  {loaded.map((fund, index) => (
                    <td key={index} className="kw-num">
                      {fund.fundClass.riskClass ?? "—"}
                    </td>
                  ))}
                </tr>
                <tr className="kw-compare__section">
                  <th scope="rowgroup" colSpan={loaded.length + 1}>
                    收費
                  </th>
                </tr>
                {(
                  [
                    ["managementFee", "管理費"],
                    ["latestFer", "基金開支比率（歷史期別）"],
                  ] as const
                ).map(([field, label]) => {
                  // 上限同實際費率口徑唔同；有啲係上限、有啲唔係就唔標最高／最低。
                  const capped = new Set(
                    loaded.map((fund) =>
                      Boolean(fund.fundClass.feeCaps?.includes(field)),
                    ),
                  );
                  const range =
                    capped.size === 1
                      ? rangeOf(loaded.map((fund) => fund.fundClass[field]))
                      : null;
                  return (
                    <tr key={field}>
                      <th scope="row">{label}</th>
                      {loaded.map((fund, index) => (
                        <td key={index} className="kw-num">
                          {typeof fund.fundClass[field] === "number"
                            ? `${fund.fundClass[field]}%${fund.fundClass.feeCaps?.includes(field) ? "（上限）" : ""}`
                            : "未取得"}
                          <Marker value={fund.fundClass[field]} range={range} />
                          <small>
                            平台截至 {fund.provenance.dataAsOf} ·{" "}
                            <a
                              href={fund.provenance.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              官方來源
                            </a>
                          </small>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="kw-muted">
            「最高／最低」只喺所選基金同屬一個積金局基金類型時標示，只表示位置，唔代表好壞；過期數值唔參與。回報期間是獨立披露，並非連續走勢；波幅、管理費及基金開支比率口徑不同，不合成總分。
          </p>
          {loaded.length > 1 && (
            <section
              className="kw-section"
              aria-labelledby="compare-chart-title"
            >
              <h2 className="kw-section__heading" id="compare-chart-title">
                回報圖
              </h2>
              <div className="kw-chips" role="group" aria-label="回報期間">
                {periods.map(([value]) => (
                  <button
                    key={value}
                    type="button"
                    className="kw-chip"
                    aria-pressed={period === value}
                    onClick={() => setPeriod(value)}
                  >
                    {value} 年
                  </button>
                ))}
              </div>
              <ValueBars
                variant="dot"
                label={`${period} 年年率化回報（只繪製未過期數值）`}
                rows={loaded.map((fund, index) => ({
                  label: joinFundParts(
                    fundLabel(fund),
                    fund.fundClass.schemeName,
                  ),
                  value:
                    fund.returnsFreshness?.[period]?.status === "verified"
                      ? fund.fundClass[periodField]
                      : null,
                  display:
                    fund.returnsFreshness?.[period]?.status === "stale"
                      ? "過期，暫不繪圖"
                      : typeof fund.fundClass[periodField] === "number" &&
                          fund.returnsFreshness?.[period]?.status !== "verified"
                        ? "未核實，暫不繪圖"
                        : undefined,
                  href: `/fund-classes/${encodeURIComponent(ids[index]!)}`,
                  note: fund.returnsFreshness?.[period]?.dataAsOf
                    ? `${fund.returnsFreshness[period].status === "stale" ? "過期 · " : ""}截至 ${fund.returnsFreshness[period].dataAsOf}`
                    : "日期未記錄",
                }))}
              />
            </section>
          )}
          <p className="kw-muted kw-advanced">
            公開快照：<code>{loaded[0]?.snapshotId}</code>
          </p>
        </>
      )}
    </SiteChrome>
  );
}
