import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  MPFA_FUND_TYPES,
  mpfaFundTypeByName,
} from "../../../packages/coverage/src/mpfa-fund-type";
import {
  formatDerived,
  formatTick,
  median,
  niceTicks,
  Tooltip,
  useChartWidth,
  useTooltip,
} from "./Charts";
import { fundClassLabel, joinFundParts } from "./fundClassLabel";

type RankingRow = {
  fundClassId: string;
  fundClassName: string;
  constituentFundName: string;
  schemeName: string;
  comparisonGroup: string;
  value: number;
  displayValue: string;
  dataAsOf: string;
};
type Rankings = { snapshotId: string; rankings: RankingRow[] };

export type { RankingRow };

export type AtlasPoint = {
  id: string;
  label: string;
  scheme: string;
  type: string;
  family: string;
  risk: RankingRow;
  ret: RankingRow;
};

/** 積金局六個基金類別，依平台篩選次序。 */
export const MPFA_FAMILIES = [
  ...new Set(MPFA_FUND_TYPES.map((type) => type.family.zh)),
];

const HIGHLIGHT = "#00879f";
const CONTEXT = "#b4bfc1";
const GRID_LETTERS = "ABCDEFGH";

/** 本站計算：四分位數（線性插值）。只用於圖形分布框，標明本站計算。 */
export function quantile(values: number[], q: number) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return undefined;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return (
    sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower)
  );
}

function load(url: string, signal: AbortSignal) {
  return fetch(url, { signal }).then((response) => {
    if (!response.ok) throw new Error("Unavailable");
    return response.json() as Promise<Rankings>;
  });
}

/** 一年回報與三年波幅兩份已發布排名，按基金類別配對；兩項都有已核實數值才入圖。 */
export function useAtlasData(apiOrigin: string, snapshotId: string | null) {
  const [data, setData] = useState<{
    points: AtlasPoint[];
    returns: RankingRow[];
  } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!snapshotId) return;
    const controller = new AbortController();
    Promise.all([
      load(`${apiOrigin}/rankings?period=1`, controller.signal),
      load(`${apiOrigin}/rankings?metric=risk`, controller.signal),
    ])
      .then(([returns, risk]) => {
        if (returns.snapshotId !== snapshotId || risk.snapshotId !== snapshotId)
          throw new Error("Snapshot changed");
        const riskById = new Map(
          risk.rankings.map((row) => [row.fundClassId, row]),
        );
        const points = returns.rankings.flatMap((ret) => {
          const riskRow = riskById.get(ret.fundClassId);
          const type = mpfaFundTypeByName(ret.comparisonGroup);
          if (!riskRow || !type) return [];
          return [
            {
              id: ret.fundClassId,
              label: joinFundParts(
                ret.constituentFundName,
                fundClassLabel(ret.fundClassName),
              ),
              scheme: ret.schemeName,
              type: type.zh,
              family: type.family.zh,
              risk: riskRow,
              ret,
            },
          ];
        });
        setData({ points, returns: returns.rankings });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [apiOrigin, snapshotId]);
  return { data, failed };
}

/**
 * 強積金基金圖：每隻基金類別一個測量點（橫：三年波幅；縱：一年年率化回報）。
 * 一次只為一個積金局基金類別上色，其餘退作背景，避免多色並置難以分辨。
 */
export function AtlasPlot({
  points,
  family,
}: {
  points: AtlasPoint[];
  family: string | null;
}) {
  const [ref, width] = useChartWidth(720);
  const tooltip = useTooltip();
  const [active, setActive] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);
  const height = width < 560 ? 340 : Math.min(520, Math.round(width * 0.62));
  const margin = { top: 26, right: 18, bottom: 64, left: 54 };
  const plotWidth = Math.max(160, width - margin.left - margin.right);
  const plotHeight = height - margin.top - margin.bottom;
  const xs = points.map((point) => point.risk.value);
  const ys = points.map((point) => point.ret.value);
  const xTicks = niceTicks(
    Math.min(0, ...xs),
    Math.max(...xs),
    Math.max(4, Math.min(8, plotWidth / 90)),
  );
  const yTicks = niceTicks(Math.min(0, ...ys), Math.max(...ys), 6);
  const x0 = xTicks[0] ?? 0,
    x1 = xTicks.at(-1) ?? 1,
    y0 = yTicks[0] ?? 0,
    y1 = yTicks.at(-1) ?? 1;
  const sx = (value: number) =>
    margin.left + ((value - x0) / (x1 - x0 || 1)) * plotWidth;
  const sy = (value: number) =>
    margin.top + plotHeight - ((value - y0) / (y1 - y0 || 1)) * plotHeight;
  // 圖格固定 A–H × 1–8，與圖框坐標一致；同一組數據在任何寬度都得出同一個圖格。
  const columns = 8;
  const rows = 8;
  const gridRef = (point: AtlasPoint) => {
    const column = Math.min(
      columns - 1,
      Math.floor(((sx(point.risk.value) - margin.left) / plotWidth) * columns),
    );
    const row = Math.min(
      rows - 1,
      Math.floor(((sy(point.ret.value) - margin.top) / plotHeight) * rows),
    );
    return `${GRID_LETTERS[column]}${row + 1}`;
  };

  const selected = family
    ? points.filter((point) => point.family === family)
    : points;
  const boxes = useMemo(() => {
    if (!family) return [];
    return MPFA_FUND_TYPES.filter((type) => type.family.zh === family).flatMap(
      (type) => {
        const members = points.filter((point) => point.type === type.zh);
        if (members.length < 3) return [];
        const rx = members.map((point) => point.risk.value);
        const ry = members.map((point) => point.ret.value);
        return [
          {
            type: type.zh,
            count: members.length,
            q1x: quantile(rx, 0.25)!,
            q3x: quantile(rx, 0.75)!,
            q1y: quantile(ry, 0.25)!,
            q3y: quantile(ry, 0.75)!,
            mx: median(rx)!,
            my: median(ry)!,
          },
        ];
      },
    );
  }, [family, points]);

  function nearest(event: ReactMouseEvent<SVGRectElement>) {
    const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!box) return null;
    const px = event.clientX - box.left;
    const py = event.clientY - box.top;
    let best: AtlasPoint | null = null;
    let bestDistance = 18 * 18;
    for (const point of selected) {
      const distance =
        (sx(point.risk.value) - px) ** 2 + (sy(point.ret.value) - py) ** 2;
      if (distance < bestDistance) {
        best = point;
        bestDistance = distance;
      }
    }
    return best;
  }
  const activePoint = selected.find((point) => point.id === active) ?? null;
  const ordered = family
    ? [...points.filter((point) => point.family !== family), ...selected]
    : points;

  return (
    <div className="kw-atlas" ref={tooltip.frame}>
      <div className="kw-atlas__measure" ref={ref}>
        <svg
          className="kw-atlas__svg"
          width={width}
          height={height}
          role="img"
          aria-label={`強積金基金圖：${points.length} 隻基金類別，橫軸為三年波幅，縱軸為一年年率化回報${family ? `；已突出${family}（${selected.length} 隻）` : ""}。`}
        >
          {Array.from({ length: columns }, (_, index) => {
            const left = margin.left + (plotWidth / columns) * index;
            return (
              <g key={`col-${index}`}>
                {index > 0 && (
                  <line
                    className="kw-atlas__grid"
                    x1={left}
                    x2={left}
                    y1={margin.top}
                    y2={margin.top + plotHeight}
                  />
                )}
                <text
                  className="kw-atlas__gridref"
                  x={left + plotWidth / columns / 2}
                  y={margin.top - 9}
                  textAnchor="middle"
                >
                  {GRID_LETTERS[index]}
                </text>
              </g>
            );
          })}
          {Array.from({ length: rows }, (_, index) => {
            const top = margin.top + (plotHeight / rows) * index;
            return (
              <g key={`row-${index}`}>
                {index > 0 && (
                  <line
                    className="kw-atlas__grid"
                    x1={margin.left}
                    x2={margin.left + plotWidth}
                    y1={top}
                    y2={top}
                  />
                )}
                <text
                  className="kw-atlas__gridref"
                  x={margin.left + plotWidth + 9}
                  y={top + plotHeight / rows / 2 + 4}
                  textAnchor="start"
                >
                  {index + 1}
                </text>
              </g>
            );
          })}
          <rect
            className="kw-atlas__neatline"
            x={margin.left}
            y={margin.top}
            width={plotWidth}
            height={plotHeight}
          />
          {y0 < 0 && y1 > 0 && (
            <line
              className="kw-atlas__zero"
              x1={margin.left}
              x2={margin.left + plotWidth}
              y1={sy(0)}
              y2={sy(0)}
            />
          )}
          {yTicks.map((tick) => (
            <g key={`y-${tick}`}>
              <line
                className="kw-atlas__tick"
                x1={margin.left - 6}
                x2={margin.left}
                y1={sy(tick)}
                y2={sy(tick)}
              />
              <text
                className="kw-atlas__label"
                x={margin.left - 10}
                y={sy(tick) + 4}
                textAnchor="end"
              >
                {formatTick(tick)}
              </text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line
                className="kw-atlas__tick"
                x1={sx(tick)}
                x2={sx(tick)}
                y1={margin.top + plotHeight}
                y2={margin.top + plotHeight + 6}
              />
              <text
                className="kw-atlas__label"
                x={sx(tick)}
                y={margin.top + plotHeight + 21}
                textAnchor="middle"
              >
                {formatTick(tick)}
              </text>
            </g>
          ))}
          <text
            className="kw-atlas__axis-title"
            x={margin.left + plotWidth}
            y={height - 20}
            textAnchor="end"
          >
            三年波幅（官方基金風險指標）→
          </text>
          <text
            className="kw-atlas__axis-title kw-atlas__axis-title--en"
            x={margin.left + plotWidth}
            y={height - 6}
            textAnchor="end"
            lang="en"
          >
            3-year volatility (MPFA fund risk indicator)
          </text>
          <text
            className="kw-atlas__axis-title"
            x={14}
            y={margin.top + plotHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90 14 ${margin.top + plotHeight / 2})`}
          >
            一年年率化回報{" "}
            <tspan className="kw-atlas__axis-title--en" lang="en">
              1-year annualised return
            </tspan>{" "}
            →
          </text>
          {boxes.map((box) => (
            <rect
              key={box.type}
              className={`kw-atlas__box${activeType === box.type ? " is-active" : ""}`}
              x={sx(box.q1x)}
              y={sy(box.q3y)}
              width={Math.max(2, sx(box.q3x) - sx(box.q1x))}
              height={Math.max(2, sy(box.q1y) - sy(box.q3y))}
            />
          ))}
          {ordered.map((point) => {
            const on = !family || point.family === family;
            const dim = activeType && point.type !== activeType;
            return (
              <circle
                key={point.id}
                className="kw-atlas__point"
                cx={sx(point.risk.value)}
                cy={sy(point.ret.value)}
                r={on ? 4 : 3}
                fill={on && !dim ? HIGHLIGHT : CONTEXT}
                fillOpacity={on && !dim ? 0.82 : 0.45}
                stroke={on && !dim ? "#ffffff" : "none"}
                strokeWidth={on && !dim ? 1.5 : 0}
              />
            );
          })}
          {activePoint && (
            <circle
              className="kw-atlas__focus"
              cx={sx(activePoint.risk.value)}
              cy={sy(activePoint.ret.value)}
              r={8}
            />
          )}
          <rect
            className="kw-atlas__hit"
            x={margin.left}
            y={margin.top}
            width={plotWidth}
            height={plotHeight}
            onPointerMove={(event) => {
              const point = nearest(event);
              setActive(point?.id ?? null);
              if (point)
                tooltip.at(
                  event.clientX,
                  event.clientY,
                  <>
                    <strong>{point.label}</strong>
                    <span>{point.scheme}</span>
                    <span>{point.type}</span>
                    <span>
                      一年回報 {point.ret.displayValue}（截至{" "}
                      {point.ret.dataAsOf}）
                    </span>
                    <span>
                      三年波幅 {point.risk.displayValue}（截至{" "}
                      {point.risk.dataAsOf}）
                    </span>
                    <span className="kw-atlas__tip-ref">
                      圖格 {gridRef(point)} · 點擊開啟基金圖幅
                    </span>
                  </>,
                );
              else tooltip.hide();
            }}
            onPointerLeave={() => {
              setActive(null);
              tooltip.hide();
            }}
            onClick={(event) => {
              const point = nearest(event);
              if (point)
                window.location.assign(
                  `/fund-classes/${encodeURIComponent(point.id)}`,
                );
            }}
          />
        </svg>
      </div>
      <Tooltip tip={tooltip.tip} />
      {family && boxes.length > 0 && (
        <table
          className="kw-atlas__types"
          aria-label={`${family}各積金局基金類型的分布（本站計算）`}
        >
          <caption>
            {family}各類型的中位數（本站計算）；分布框為四分位範圍，少於 3
            隻不畫。
          </caption>
          <thead>
            <tr>
              <th scope="col">積金局基金類型</th>
              <th scope="col">入圖隻數</th>
              <th scope="col">一年回報中位數</th>
              <th scope="col">三年波幅中位數</th>
            </tr>
          </thead>
          <tbody>
            {boxes.map((box) => (
              <tr
                key={box.type}
                onPointerEnter={() => setActiveType(box.type)}
                onPointerLeave={() => setActiveType(null)}
                onFocus={() => setActiveType(box.type)}
                onBlur={() => setActiveType(null)}
              >
                <th scope="row">
                  <a
                    href={`/rankings?period=1&group=${encodeURIComponent(box.type)}`}
                  >
                    {box.type.replace(`${family} - `, "")}
                  </a>
                </th>
                <td>{box.count}</td>
                <td>{formatDerived(box.my)}</td>
                <td>{formatDerived(box.mx)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** 圖幅索引：每個積金局基金類型一行，點出各基金一年回報；金色短線為中位數（本站計算）。 */
export function SheetIndex({ returns }: { returns: RankingRow[] }) {
  const [ref, width] = useChartWidth(720);
  const tooltip = useTooltip();
  const values = returns.map((row) => row.value);
  const ticks = niceTicks(
    Math.min(0, ...values),
    Math.max(...values),
    width < 560 ? 4 : 6,
  );
  const x0 = ticks[0] ?? 0,
    x1 = ticks.at(-1) ?? 1;
  const labelWidth = width < 560 ? 0 : 236;
  const stripWidth = Math.max(
    120,
    width - labelWidth - (width < 560 ? 24 : 48),
  );
  const sx = (value: number) =>
    labelWidth + ((value - x0) / (x1 - x0 || 1)) * stripWidth;
  const byType = new Map<string, RankingRow[]>();
  for (const row of returns)
    byType.set(row.comparisonGroup, [
      ...(byType.get(row.comparisonGroup) ?? []),
      row,
    ]);
  return (
    <div className="kw-sheet-index" ref={tooltip.frame}>
      <div ref={ref} className="kw-sheet-index__measure">
        {MPFA_FAMILIES.map((family) => {
          const types = MPFA_FUND_TYPES.filter(
            (type) => type.family.zh === family && byType.has(type.zh),
          );
          if (!types.length) return null;
          return (
            <section
              className="kw-sheet-index__family"
              key={family}
              aria-label={family}
            >
              <h3>{family}</h3>
              <ul>
                {types.map((type) => {
                  const rows = byType.get(type.zh)!;
                  const mid = median(rows.map((row) => row.value))!;
                  const short =
                    type.zh === family
                      ? type.zh
                      : type.zh.replace(`${family} - `, "");
                  return (
                    <li key={type.zh}>
                      <a
                        className="kw-sheet-index__name"
                        href={`/rankings?period=1&group=${encodeURIComponent(type.zh)}`}
                      >
                        {short}
                        <span>
                          {rows.length} 隻 · 中位數 {formatDerived(mid)}
                        </span>
                      </a>
                      <svg
                        className="kw-sheet-index__strip"
                        width={width}
                        height={22}
                        role="img"
                        aria-label={`${type.zh}：${rows.length} 隻基金一年回報，中位數 ${formatDerived(mid)}（本站計算）`}
                      >
                        <line
                          className="kw-sheet-index__rail"
                          x1={sx(x0)}
                          x2={sx(x1)}
                          y1={11}
                          y2={11}
                        />
                        {x0 < 0 && (
                          <line
                            className="kw-sheet-index__zero"
                            x1={sx(0)}
                            x2={sx(0)}
                            y1={3}
                            y2={19}
                          />
                        )}
                        {rows.map((row) => (
                          <circle
                            key={row.fundClassId}
                            cx={sx(row.value)}
                            cy={11}
                            r={4}
                            className="kw-sheet-index__dot"
                            onPointerEnter={(event) =>
                              tooltip.atElement(
                                event.currentTarget,
                                <>
                                  <strong>
                                    {joinFundParts(
                                      row.constituentFundName,
                                      fundClassLabel(row.fundClassName),
                                    )}
                                  </strong>
                                  <span>{row.schemeName}</span>
                                  <span>
                                    一年回報 {row.displayValue}（截至{" "}
                                    {row.dataAsOf}）
                                  </span>
                                </>,
                              )
                            }
                            onPointerLeave={tooltip.hide}
                          />
                        ))}
                        <line
                          className="kw-sheet-index__median"
                          x1={sx(mid)}
                          x2={sx(mid)}
                          y1={2}
                          y2={20}
                        />
                      </svg>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        <svg
          className="kw-sheet-index__axis"
          width={width}
          height={26}
          aria-hidden="true"
        >
          {ticks.map((tick) => (
            <text
              key={tick}
              x={sx(tick)}
              y={16}
              textAnchor="middle"
              className="kw-atlas__label"
            >
              {formatTick(tick)}
            </text>
          ))}
        </svg>
      </div>
      <Tooltip tip={tooltip.tip} />
    </div>
  );
}
