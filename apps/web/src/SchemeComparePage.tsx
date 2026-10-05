import { useEffect, useMemo, useState } from "react";
import { SiteChrome } from "./SiteChrome";
import { ValueBars } from "./DataCharts";
import { RangeChart, type RangeRow } from "./Charts";
import { useViewMode } from "./viewMode";
import { fundClassLabel, joinFundParts } from "./fundClassLabel";

type LineupFund = {
  id: string;
  constituentFundName: string;
  fundClassName: string;
  comparisonGroup: string;
  annualizedReturn1y?: number;
  latestFer?: number;
  returnsFreshness?: Record<string, { status: string; dataAsOf: string }>;
};

type LineupScheme = {
  schemeName: string;
  trusteeName: string;
  funds: LineupFund[];
};

const LINEUP_FAMILY_ORDER = [
  "股票基金",
  "混合資產基金",
  "債券基金",
  "保證基金",
  "貨幣市場基金",
];

function familyRank(group: string) {
  const index = LINEUP_FAMILY_ORDER.findIndex((family) =>
    group.startsWith(family),
  );
  return index === -1 ? LINEUP_FAMILY_ORDER.length : index;
}

function compareUrl(names: string[]) {
  return names.length === 0
    ? "/schemes/compare"
    : `/schemes/compare?ids=${names.map(encodeURIComponent).join(",")}`;
}

/** 加入／移除計劃：喺比較頁直接改，唔使返去概覽頁。 */
function SchemePicker({
  all,
  selected,
}: {
  all: LineupScheme[] | null;
  selected: string[];
}) {
  const available = (all ?? [])
    .map((scheme) => scheme.schemeName)
    .filter((name) => !selected.includes(name))
    .sort((a, b) => a.localeCompare(b));
  return (
    <div className="kw-scheme-picker">
      <ul aria-label="已選計劃">
        {selected.map((name) => (
          <li key={name}>
            <span>{name}</span>
            <a
              href={compareUrl(selected.filter((item) => item !== name))}
              aria-label={`移除：${name}`}
            >
              ×
            </a>
          </li>
        ))}
      </ul>
      {selected.length < 4 && all && all.length > 0 && (
        <p className="kw-field">
          <label htmlFor="scheme-add">加入計劃</label>
          <select
            id="scheme-add"
            className="kw-control"
            value=""
            onChange={(event) => {
              if (event.target.value)
                window.location.assign(
                  compareUrl([...selected, event.target.value]),
                );
            }}
          >
            <option value="">揀一個計劃…</option>
            {available.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </p>
      )}
    </div>
  );
}

/** 同類基金對照：每行一個積金局基金類型，列出各計劃喺該類型提供的基金。 */
function LineupMatrix({ schemes }: { schemes: LineupScheme[] }) {
  const groups = [
    ...new Set(
      schemes.flatMap((scheme) =>
        scheme.funds.map((fund) => fund.comparisonGroup),
      ),
    ),
  ].sort((a, b) => familyRank(a) - familyRank(b) || a.localeCompare(b));
  return (
    <div
      className="kw-table-wrap kw-lineup-wrap"
      tabIndex={0}
      role="region"
      aria-label="同類基金對照表"
    >
      <table className="kw-table kw-lineup">
        <thead>
          <tr>
            <th scope="col">積金局基金類型</th>
            {schemes.map((scheme) => (
              <th scope="col" key={scheme.schemeName}>
                {scheme.schemeName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group}>
              <th scope="row">{group}</th>
              {schemes.map((scheme) => {
                const funds = scheme.funds.filter(
                  (fund) => fund.comparisonGroup === group,
                );
                return (
                  <td key={scheme.schemeName}>
                    {funds.length === 0 ? (
                      <span className="kw-lineup__none">沒有此類基金</span>
                    ) : (
                      <ul>
                        {funds.map((fund) => {
                          const freshness = fund.returnsFreshness?.["1"];
                          return (
                            <li key={fund.id}>
                              <a
                                href={`/fund-classes/${encodeURIComponent(fund.id)}`}
                              >
                                {joinFundParts(
                                  fund.constituentFundName,
                                  fundClassLabel(fund.fundClassName),
                                )}
                              </a>
                              <span className="kw-lineup__figures">
                                <span>
                                  1年{" "}
                                  {typeof fund.annualizedReturn1y === "number"
                                    ? `${fund.annualizedReturn1y}%`
                                    : "—"}
                                  {freshness?.status === "stale" && (
                                    <span className="kw-data-state kw-data-state--stale">
                                      過期
                                    </span>
                                  )}
                                </span>
                                <span>
                                  開支比率{" "}
                                  {typeof fund.latestFer === "number"
                                    ? `${fund.latestFer}%`
                                    : "—"}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type DisObservation = {
  value: number | null;
  dataAsOf: string | null;
  sourceUrl: string | null;
  graceDays: number;
  status: "verified" | "stale" | "missing" | "unverified";
};

type FeeRange = {
  min: number;
  median: number;
  max: number;
  fundCount: number;
};

type DisReturnBand = {
  min: number;
  max: number;
  fundClassCount: number;
} | null;

type DisComponent = {
  constituentFundName: string;
  returns: Record<"1y" | "3y" | "5y" | "10y", DisReturnBand>;
  fundClasses: Array<{
    id: string;
    fundClassName: string;
    annualizedReturn1y?: number;
    annualizedReturn3y?: number;
    annualizedReturn5y?: number;
    annualizedReturn10y?: number;
    observations?: Partial<Record<"1y" | "3y" | "5y" | "10y", DisObservation>>;
  }>;
} | null;

type ComparedScheme = {
  id: string;
  schemeName: string;
  trusteeName: string;
  fundChoiceCount: number;
  fundClassCount: number;
  fer: FeeRange | null;
  disPerformance: {
    status: "complete" | "incomplete";
    missing: Array<"core_accumulation" | "age65_plus">;
    coreAccumulation: DisComponent;
    age65Plus: DisComponent;
  };
  administrationScore: null;
};

type CompareResponse = {
  snapshotId: string | null;
  schemes: ComparedScheme[];
  error?: string;
  missingIds?: string[];
  maximum?: number;
};

const missingLabels = {
  core_accumulation: "核心累積基金",
  age65_plus: "65歲後基金",
} as const;

const returnPeriods = ["1y", "3y", "5y", "10y"] as const;
const returnPeriodLabels = {
  "1y": "1年",
  "3y": "3年",
  "5y": "5年",
  "10y": "10年",
} as const;

function parseSchemeIds(search: string) {
  const raw = new URLSearchParams(search).get("ids");
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter((id, index, all) => id.length > 0 && all.indexOf(id) === index);
}

function observationStatus(observation: DisObservation | undefined) {
  return observation?.status === "verified"
    ? "符合網站時效門檻"
    : observation?.status === "stale"
      ? "過期，僅供歷史參考"
      : observation?.status === "missing"
        ? "官方未提供"
        : "日期或來源未核實";
}

function DisSources({ schemes }: { schemes: ComparedScheme[] }) {
  const [mode] = useViewMode();
  return (
    <details
      className="kw-section kw-source-details"
      open={mode === "analysis"}
    >
      <summary>DIS 逐筆披露：日期、來源及時效</summary>
      <p className="kw-muted">
        上表範圍是已發布的歷史原值，可能混合不同日期及過期數字；不作當期排名。成分齊備只表示兩類
        DIS 基金存在，不代表全部期間均有合資格回報。
      </p>
      {schemes.map((scheme) => (
        <section key={scheme.id} className="kw-section">
          <h3>{scheme.schemeName}</h3>
          {(["coreAccumulation", "age65Plus"] as const).map((key) => {
            const component = scheme.disPerformance[key];
            if (!component)
              return (
                <p key={key}>
                  未收錄
                  {key === "coreAccumulation" ? "核心累積基金" : "65歲後基金"}。
                </p>
              );
            return (
              <div key={key}>
                <h4>{component.constituentFundName}</h4>
                {component.fundClasses.map((fund) => (
                  <div className="kw-dis-source" key={fund.id}>
                    <a href={`/fund-classes/${encodeURIComponent(fund.id)}`}>
                      {fund.fundClassName} · 查看基金詳情
                    </a>
                    <dl className="kw-dis-observations">
                      {returnPeriods.map((period) => {
                        const observation = fund.observations?.[period];
                        return (
                          <div key={period}>
                            <dt>{returnPeriodLabels[period]}年率化回報</dt>
                            <dd>
                              <strong>
                                {observation?.value == null
                                  ? "官方未提供"
                                  : formatPercent(observation.value)}
                              </strong>
                              <span>
                                {observationStatus(observation)}；截至{" "}
                                {observation?.dataAsOf ?? "日期未提供"}
                              </span>
                              {observation?.sourceUrl && (
                                <a
                                  href={observation.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  官方來源
                                </a>
                              )}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                ))}
              </div>
            );
          })}
        </section>
      ))}
    </details>
  );
}

function formatPercent(value: number) {
  return `${value}%`;
}

function formatRange(band: DisReturnBand | FeeRange | null) {
  if (!band) return "官方未提供";
  if (band.min === band.max) return formatPercent(band.min);
  return `${formatPercent(band.min)} – ${formatPercent(band.max)}`;
}

function SchemeCompareCharts({ schemes }: { schemes: ComparedScheme[] }) {
  return (
    <div className="kw-scheme-charts">
      <ValueBars
        label="獨立成分基金數目"
        unit=""
        rows={schemes.map((scheme) => ({
          label: scheme.schemeName,
          value: scheme.fundChoiceCount,
        }))}
      />
      {(
        [
          ["coreAccumulation", "核心累積基金"],
          ["age65Plus", "65歲後基金"],
        ] as const
      ).map(([component, componentLabel]) => {
        const rows = returnPeriods.flatMap((period) =>
          schemes.flatMap((scheme): RangeRow[] => {
            const values =
              scheme.disPerformance[component]?.fundClasses.flatMap((fund) => {
                const observation = fund.observations?.[period];
                return observation?.status === "verified" &&
                  typeof observation.value === "number"
                  ? [observation.value]
                  : [];
              }) ?? [];
            if (!values.length) return [];
            const min = Math.min(...values),
              max = Math.max(...values);
            const text = min === max ? `${min}%` : `${min}% – ${max}%`;
            return [
              {
                key: `${period}-${scheme.id}`,
                label: scheme.schemeName,
                sub: `${returnPeriodLabels[period]}年率化 · ${values.length} 個類別`,
                min,
                max,
                marker:
                  min === max
                    ? { value: min, label: `${scheme.schemeName} ${text}` }
                    : undefined,
                value: text,
                summary: `${componentLabel} ${returnPeriodLabels[period]}：${scheme.schemeName} ${text}（${values.length} 個合資格基金類別）`,
              },
            ];
          }),
        );
        return rows.length ? (
          <RangeChart
            key={component}
            title={`${componentLabel}：各期間官方年率化回報`}
            subtitle="只畫未過期、已核實的官方數值；多個基金類別時顯示最低至最高，不取中點"
            legend={[
              { label: "單一類別數值", color: "var(--kw-viz-2)", shape: "dot" },
              { label: "多個類別的範圍", color: "var(--kw-viz-context)" },
            ]}
            rows={rows}
            note="過期、未核實或官方未提供的期間不繪圖，請以上表及逐筆披露核對；不同期間是獨立披露，不構成時間走勢。"
          />
        ) : null;
      })}
      <ValueBars
        label="FER 中位數（本站統計）"
        rows={schemes.map((scheme) => ({
          label: scheme.schemeName,
          value: scheme.fer ? Number(scheme.fer.median.toFixed(5)) : null,
          note: scheme.fer
            ? "範圍 " +
              formatRange(scheme.fer) +
              " · " +
              scheme.fer.fundCount +
              " 個有值樣本；原值見基金詳情"
            : "官方未提供",
        }))}
      />
      <p className="kw-muted">
        每幅圖使用自己的實際單位及共同零起點，不作標準分或總分。DIS
        多類別回報範圍保留於上表；不把範圍中點當作官方回報。
      </p>
    </div>
  );
}

export function SchemeComparePage({
  apiBaseUrl,
  search = typeof window === "undefined" ? "" : window.location.search,
}: {
  apiBaseUrl: string;
  search?: string;
}) {
  const ids = useMemo(() => parseSchemeIds(search), [search]);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [schemeList, setSchemeList] = useState<LineupScheme[] | null>(null);

  useEffect(() => {
    if (ids.length === 0) return;
    const controller = new AbortController();
    fetch(`${apiBaseUrl}/schemes`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Schemes unavailable");
        return response.json() as Promise<unknown>;
      })
      .then((payload) =>
        setSchemeList(
          Array.isArray(payload) ? (payload as LineupScheme[]) : [],
        ),
      )
      .catch(() => {
        if (!controller.signal.aborted) setSchemeList([]);
      });
    return () => controller.abort();
  }, [apiBaseUrl, ids]);
  const lineup = ids
    .map((id) => schemeList?.find((scheme) => scheme.schemeName === id))
    .filter((scheme): scheme is LineupScheme => scheme !== undefined);

  useEffect(() => {
    if (ids.length === 0) {
      setResult(null);
      setFailed(false);
      setErrorMessage("請先在計劃比較頁勾選 1 至 4 個計劃。");
      return;
    }
    setResult(null);
    setFailed(false);
    setErrorMessage(null);
    const query = ids.map(encodeURIComponent).join(",");
    fetch(`${apiBaseUrl}/schemes/compare?ids=${query}`)
      .then(async (response) => {
        const body = (await response.json()) as CompareResponse;
        if (!response.ok) {
          setErrorMessage(
            body.error ??
              (response.status === 404
                ? "找不到所選計劃"
                : "未能取得計劃比較資料"),
          );
          setFailed(true);
          return;
        }
        setResult(body);
      })
      .catch(() => {
        setFailed(true);
        setErrorMessage("未能取得計劃比較資料");
      });
  }, [apiBaseUrl, ids]);

  return (
    <SiteChrome
      current="schemes"
      eyebrow="香港強積金比較"
      title="計劃逐項比較"
      subtitle="一次最多比較 4 個計劃。表格列出可追溯數字；圖表使用實際單位，不會合成評分。"
    >
      <p className="kw-compare-back">
        <a href="/schemes">返回計劃概覽</a>
      </p>
      {ids.length > 0 && <SchemePicker all={schemeList} selected={ids} />}

      {ids.length === 0 && (
        <p className="kw-status kw-status--warning">
          {errorMessage} <a href="/schemes">返回勾選計劃</a>
        </p>
      )}

      {ids.length > 0 && result === null && !failed && (
        <p className="kw-status">正在載入計劃比較…</p>
      )}

      {failed && (
        <p className="kw-status kw-status--negative">
          {errorMessage ?? "未能取得計劃比較資料"}{" "}
          <a href="/schemes">返回計劃概覽</a>
        </p>
      )}

      {result && (
        <>
          <section
            className="kw-section"
            aria-labelledby="scheme-compare-table-title"
          >
            <h2 className="kw-section__heading" id="scheme-compare-table-title">
              逐項對比
            </h2>
            <p className="kw-muted">快照 {result.snapshotId ?? "尚未發布"}。</p>
            <p className="kw-table-hint" id="scheme-compare-scroll-hint">
              左右滑動或使用方向鍵查看其餘欄位
            </p>
            <div
              className="kw-table-scroll"
              tabIndex={0}
              role="region"
              aria-label="計劃逐項比較表"
              aria-describedby="scheme-compare-scroll-hint"
              onKeyDown={(event) => {
                if (
                  event.altKey ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey ||
                  (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
                ) {
                  return;
                }
                const element = event.currentTarget;
                const offset = event.key === "ArrowRight" ? 80 : -80;
                const nextScrollLeft = Math.max(
                  0,
                  Math.min(
                    element.scrollLeft + offset,
                    element.scrollWidth - element.clientWidth,
                  ),
                );
                if (nextScrollLeft === element.scrollLeft) return;
                event.preventDefault();
                element.scrollLeft = nextScrollLeft;
              }}
            >
              <table className="kw-table scheme-compare-table">
                <thead>
                  <tr>
                    <th scope="col">項目</th>
                    {result.schemes.map((scheme) => (
                      <th scope="col" key={scheme.id}>
                        {scheme.schemeName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">受託人</th>
                    {result.schemes.map((scheme) => (
                      <td key={scheme.id}>{scheme.trusteeName}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">獨立成分基金數目</th>
                    {result.schemes.map((scheme) => (
                      <td key={scheme.id}>{scheme.fundChoiceCount}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">基金類別數目</th>
                    {result.schemes.map((scheme) => (
                      <td key={scheme.id}>{scheme.fundClassCount}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">DIS 成分覆蓋</th>
                    {result.schemes.map((scheme) => {
                      const incomplete =
                        scheme.disPerformance.status === "incomplete";
                      return (
                        <td
                          key={scheme.id}
                          className={
                            incomplete
                              ? "scheme-compare-table__incomplete"
                              : undefined
                          }
                        >
                          {incomplete ? (
                            <>
                              <span className="scheme-compare-badge">
                                不完整
                              </span>
                              <small className="kw-fee-note">
                                缺少
                                {scheme.disPerformance.missing
                                  .map((item) => missingLabels[item])
                                  .join("、")}
                                ，整項 DIS 表現不作比較。
                              </small>
                            </>
                          ) : (
                            <span className="scheme-compare-badge scheme-compare-badge--ok">
                              成分齊備
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {(["coreAccumulation", "age65Plus"] as const).map(
                    (component) => {
                      const title =
                        component === "coreAccumulation"
                          ? "核心累積基金"
                          : "65歲後基金";
                      return returnPeriods.map((period) => (
                        <tr key={`${component}-${period}`}>
                          <th scope="row">
                            {title} · {returnPeriodLabels[period]}
                          </th>
                          {result.schemes.map((scheme) => {
                            const incomplete =
                              scheme.disPerformance.status === "incomplete";
                            const band =
                              scheme.disPerformance[component]?.returns[
                                period
                              ] ?? null;
                            const observations =
                              scheme.disPerformance[component]?.fundClasses
                                .map((fund) => fund.observations?.[period])
                                .filter((row) => row?.value != null) ?? [];
                            const staleCount = observations.filter(
                              (row) => row?.status === "stale",
                            ).length;
                            const unverifiedCount = observations.filter(
                              (row) => row?.status === "unverified",
                            ).length;
                            return (
                              <td
                                key={scheme.id}
                                className={
                                  incomplete
                                    ? "scheme-compare-table__incomplete"
                                    : undefined
                                }
                              >
                                {incomplete
                                  ? "不完整，不顯示"
                                  : formatRange(band)}
                                {!incomplete && band && (
                                  <small className="kw-fee-note">
                                    歷史披露；{staleCount} 筆過期，
                                    {unverifiedCount}{" "}
                                    筆未核實。逐筆日期及來源見下方披露。
                                  </small>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    },
                  )}
                  <tr>
                    <th scope="row">FER 範圍</th>
                    {result.schemes.map((scheme) => (
                      <td key={scheme.id}>
                        {scheme.fer ? (
                          <>
                            <span className="kw-nowrap">
                              {formatRange(scheme.fer)}
                            </span>
                            <small className="kw-fee-note">
                              中位數{" "}
                              {formatPercent(
                                Number(scheme.fer.median.toFixed(5)),
                              )}
                              ；{scheme.fer.fundCount} 隻有 FER
                            </small>
                          </>
                        ) : (
                          "官方未提供"
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <DisSources schemes={result.schemes} />

          {lineup.length > 0 && (
            <section
              className="kw-section"
              aria-labelledby="scheme-lineup-title"
            >
              <h2 className="kw-section__heading" id="scheme-lineup-title">
                同類基金對照
              </h2>
              <p className="kw-muted">
                每行一個積金局基金類型，列出各計劃喺該類型提供的基金；一年回報及開支比率為官方原值，「過期」表示超出網站時效門檻。
              </p>
              <LineupMatrix schemes={lineup} />
            </section>
          )}
          <section
            className="kw-section"
            aria-labelledby="scheme-compare-radar-title"
          >
            <h2 className="kw-section__heading" id="scheme-compare-radar-title">
              逐項數據圖
            </h2>
            <p className="kw-muted">
              逐項比較實際數量及百分比，缺失數據不繪成零；不同指標不能合成推薦分數。
            </p>
            <SchemeCompareCharts schemes={result.schemes} />
          </section>
        </>
      )}
    </SiteChrome>
  );
}
