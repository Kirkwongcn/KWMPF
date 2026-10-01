import { useEffect, useState } from "react";
import {
  Histogram,
  Scatter,
  StatTiles,
  formatDerived,
  median,
  useWhenVisible,
} from "./Charts";
import { fundClassLabel, joinFundParts } from "./fundClassLabel";

type MarketRow = {
  fundClassId: string;
  fundClassName: string;
  constituentFundName: string;
  schemeName: string;
  value: number;
  displayValue: string;
  feeCap?: boolean;
  dataAsOf: string;
};
type MarketPublication = { snapshotId: string; rankings: MarketRow[] };
type View = "returns" | "riskReturn" | "fees";
type Period = "1" | "3" | "5" | "10";
const periodLabel: Record<Period, string> = {
  "1": "一年",
  "3": "三年",
  "5": "五年",
  "10": "十年",
};

function load(url: string, signal: AbortSignal) {
  return fetch(url, { signal }).then((response) => {
    if (!response.ok) throw new Error("Unavailable");
    return response.json() as Promise<MarketPublication>;
  });
}

/** Whole-market view of official values from one published snapshot. */
export function MarketOverview({
  apiOrigin,
  snapshotId,
}: {
  apiOrigin: string;
  snapshotId: string;
}) {
  const { ref, visible, supported, reveal } = useWhenVisible<HTMLElement>();
  const [view, setView] = useState<View>("returns");
  const [period, setPeriod] = useState<Period>("1");
  const [data, setData] = useState<{
    returns: MarketPublication;
    risk?: MarketPublication;
    fees?: MarketPublication;
  } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    setFailed(false);
    Promise.all([
      load(`${apiOrigin}/rankings?period=${period}`, controller.signal),
      view === "riskReturn"
        ? load(`${apiOrigin}/rankings?metric=risk`, controller.signal)
        : Promise.resolve(undefined),
      view === "fees"
        ? load(`${apiOrigin}/rankings?metric=fee`, controller.signal)
        : Promise.resolve(undefined),
    ])
      .then(([returns, risk, fees]) => {
        const all = [returns, risk, fees].filter(
          Boolean,
        ) as MarketPublication[];
        if (
          all.some(
            (item) =>
              item.snapshotId !== snapshotId || !Array.isArray(item.rankings),
          )
        )
          throw new Error("Snapshot changed");
        setData({ returns, risk, fees });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [apiOrigin, snapshotId, visible, view, period]);

  const label = (row: MarketRow) =>
    joinFundParts(row.constituentFundName, fundClassLabel(row.fundClassName));
  const returnValues = data?.returns.rankings.map((row) => row.value) ?? [];
  const returnMedian = median(returnValues);
  const feeValues = data?.fees?.rankings.map((row) => row.value) ?? [];
  const feeMedian = median(feeValues);
  const riskById = new Map(
    (data?.risk?.rankings ?? []).map((row) => [row.fundClassId, row]),
  );
  const points = (data?.returns.rankings ?? []).flatMap((row) => {
    const risk = riskById.get(row.fundClassId);
    return risk
      ? [
          {
            x: risk.value,
            y: row.value,
            label: label(row),
            detail: `${row.schemeName} · 截至 ${row.dataAsOf}`,
            href: `/fund-classes/${encodeURIComponent(row.fundClassId)}`,
          },
        ]
      : [];
  });
  const positive = returnValues.filter((value) => value > 0).length;

  return (
    <section className="kw-market" aria-labelledby="market-title" ref={ref}>
      <header className="kw-section-head">
        <p className="kw-section-head__kicker">市場概覽</p>
        <h2 id="market-title">全市場官方數據，一張圖看分布</h2>
        <p className="kw-muted">
          只用同一發布快照內已核實的官方數值；分組、中位數由本站按原值計算，不代表推薦或預測。
        </p>
      </header>
      <div className="kw-filter-row" role="group" aria-label="市場概覽篩選">
        <div className="kw-segmented" role="group" aria-label="圖表">
          {(
            [
              ["returns", "回報分布"],
              ["riskReturn", "風險與回報"],
              ["fees", "管理費分布"],
            ] as const
          ).map(([key, text]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
            >
              {text}
            </button>
          ))}
        </div>
        {view !== "fees" && (
          <p className="kw-field kw-field--inline">
            <label htmlFor="market-period">回報期間</label>
            <select
              className="kw-control"
              id="market-period"
              value={period}
              onChange={(event) => setPeriod(event.target.value as Period)}
            >
              {(Object.keys(periodLabel) as Period[]).map((key) => (
                <option key={key} value={key}>
                  {periodLabel[key]}
                </option>
              ))}
            </select>
          </p>
        )}
      </div>
      {!visible ? (
        <p className="kw-status">
          {supported ? (
            "捲動至此時載入市場概覽…"
          ) : (
            <button className="kw-button" type="button" onClick={reveal}>
              載入市場概覽
            </button>
          )}
        </p>
      ) : failed ? (
        <p className="kw-status kw-status--negative" role="status">
          暫時未能取得市場概覽；其他頁面的已發布資料不受影響。
        </p>
      ) : !data ? (
        <p className="kw-status" role="status" aria-live="polite">
          正在讀取市場概覽…
        </p>
      ) : (
        <div className="kw-market__body">
          <StatTiles
            label="市場概覽摘要"
            className="kw-stats--compact"
            items={
              view === "fees"
                ? [
                    {
                      label: "有官方管理費的基金",
                      value: feeValues.length,
                    },
                    {
                      label: "中位數（本站計算）",
                      value:
                        feeMedian === undefined
                          ? "未取得"
                          : formatDerived(feeMedian),
                    },
                    {
                      label: "最低／最高",
                      value: data.fees?.rankings.length
                        ? (() => {
                            const sorted = [...data.fees.rankings].sort(
                              (a, b) => a.value - b.value,
                            );
                            return `${sorted[0]!.displayValue}／${sorted[sorted.length - 1]!.displayValue}`;
                          })()
                        : "未取得",
                      note: "按官方原值",
                    },
                  ]
                : [
                    {
                      label: `${periodLabel[period]}回報合資格基金`,
                      value: returnValues.length,
                    },
                    {
                      label: "中位數（本站計算）",
                      value:
                        returnMedian === undefined
                          ? "未取得"
                          : formatDerived(returnMedian),
                    },
                    {
                      label: "正回報基金",
                      value: `${positive} 隻`,
                      note: returnValues.length
                        ? `佔 ${formatDerived((positive / returnValues.length) * 100)}`
                        : undefined,
                    },
                  ]
            }
          />
          {view === "returns" && (
            <Histogram
              title={`${periodLabel[period]}年率化回報分布`}
              subtitle="每柱代表一個回報區間內的基金類別數目"
              values={returnValues}
              markers={
                returnMedian === undefined
                  ? []
                  : [
                      {
                        value: returnMedian,
                        label: `中位數 ${formatDerived(returnMedian)}`,
                      },
                    ]
              }
              note="不同基金種類的回報不宜直接比較；同類比較請用基金排名。過往表現不代表未來結果。"
            />
          )}
          {view === "riskReturn" && (
            <Scatter
              title={`${periodLabel[period]}回報與波幅`}
              subtitle="每點一個基金類別；指向圓點查看基金，點擊開啟詳情"
              points={points}
              xLabel="波幅（三年年度化標準差）"
              yLabel={`${periodLabel[period]}年率化回報`}
              note={`波幅為官方「基金風險指標」，固定量度過去三年；與所選回報期間長度未必相同，只作並列參考，不是風險調整後回報。只列兩項數值均可用的 ${points.length} 隻基金。`}
            />
          )}
          {view === "fees" && (
            <Histogram
              title="當前管理費分布"
              subtitle="每柱代表一個費率區間內的基金類別數目"
              values={feeValues}
              markers={
                feeMedian === undefined
                  ? []
                  : [
                      {
                        value: feeMedian,
                        label: `中位數 ${formatDerived(feeMedian)}`,
                      },
                    ]
              }
              note="管理費不等於總開支；基金開支比率（FER）見各基金詳情。官方以上限披露的費率按上限值計入。"
            />
          )}
        </div>
      )}
    </section>
  );
}
