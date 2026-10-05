import { useEffect, useMemo, useState } from "react";
import { SiteChrome } from "./SiteChrome";
import { fundClassLabel, joinFundParts } from "./fundClassLabel";
import { ValueBars } from "./DataCharts";
import {
  Histogram,
  RangeChart,
  StatTiles,
  formatDerived,
  median,
} from "./Charts";
import { useViewMode } from "./viewMode";
import { downloadCsv } from "./downloadCsv";
import { CompareToggle } from "./CompareTray";

// 只用嚟排次序；分組按官方類型名稱「大類 - 細類」嘅大類，兩個貨幣市場大類各自獨立。
const FAMILY_ORDER = [
  "股票基金",
  "混合資產基金",
  "債券基金",
  "保證基金",
  "貨幣市場基金 — 強積金保守基金",
  "貨幣市場基金 — 不包括強積金保守基金",
];

function familyOf(group: string) {
  return group.split(" - ")[0] ?? group;
}

/** 未揀類型時先揀積金局基金類型；數目係該類型合資格基金，唔係跨類型排名。 */
function TypePicker({
  groups,
  rows,
  onPick,
}: {
  groups: string[];
  rows: RankingRow[];
  onPick: (group: string) => void;
}) {
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(row.comparisonGroup, (counts.get(row.comparisonGroup) ?? 0) + 1);
  const families = new Map<string, string[]>();
  for (const group of groups) {
    const family = familyOf(group);
    families.set(family, [...(families.get(family) ?? []), group]);
  }
  const ordered = [...families.keys()].sort(
    (a, b) =>
      (FAMILY_ORDER.indexOf(a) + 1 || 99) - (FAMILY_ORDER.indexOf(b) + 1 || 99),
  );
  return (
    <div className="kw-type-picker">
      <h3>先揀一個積金局基金類型</h3>
      <p className="kw-muted">
        排名只喺同一類型入面比較。數字係該類型目前合資格的基金數目。
      </p>
      {ordered.map((family) => (
        <section key={family} aria-label={family}>
          <h4>{family}</h4>
          <ul>
            {families.get(family)!.map((group) => (
              <li key={group}>
                <button type="button" onClick={() => onPick(group)}>
                  <span>{group}</span>
                  <strong>{counts.get(group) ?? 0}</strong>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

type RankingRow = {
  fundClassId: string;
  fundClassName: string;
  constituentFundName: string;
  schemeName: string;
  trusteeName: string;
  comparisonGroup: string;
  displayValue: string;
  value: number;
  feeCap?: boolean;
  rank: number;
  dataAsOf: string;
  sourceUrl: string;
};

type PublishedRankings = {
  snapshotId: string;
  periodYears: number;
  comparisonGroups?: string[];
  excludedStaleCount?: number;
  methodology?: {
    freshness?: { graceDays: number; evaluatedOn: string };
    classification?: {
      provider: string;
      capturedAt: string;
      official: true;
    } | null;
  };
  rankings: RankingRow[];
};

const periodLabels = {
  "1": "一年",
  "3": "三年",
  "5": "五年",
  "10": "十年",
} as const;

type RankingPeriod = keyof typeof periodLabels;

type RankingMetric = "return" | "fee" | "risk";

const metricLabels = {
  return: "年率化回報",
  risk: "波幅（低至高）",
  fee: "管理費（低至高）",
} as const;

export function RankingsPage({
  apiBaseUrl,
  initialPeriod = "1",
  initialComparisonGroup = "all",
  initialMetric = "return",
}: {
  apiBaseUrl: string;
  initialPeriod?: RankingPeriod;
  initialComparisonGroup?: string;
  initialMetric?: RankingMetric;
}) {
  const [publication, setPublication] = useState<PublishedRankings | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const [comparisonGroup, setComparisonGroup] = useState(
    initialComparisonGroup,
  );
  const [period, setPeriod] = useState<RankingPeriod>(initialPeriod);
  const [metric, setMetric] = useState<RankingMetric>(initialMetric);
  const [mode] = useViewMode();
  const [display, setDisplay] = useState<"table" | "chart">(() =>
    new URLSearchParams(window.location.search).get("display") === "chart"
      ? "chart"
      : "table",
  );
  const [chartKind, setChartKind] = useState<"dot" | "bar">("dot");

  function pushRankingUrl(
    nextMetric: RankingMetric,
    nextPeriod: RankingPeriod,
    nextGroup: string,
    nextDisplay = display,
  ) {
    const params = new URLSearchParams(window.location.search);
    for (const key of ["metric", "period", "group"]) params.delete(key);
    if (nextMetric === "return") params.set("period", nextPeriod);
    else params.set("metric", nextMetric);
    if (nextGroup !== "all") params.set("group", nextGroup);
    if (nextDisplay === "chart") params.set("display", "chart");
    else params.delete("display");
    window.history.pushState(
      {},
      "",
      `${window.location.pathname}?${params.toString()}`,
    );
  }

  useEffect(() => {
    function restoreRankingUrl() {
      const params = new URLSearchParams(window.location.search);
      const requestedPeriod = params.get("period");
      const nextPeriod: RankingPeriod =
        requestedPeriod === "3" ||
        requestedPeriod === "5" ||
        requestedPeriod === "10"
          ? requestedPeriod
          : "1";
      const requestedMetric = params.get("metric");
      const nextMetric: RankingMetric =
        requestedMetric === "fee" || requestedMetric === "risk"
          ? requestedMetric
          : "return";
      setPeriod(nextPeriod);
      setMetric(nextMetric);
      setComparisonGroup(params.get("group") ?? "all");
      setDisplay(params.get("display") === "chart" ? "chart" : "table");
    }
    window.addEventListener("popstate", restoreRankingUrl);
    return () => window.removeEventListener("popstate", restoreRankingUrl);
  }, []);

  useEffect(() => {
    setPublication(null);
    setFailed(false);
    const controller = new AbortController();
    const query = metric === "return" ? `period=${period}` : `metric=${metric}`;
    fetch(`${apiBaseUrl}/rankings?${query}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Rankings unavailable");
        return response.json() as Promise<PublishedRankings>;
      })
      .then(setPublication)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [apiBaseUrl, period, metric]);

  // 舊網址可能帶著已停用的組別（例如 Lipper 分類）。快照內完全沒有這個組別時退回「全部」，
  // 並說明分類口徑已改；組別仍然存在但今期沒有合資格數值的情況維持原狀。
  const retiredGroup =
    publication?.comparisonGroups &&
    comparisonGroup !== "all" &&
    !publication.comparisonGroups.includes(comparisonGroup)
      ? comparisonGroup
      : null;
  const effectiveGroup = retiredGroup ? "all" : comparisonGroup;
  const comparisonGroups = useMemo(
    () =>
      [
        ...new Set([
          ...(publication?.comparisonGroups ?? []),
          ...(publication?.rankings.map((row) => row.comparisonGroup) ?? []),
          ...(effectiveGroup === "all" ? [] : [effectiveGroup]),
        ]),
      ].sort((a, b) => a.localeCompare(b)),
    [publication, effectiveGroup],
  );
  const rankings =
    effectiveGroup === "all"
      ? publication?.rankings
      : publication?.rankings.filter(
          (row) => row.comparisonGroup === effectiveGroup,
        );

  const valueLabel =
    metric === "return"
      ? `${periodLabels[period]}回報`
      : metric === "fee"
        ? "管理費"
        : "波幅";
  const subtitle =
    metric === "return"
      ? `只在同一積金局基金類型內比較，名次按官方${periodLabels[period]}年率化回報排列。`
      : metric === "fee"
        ? "只在同一積金局基金類型內比較，名次按官方當前管理費由低至高排列。"
        : "只在同一積金局基金類型內比較，名次按官方基金風險指標（年度化標準差）由低至高排列。";

  return (
    <SiteChrome
      current="rankings"
      eyebrow="同組基金比較"
      title={`${valueLabel}排名`}
      subtitle={subtitle}
      titleBlock={[
        { label: "分類", value: "積金局基金類型" },
        { label: "名次", value: "同一類型內、單一官方指標" },
        { label: "來源", value: "積金局強積金基金平台、受託人便覽" },
      ]}
    >
      <section className="kw-section" aria-labelledby="ranking-table-title">
        <h2 className="kw-section__heading" id="ranking-table-title">
          已發布基金排名
        </h2>
        <div className="kw-toolbar">
          <div className="kw-toolbar__controls">
            <p className="kw-field">
              <label htmlFor="ranking-metric">排序指標</label>
              <select
                className="kw-control"
                id="ranking-metric"
                value={metric}
                onChange={(event) => {
                  const nextMetric = event.target.value as RankingMetric;
                  setMetric(nextMetric);
                  pushRankingUrl(nextMetric, period, effectiveGroup);
                }}
              >
                {Object.entries(metricLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </p>
            {metric === "return" && (
              <p className="kw-field">
                <label htmlFor="ranking-period">回報期間</label>
                <select
                  className="kw-control"
                  id="ranking-period"
                  value={period}
                  onChange={(event) => {
                    const nextPeriod = event.target.value as RankingPeriod;
                    setPeriod(nextPeriod);
                    pushRankingUrl(metric, nextPeriod, effectiveGroup);
                  }}
                >
                  <option value="1">一年</option>
                  <option value="3">三年</option>
                  <option value="5">五年</option>
                  <option value="10">十年</option>
                </select>
              </p>
            )}
            <p className="kw-field">
              <label htmlFor="comparison-group">積金局基金類型</label>
              <select
                className="kw-control"
                id="comparison-group"
                value={publication ? effectiveGroup : "all"}
                disabled={!publication}
                aria-busy={!publication}
                onChange={(event) => {
                  setComparisonGroup(event.target.value);
                  pushRankingUrl(metric, period, event.target.value);
                }}
              >
                <option value="all">
                  {publication
                    ? "全部積金局基金類型"
                    : "正在載入積金局基金類型…"}
                </option>
                {publication &&
                  comparisonGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
              </select>
            </p>
          </div>
          <details className="kw-toolbar__notes" open={mode === "analysis"}>
            <summary>來源及比較方法（含基金類型說明）</summary>
            <p className="kw-muted">
              {metric === "return"
                ? "只採用官方已披露的年率化回報；沒有該期間數值的基金不會入榜，本站不會由其他期間推算。同一積金局基金類型內按回報由高至低排列。"
                : metric === "fee"
                  ? "管理費為官方公布的當前費率，不包括基金開支比率所涵蓋的歷史費用。"
                  : "波幅用官方公布的基金風險指標，即過去三年的年度化標準差。數字越低代表過往價格波動越小，不代表基金較佳或較適合你。成立不足三年的基金官方沒有這項數據，不會出現在此排名。"}
            </p>
            <p className="kw-muted">
              公開快照：
              {publication ? <code>{publication.snapshotId}</code> : "讀取中…"}
            </p>
            <p className="kw-muted">
              {publication?.methodology?.classification
                ? `排名只在同一積金局基金類型內比較；類型來自${publication.methodology.classification.provider}（擷取 ${publication.methodology.classification.capturedAt}），本站不另設分類；數值來自官方平台或受託人便覽，每筆保留自己的日期及來源。`
                : publication
                  ? "排名只在同一積金局基金類型內比較，本站不另設分類；數值來自官方平台或受託人便覽，每筆保留自己的日期及來源。"
                  : "積金局基金類型及官方數據載入中。"}
            </p>
          </details>
        </div>
        {failed ? (
          <p className="kw-status kw-status--negative" role="alert">
            暫時未能取得排名，現有公開快照不受影響，請稍後再試。
          </p>
        ) : !publication ? (
          <p className="kw-status" role="status" aria-live="polite">
            正在載入已發布排名…
          </p>
        ) : (
          <>
            {retiredGroup ? (
              <p className="kw-status kw-status--warning">
                {`分類已改為積金局基金類型，「${retiredGroup}」不是積金局基金類型，現顯示全部類型。`}
              </p>
            ) : null}
            {publication.excludedStaleCount ? (
              <p className="kw-status kw-status--warning">
                {`有 ${publication.excludedStaleCount} 隻基金的資料已超出網站時效門檻（${publication.methodology?.freshness?.graceDays ?? 45} 日），暫不列入排名。這些數值仍可在各基金詳情頁連同原截至日期查看。`}
              </p>
            ) : null}
            {effectiveGroup !== "all" && rankings?.length ? (
              <RankingSummary
                rows={rankings}
                metric={metric}
                valueLabel={valueLabel}
              />
            ) : null}
            {metric === "return" && period === "3" && (
              <p className="kw-gap-guidance">
                三年資料未齊或已過期時，可先比較{" "}
                <a href="/rankings?period=1">一年</a> 或{" "}
                <a href="/rankings?period=5">五年</a>；亦可{" "}
                <a href="/data-status">查看缺口及時效說明</a>
                。期間不同，結果須分開解讀。
              </p>
            )}
            {effectiveGroup === "all" ? (
              <>
                <TypePicker
                  groups={comparisonGroups}
                  rows={publication.rankings}
                  onPick={(group) => {
                    setComparisonGroup(group);
                    pushRankingUrl(metric, period, group);
                  }}
                />
                {publication.rankings.length > 0 && (
                  <GroupSpread
                    rows={publication.rankings}
                    metric={metric}
                    period={period}
                    valueLabel={valueLabel}
                  />
                )}
              </>
            ) : rankings?.length ? (
              <>
                <p className="kw-type-current">
                  <span>
                    積金局基金類型：<strong>{effectiveGroup}</strong>
                  </span>
                  <button
                    type="button"
                    className="kw-button kw-button--secondary"
                    onClick={() => {
                      setComparisonGroup("all");
                      pushRankingUrl(metric, period, "all");
                    }}
                  >
                    揀其他類型
                  </button>
                </p>
                <div className="kw-advanced kw-export">
                  <button
                    className="kw-button kw-button--secondary"
                    onClick={() =>
                      downloadCsv(`kwmpf-${metric}-${period}-ranking.csv`, [
                        [
                          "快照",
                          "基金類別 ID",
                          "官方基金名稱",
                          "類別",
                          "計劃",
                          "積金局基金類型",
                          "組内名次",
                          "指標",
                          "官方原值（%）",
                          "費率上限",
                          "截至日期",
                          "官方來源",
                        ],
                        ...rankings.map((row) => [
                          publication.snapshotId,
                          row.fundClassId,
                          row.constituentFundName,
                          row.fundClassName,
                          row.schemeName,
                          row.comparisonGroup,
                          row.rank,
                          valueLabel,
                          row.value,
                          row.feeCap ? "是" : "否",
                          row.dataAsOf,
                          row.sourceUrl,
                        ]),
                      ])
                    }
                  >
                    下載目前排名 CSV
                  </button>
                  <p className="kw-muted">
                    包含目前篩選的全部 {rankings.length}{" "}
                    筆；附來源、截至日期及快照。不同積金局基金類型的名次分開計算。
                  </p>
                </div>
                <div
                  className="kw-display-switch"
                  role="group"
                  aria-label="排名顯示方式"
                >
                  {(["table", "chart"] as const).map((choice) => (
                    <button
                      key={choice}
                      className="kw-button kw-button--secondary"
                      aria-pressed={display === choice}
                      onClick={() => {
                        setDisplay(choice);
                        pushRankingUrl(metric, period, effectiveGroup, choice);
                      }}
                    >
                      {choice === "table" ? "完整表格" : "同組圖表"}
                    </button>
                  ))}
                </div>
                {display === "chart" && effectiveGroup !== "all" && (
                  <div
                    className="kw-chart-controls"
                    role="group"
                    aria-label="圖表類型"
                  >
                    <span>圖表類型</span>
                    {(["dot", "bar"] as const).map((kind) => (
                      <button
                        key={kind}
                        className="kw-button kw-button--secondary"
                        aria-pressed={chartKind === kind}
                        onClick={() => setChartKind(kind)}
                      >
                        {kind === "dot" ? "點圖" : "橫條圖"}
                      </button>
                    ))}
                  </div>
                )}
                {display === "chart" &&
                  (effectiveGroup !== "all" ? (
                    <ValueBars
                      variant={chartKind}
                      label={`${effectiveGroup} · ${valueLabel}（${rankings.length === 1 ? "只有 1 個合資格觀察值" : `首 ${Math.min(10, rankings.length)} 個`}；切換完整表格查看全部及來源）`}
                      rows={rankings.slice(0, 10).map((row) => ({
                        label: joinFundParts(
                          row.constituentFundName,
                          fundClassLabel(row.fundClassName),
                        ),
                        value: row.value,
                        display: row.displayValue,
                        href: `/fund-classes/${encodeURIComponent(row.fundClassId)}`,
                        identifier: row.schemeName,
                        note: `截至 ${row.dataAsOf}${row.feeCap ? " · 費率上限" : ""}`,
                      }))}
                    />
                  ) : null)}
                {display === "chart" &&
                  effectiveGroup !== "all" &&
                  rankings.length > 2 && (
                    <Histogram
                      title={`${effectiveGroup} · ${valueLabel}分布`}
                      subtitle={`組內全部 ${rankings.length} 隻合資格基金；每柱代表一個數值區間內的基金數目`}
                      values={rankings.map((row) => row.value)}
                      markers={(() => {
                        const middle = median(rankings.map((row) => row.value));
                        return middle === undefined
                          ? []
                          : [
                              {
                                value: middle,
                                label: `中位數 ${formatDerived(middle)}`,
                              },
                            ];
                      })()}
                      binTarget={12}
                      note="分組及中位數由本站按官方原值計算；完整原值、日期及來源見完整表格。"
                    />
                  )}
                <p
                  className="kw-muted"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {effectiveGroup === "all"
                    ? `目前顯示 ${rankings.length} 隻合資格基金。`
                    : `「${effectiveGroup}」目前有 ${rankings.length} 隻合資格基金。`}
                </p>
                {display === "table" && (
                  <>
                    <p className="kw-table-hint" id="ranking-table-scroll-hint">
                      左右滑動或使用方向鍵查看其餘欄位
                    </p>
                    <div
                      className="kw-table-wrap"
                      role="region"
                      aria-label="基金排名結果"
                      aria-describedby="ranking-table-scroll-hint"
                      onKeyDown={(event) => {
                        if (
                          (event.key !== "ArrowLeft" &&
                            event.key !== "ArrowRight") ||
                          event.altKey ||
                          event.ctrlKey ||
                          event.metaKey
                        ) {
                          return;
                        }

                        const container = event.currentTarget;
                        const maxScrollLeft = Math.max(
                          0,
                          container.scrollWidth - container.clientWidth,
                        );
                        const direction = event.key === "ArrowRight" ? 1 : -1;
                        const roundedStep = Math.ceil(
                          Math.max(120, container.clientWidth * 0.75),
                        );
                        const nextScrollLeft = Math.min(
                          maxScrollLeft,
                          Math.max(
                            0,
                            container.scrollLeft + direction * roundedStep,
                          ),
                        );

                        if (nextScrollLeft === container.scrollLeft) return;
                        event.preventDefault();
                        container.scrollTo({
                          left: nextScrollLeft,
                          behavior: "auto",
                        });
                      }}
                    >
                      <table className="kw-table">
                        <thead>
                          <tr>
                            <th
                              scope="col"
                              tabIndex={0}
                              aria-describedby="ranking-table-scroll-hint"
                            >
                              名次
                            </th>
                            <th scope="col">
                              <span className="kw-visually-hidden">比較</span>
                            </th>
                            <th scope="col">基金</th>
                            <th scope="col">{valueLabel}</th>
                            <th scope="col">積金局基金類型</th>
                            <th scope="col">截至日期</th>
                            <th scope="col">來源</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rankings.map((row) => (
                            <tr key={row.fundClassId}>
                              <td className="kw-rank">第 {row.rank}</td>
                              <td>
                                <CompareToggle
                                  compact
                                  item={{
                                    id: row.fundClassId,
                                    label: joinFundParts(
                                      row.constituentFundName,
                                      fundClassLabel(row.fundClassName),
                                      row.schemeName,
                                    ),
                                    group: row.comparisonGroup,
                                  }}
                                />
                              </td>
                              <td className="kw-table__name">
                                <a
                                  href={`/fund-classes/${encodeURIComponent(row.fundClassId)}`}
                                  aria-label={`查看 ${row.constituentFundName} 詳情`}
                                >
                                  {row.constituentFundName}
                                </a>
                                <small>
                                  {joinFundParts(
                                    fundClassLabel(row.fundClassName),
                                    row.schemeName,
                                  )}
                                </small>
                              </td>
                              <td className="kw-return">
                                {row.displayValue}
                                {row.feeCap ? "（上限）" : ""}
                              </td>
                              <td>{row.comparisonGroup}</td>
                              <td className="kw-nowrap">{row.dataAsOf}</td>
                              <td className="kw-nowrap">
                                <a
                                  href={row.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label={`${row.constituentFundName} 官方來源`}
                                >
                                  官方來源
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            ) : (
              <p
                className="kw-status kw-status--warning"
                role="status"
                aria-live="polite"
              >
                這個積金局基金類型目前沒有合資格的{valueLabel}資料。
              </p>
            )}
            <p className="disclaimer">
              排名只反映同一積金局基金類型內的單一官方指標，回報、費用及風險分開排序，不會合成推薦總分；過往表現不代表未來結果。
            </p>
          </>
        )}
      </section>
    </SiteChrome>
  );
}

function RankingSummary({
  rows,
  metric,
  valueLabel,
}: {
  rows: RankingRow[];
  metric: RankingMetric;
  valueLabel: string;
}) {
  const sorted = [...rows].sort((a, b) => a.value - b.value);
  const lowest = sorted[0]!,
    highest = sorted[sorted.length - 1]!;
  const middle = median(rows.map((row) => row.value));
  const name = (row: RankingRow) =>
    joinFundParts(row.constituentFundName, fundClassLabel(row.fundClassName));
  return (
    <StatTiles
      label="目前篩選摘要"
      className="kw-stats--compact"
      items={[
        { label: "合資格基金", value: `${rows.length} 隻` },
        {
          label: `${valueLabel}中位數（本站計算）`,
          value: middle === undefined ? "未取得" : formatDerived(middle),
        },
        {
          label: "範圍（官方原值）",
          value: `${lowest.displayValue} 至 ${highest.displayValue}`,
          note:
            metric === "return"
              ? `最高：${name(highest)}`
              : `最低：${name(lowest)}`,
        },
      ]}
    />
  );
}

/** Side-by-side spread per comparison group — a context view, never a cross-group ranking. */
function GroupSpread({
  rows,
  metric,
  period,
  valueLabel,
}: {
  rows: RankingRow[];
  metric: RankingMetric;
  period: RankingPeriod;
  valueLabel: string;
}) {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    // 只用有限數值；缺值唔當 0，亦唔令圖表崩潰。
    if (typeof row.value !== "number" || !Number.isFinite(row.value)) continue;
    groups.set(row.comparisonGroup, [
      ...(groups.get(row.comparisonGroup) ?? []),
      row.value,
    ]);
  }
  if (groups.size === 0) return null;
  const spread = [...groups.entries()]
    .map(([group, values]) => ({
      group,
      values,
      min: Math.min(...values),
      max: Math.max(...values),
      median: median(values)!,
    }))
    .sort((a, b) =>
      metric === "return" ? b.median - a.median : a.median - b.median,
    );
  const query = (group: string) => {
    const params = new URLSearchParams();
    if (metric === "return") params.set("period", period);
    else params.set("metric", metric);
    params.set("group", group);
    params.set("display", "chart");
    return `/rankings?${params.toString()}`;
  };
  return (
    <RangeChart
      title={`各積金局基金類型的${valueLabel}分布`}
      subtitle="灰線為組內最低至最高，黑線為中位數；只作並列參考，不是跨類型排名"
      legend={[
        { label: "組內範圍（官方原值）", color: "var(--kw-viz-context)" },
        { label: "中位數（本站計算）", color: "var(--kw-ink)", shape: "line" },
      ]}
      rows={spread.map((item) => ({
        key: item.group,
        label: <a href={query(item.group)}>{item.group}</a>,
        min: item.min,
        max: item.max,
        median: item.median,
        count: item.values.length,
        summary: `${item.group}：${item.values.length} 隻，範圍 ${item.min}% 至 ${item.max}%，中位數 ${formatDerived(item.median)}（本站計算）`,
      }))}
      note="不同積金局基金類型的投資範圍及風險不同，跨類型並列不代表優劣。點擊類型名稱查看該類型完整排名圖表。"
      table={{
        caption: `各積金局基金類型的${valueLabel}分布`,
        columns: [
          "積金局基金類型",
          "基金數目",
          "最低",
          "中位數（本站計算）",
          "最高",
        ],
        rows: spread.map((item) => [
          item.group,
          `${item.values.length}`,
          `${item.min}%`,
          formatDerived(item.median),
          `${item.max}%`,
        ]),
      }}
    />
  );
}
