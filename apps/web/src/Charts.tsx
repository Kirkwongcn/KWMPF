import {
  ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

/**
 * 圖表色板（2026-10-01 以 dataviz validate_palette.js 驗證，淺色底 #ffffff）：
 * 類別色固定次序、不循環；風險級別用單一青色序列色階（--ordinal 通過）。
 * 只用於圖形標記；數字及標籤一律用文字色，顏色不是唯一辨識方法。
 */
export const VIZ_SERIES = [
  "#00879f",
  "#c07f12",
  "#d0577a",
  "#5560c4",
  "#4b9a3a",
] as const;
export const VIZ_ORDINAL = [
  "#7cc2cb",
  "#55aab5",
  "#33919e",
  "#1c7a88",
  "#106472",
  "#094f5b",
  "#043b45",
] as const;

export function niceStep(span: number, count: number) {
  const raw = Math.abs(span) / Math.max(1, count) || 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalised = raw / magnitude;
  const step =
    normalised <= 1
      ? 1
      : normalised <= 2
        ? 2
        : normalised <= 2.5
          ? 2.5
          : normalised <= 5
            ? 5
            : 10;
  return step * magnitude;
}

/** Clean axis ticks covering [min, max]; ticks are scale, never data. */
export function niceTicks(min: number, max: number, count = 5) {
  let low = min,
    high = max;
  if (!Number.isFinite(low) || !Number.isFinite(high)) return [0, 1];
  if (low === high) {
    low -= 1;
    high += 1;
  }
  const step = niceStep(high - low, count);
  const start = Math.floor(low / step) * step;
  const end = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step)
    ticks.push(Number(value.toFixed(10)));
  return ticks;
}

export function formatTick(value: number, unit = "%") {
  return `${Number(value.toFixed(4))}${unit}`;
}

/** Derived statistic from official values; callers must label it 本站計算. */
export function median(values: number[]) {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!sorted.length) return undefined;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** Display form for a derived statistic only — official values keep their raw text. */
export function formatDerived(value: number, unit = "%") {
  return `${Number(value.toFixed(2))}${unit}`;
}

/** Callback ref so a chart that first renders empty still measures once its plot mounts. */
export function useChartWidth(fallback = 640) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    if (!element) return;
    const measure = () => {
      const next = element.clientWidth;
      if (next > 0) setWidth(next);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, width] as const;
}

type Tip = { x: number; y: number; content: ReactNode } | null;

export function useTooltip() {
  const frame = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip>(null);
  function at(clientX: number, clientY: number, content: ReactNode) {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: clientX - box.left, y: clientY - box.top, content });
  }
  function atElement(element: Element, content: ReactNode) {
    const box = element.getBoundingClientRect();
    at(box.left + box.width / 2, box.top, content);
  }
  return { frame, tip, at, atElement, hide: () => setTip(null) };
}

export function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div
      className="kw-viz-tip"
      aria-hidden="true"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.content}
    </div>
  );
}

export type LegendItem = {
  label: string;
  color: string;
  shape?: "rect" | "dot" | "line";
};

export function Legend({ items }: { items: LegendItem[] }) {
  if (!items.length) return null;
  return (
    <ul className="kw-viz-legend" aria-label="圖例">
      {items.map((item) => (
        <li key={item.label}>
          <i
            className={`kw-viz-legend__key kw-viz-legend__key--${item.shape ?? "rect"}`}
            style={{ background: item.color }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export type TwinTable = {
  caption: string;
  columns: string[];
  rows: ReactNode[][];
};

/** Every chart has a table twin; it is only rendered once opened. */
function DataTableTwin({ table }: { table: TwinTable }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="kw-viz-table"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>查看數據表</summary>
      {open && (
        <div className="kw-table-wrap" tabIndex={0} role="region">
          <table className="kw-table">
            <caption className="kw-visually-hidden">{table.caption}</caption>
            <thead>
              <tr>
                {table.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

export function ChartFrame({
  title,
  subtitle,
  legend,
  note,
  table,
  className = "",
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  legend?: LegendItem[];
  note?: ReactNode;
  table?: TwinTable;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className={`kw-viz ${className}`.trim()}>
      <figcaption className="kw-viz__head">
        <span className="kw-viz__title">{title}</span>
        {subtitle && <span className="kw-viz__subtitle">{subtitle}</span>}
      </figcaption>
      {legend && <Legend items={legend} />}
      {children}
      {note && <p className="kw-viz__note">{note}</p>}
      {table && <DataTableTwin table={table} />}
    </figure>
  );
}

export type StatItem = {
  label: string;
  value: ReactNode;
  note?: ReactNode;
};

/** KPI row: numbers are the chart; no plot needed. */
export function StatTiles({
  items,
  label,
  className = "",
}: {
  items: StatItem[];
  label: string;
  className?: string;
}) {
  return (
    <section className={`kw-stats ${className}`.trim()} aria-label={label}>
      {items.map((item) => (
        <div className="kw-stat" key={item.label}>
          <span className="kw-stat__label">{item.label}</span>{" "}
          <strong className="kw-stat__value">{item.value}</strong>
          {item.note && <small className="kw-stat__note">{item.note}</small>}
        </div>
      ))}
    </section>
  );
}

function roundedTopBar(
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 4,
) {
  const r = Math.max(0, Math.min(radius, width / 2, height));
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

export type HistogramMarker = { value: number; label: string };

/** Distribution of official values in equal-width bins (binning is this site's). */
export function Histogram({
  title,
  subtitle,
  values,
  unit = "%",
  note,
  markers = [],
  countLabel = "隻基金",
  binTarget = 24,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  values: number[];
  unit?: string;
  note?: ReactNode;
  markers?: HistogramMarker[];
  countLabel?: string;
  binTarget?: number;
}) {
  const [ref, width] = useChartWidth();
  const tooltip = useTooltip();
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length)
    return (
      <ChartFrame title={title} subtitle={subtitle}>
        <p className="kw-status">沒有可用數值。</p>
      </ChartFrame>
    );
  const low = Math.min(...finite),
    high = Math.max(...finite);
  const step = niceStep(high - low || 1, binTarget);
  const start = Math.floor(low / step) * step;
  const binCount = Math.max(1, Math.floor((high - start) / step) + 1);
  const bins = Array.from({ length: binCount }, (_, index) => ({
    from: Number((start + index * step).toFixed(10)),
    to: Number((start + (index + 1) * step).toFixed(10)),
    count: 0,
  }));
  for (const value of finite)
    bins[Math.min(binCount - 1, Math.floor((value - start) / step))]!.count +=
      1;
  const end = bins[bins.length - 1]!.to;
  const height = 230,
    margin = { top: 22, right: 12, bottom: 36, left: 40 };
  const plotWidth = Math.max(120, width - margin.left - margin.right),
    plotHeight = height - margin.top - margin.bottom;
  const maxCount = Math.max(...bins.map((bin) => bin.count));
  const yTicks = niceTicks(0, maxCount, 4);
  const yMax = yTicks[yTicks.length - 1] || 1;
  const x = (value: number) =>
    margin.left + ((value - start) / (end - start)) * plotWidth;
  const y = (count: number) =>
    margin.top + plotHeight - (count / yMax) * plotHeight;
  const xTicks = niceTicks(
    start,
    end,
    Math.min(7, Math.max(3, plotWidth / 90)),
  ).filter((tick) => tick >= start - 1e-9 && tick <= end + 1e-9);
  const binLabel = (bin: (typeof bins)[number]) =>
    `${formatTick(bin.from, unit)} 至 ${formatTick(bin.to, unit)}`;
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      note={note}
      table={{
        caption: typeof title === "string" ? title : "分布數據表",
        columns: ["區間（含下限、不含上限）", "數量"],
        rows: bins.map((bin) => [binLabel(bin), `${bin.count} ${countLabel}`]),
      }}
    >
      <div className="kw-viz__body" ref={tooltip.frame}>
        <div ref={ref} className="kw-viz__measure">
          <svg
            className="kw-viz__svg"
            width={width}
            height={height}
            role="img"
            aria-label={`${typeof title === "string" ? title : "分布圖"}：共 ${finite.length} 個數值，分為 ${binCount} 組`}
          >
            {yTicks.map((tick) => (
              <g key={tick}>
                <line
                  className="kw-viz__grid"
                  x1={margin.left}
                  x2={margin.left + plotWidth}
                  y1={y(tick)}
                  y2={y(tick)}
                />
                <text
                  className="kw-viz__tick"
                  x={margin.left - 8}
                  y={y(tick)}
                  dy="0.32em"
                  textAnchor="end"
                >
                  {tick}
                </text>
              </g>
            ))}
            {start < 0 && end > 0 && (
              <line
                className="kw-viz__zero"
                x1={x(0)}
                x2={x(0)}
                y1={margin.top}
                y2={margin.top + plotHeight}
              />
            )}
            {bins.map((bin) => {
              const left = x(bin.from) + 1,
                barWidth = Math.max(1, x(bin.to) - x(bin.from) - 2);
              const label = `${binLabel(bin)}：${bin.count} ${countLabel}`;
              return (
                <g key={bin.from}>
                  {bin.count > 0 && (
                    <path
                      className={`kw-viz__bar${bin.to <= 0 ? " kw-viz__bar--negative" : ""}`}
                      d={roundedTopBar(
                        left,
                        y(bin.count),
                        barWidth,
                        margin.top + plotHeight - y(bin.count),
                      )}
                    />
                  )}
                  <rect
                    className="kw-viz__hit"
                    x={x(bin.from)}
                    y={margin.top}
                    width={Math.max(1, x(bin.to) - x(bin.from))}
                    height={plotHeight}
                    tabIndex={bin.count > 0 ? 0 : -1}
                    aria-label={label}
                    onPointerMove={(event) =>
                      tooltip.at(
                        event.clientX,
                        event.clientY,
                        <>
                          <strong>
                            {bin.count} {countLabel}
                          </strong>
                          <span>{binLabel(bin)}</span>
                        </>,
                      )
                    }
                    onPointerLeave={tooltip.hide}
                    onFocus={(event) =>
                      tooltip.atElement(
                        event.currentTarget,
                        <>
                          <strong>
                            {bin.count} {countLabel}
                          </strong>
                          <span>{binLabel(bin)}</span>
                        </>,
                      )
                    }
                    onBlur={tooltip.hide}
                  />
                </g>
              );
            })}
            {markers.map((marker) => (
              <g key={marker.label} className="kw-viz__marker">
                <line
                  x1={x(marker.value)}
                  x2={x(marker.value)}
                  y1={margin.top - 4}
                  y2={margin.top + plotHeight}
                />
                <text
                  x={x(marker.value)}
                  y={margin.top - 8}
                  textAnchor={
                    x(marker.value) > margin.left + plotWidth * 0.75
                      ? "end"
                      : x(marker.value) < margin.left + plotWidth * 0.25
                        ? "start"
                        : "middle"
                  }
                >
                  {marker.label}
                </text>
              </g>
            ))}
            <line
              className="kw-viz__axis"
              x1={margin.left}
              x2={margin.left + plotWidth}
              y1={margin.top + plotHeight}
              y2={margin.top + plotHeight}
            />
            {xTicks.map((tick) => (
              <text
                key={tick}
                className="kw-viz__tick"
                x={x(tick)}
                y={margin.top + plotHeight + 20}
                textAnchor="middle"
              >
                {formatTick(tick, unit)}
              </text>
            ))}
          </svg>
        </div>
        <Tooltip tip={tooltip.tip} />
      </div>
    </ChartFrame>
  );
}

export type ScatterPoint = {
  x: number;
  y: number;
  label: string;
  detail?: string;
  href?: string;
};

/** Two official measures of the same funds on one plane; one y-axis only. */
export function Scatter({
  title,
  subtitle,
  points,
  xLabel,
  yLabel,
  xUnit = "%",
  yUnit = "%",
  note,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  xUnit?: string;
  yUnit?: string;
  note?: ReactNode;
}) {
  const [ref, width] = useChartWidth();
  const tooltip = useTooltip();
  const [active, setActive] = useState<number | null>(null);
  const valid = points.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  );
  if (!valid.length)
    return (
      <ChartFrame title={title} subtitle={subtitle}>
        <p className="kw-status">沒有可用數值。</p>
      </ChartFrame>
    );
  const height = width < 520 ? 300 : 360,
    margin = { top: 16, right: 16, bottom: 48, left: 52 };
  const plotWidth = Math.max(120, width - margin.left - margin.right),
    plotHeight = height - margin.top - margin.bottom;
  const xTicks = niceTicks(
    Math.min(...valid.map((point) => point.x)),
    Math.max(...valid.map((point) => point.x)),
    Math.max(3, Math.min(7, plotWidth / 90)),
  );
  const yTicks = niceTicks(
    Math.min(...valid.map((point) => point.y)),
    Math.max(...valid.map((point) => point.y)),
    5,
  );
  const x0 = xTicks[0] ?? 0,
    x1 = xTicks[xTicks.length - 1] ?? 1;
  const y0 = yTicks[0] ?? 0,
    y1 = yTicks[yTicks.length - 1] ?? 1;
  const sx = (value: number) =>
    margin.left + ((value - x0) / (x1 - x0 || 1)) * plotWidth;
  const sy = (value: number) =>
    margin.top + plotHeight - ((value - y0) / (y1 - y0 || 1)) * plotHeight;
  function nearest(event: ReactPointerEvent<SVGRectElement>) {
    const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!box) return null;
    const px = event.clientX - box.left,
      py = event.clientY - box.top;
    let best: number | null = null,
      bestDistance = 24 * 24;
    valid.forEach((point, index) => {
      const distance = (sx(point.x) - px) ** 2 + (sy(point.y) - py) ** 2;
      if (distance <= bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    return best;
  }
  const activePoint = active === null ? null : (valid[active] ?? null);
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      note={note}
      table={{
        caption: typeof title === "string" ? title : "散點數據表",
        columns: ["基金", xLabel, yLabel],
        rows: valid.map((point) => [
          point.href ? <a href={point.href}>{point.label}</a> : point.label,
          `${point.x}${xUnit}`,
          `${point.y}${yUnit}`,
        ]),
      }}
    >
      <div className="kw-viz__body" ref={tooltip.frame}>
        <div ref={ref} className="kw-viz__measure">
          <svg
            className="kw-viz__svg"
            width={width}
            height={height}
            role="img"
            aria-label={`${typeof title === "string" ? title : "散點圖"}：${valid.length} 隻基金；橫軸${xLabel}，縱軸${yLabel}`}
          >
            {yTicks.map((tick) => (
              <g key={`y${tick}`}>
                <line
                  className={tick === 0 ? "kw-viz__zero" : "kw-viz__grid"}
                  x1={margin.left}
                  x2={margin.left + plotWidth}
                  y1={sy(tick)}
                  y2={sy(tick)}
                />
                <text
                  className="kw-viz__tick"
                  x={margin.left - 8}
                  y={sy(tick)}
                  dy="0.32em"
                  textAnchor="end"
                >
                  {formatTick(tick, yUnit)}
                </text>
              </g>
            ))}
            {xTicks.map((tick) => (
              <g key={`x${tick}`}>
                <line
                  className={tick === 0 ? "kw-viz__zero" : "kw-viz__grid"}
                  x1={sx(tick)}
                  x2={sx(tick)}
                  y1={margin.top}
                  y2={margin.top + plotHeight}
                />
                <text
                  className="kw-viz__tick"
                  x={sx(tick)}
                  y={margin.top + plotHeight + 18}
                  textAnchor="middle"
                >
                  {formatTick(tick, xUnit)}
                </text>
              </g>
            ))}
            <text
              className="kw-viz__axis-title"
              x={margin.left + plotWidth}
              y={height - 6}
              textAnchor="end"
            >
              {xLabel} →
            </text>
            <text
              className="kw-viz__axis-title"
              x={margin.left}
              y={margin.top - 4}
              textAnchor="start"
            >
              ↑ {yLabel}
            </text>
            <g className="kw-viz__points">
              {valid.map((point, index) => (
                <circle
                  key={index}
                  cx={sx(point.x)}
                  cy={sy(point.y)}
                  r={4}
                  className={index === active ? "is-active" : undefined}
                />
              ))}
            </g>
            {activePoint && (
              <circle
                className="kw-viz__focus-ring"
                cx={sx(activePoint.x)}
                cy={sy(activePoint.y)}
                r={8}
              />
            )}
            <rect
              className="kw-viz__overlay"
              x={margin.left}
              y={margin.top}
              width={plotWidth}
              height={plotHeight}
              onPointerMove={(event) => {
                const index = nearest(event);
                setActive(index);
                if (index === null) {
                  tooltip.hide();
                  return;
                }
                const point = valid[index]!;
                tooltip.at(
                  event.clientX,
                  event.clientY,
                  <>
                    <strong>
                      {yLabel} {point.y}
                      {yUnit} · {xLabel} {point.x}
                      {xUnit}
                    </strong>
                    <span>{point.label}</span>
                    {point.detail && <span>{point.detail}</span>}
                  </>,
                );
              }}
              onPointerLeave={() => {
                setActive(null);
                tooltip.hide();
              }}
              onClick={() => {
                if (activePoint?.href) window.location.assign(activePoint.href);
              }}
              style={{ cursor: activePoint?.href ? "pointer" : "default" }}
            />
          </svg>
        </div>
        <Tooltip tip={tooltip.tip} />
      </div>
    </ChartFrame>
  );
}

export type RangeRow = {
  key: string;
  label: ReactNode;
  sub?: ReactNode;
  min: number;
  max: number;
  median?: number;
  count?: number;
  marker?: { value: number; label: string };
  summary: string;
  value?: ReactNode;
};

/** Spread within each row: min–max line, median tick, optional highlighted dot. */
export function RangeChart({
  title,
  subtitle,
  rows,
  unit = "%",
  note,
  legend,
  includeZero = true,
  table,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  rows: RangeRow[];
  unit?: string;
  note?: ReactNode;
  legend?: LegendItem[];
  includeZero?: boolean;
  table?: TwinTable;
}) {
  const tooltip = useTooltip();
  const values = rows.flatMap((row) => [
    row.min,
    row.max,
    ...(row.marker ? [row.marker.value] : []),
  ]);
  const ticks = niceTicks(
    Math.min(...values, ...(includeZero ? [0] : [])),
    Math.max(...values, ...(includeZero ? [0] : [])),
    5,
  );
  const low = ticks[0] ?? 0,
    high = ticks[ticks.length - 1] ?? 1;
  const pct = (value: number) => ((value - low) / (high - low || 1)) * 100;
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      legend={legend}
      note={note}
      table={table}
      className="kw-range"
    >
      <div className="kw-viz__body" ref={tooltip.frame}>
        <ul className="kw-range__rows">
          {rows.map((row) => (
            <li
              key={row.key}
              className="kw-range__row"
              tabIndex={0}
              aria-label={row.summary}
              onPointerMove={(event) =>
                tooltip.at(
                  event.clientX,
                  event.clientY,
                  <span>{row.summary}</span>,
                )
              }
              onPointerLeave={tooltip.hide}
              onFocus={(event) =>
                tooltip.atElement(
                  event.currentTarget.querySelector(".kw-range__plot") ??
                    event.currentTarget,
                  <span>{row.summary}</span>,
                )
              }
              onBlur={tooltip.hide}
            >
              <div className="kw-range__label">
                <span>{row.label}</span>
                {row.sub && <small>{row.sub}</small>}
              </div>
              <div className="kw-range__plot" aria-hidden="true">
                {ticks.map((tick) => (
                  <i
                    key={tick}
                    className={tick === 0 ? "kw-range__zero" : "kw-range__grid"}
                    style={{ left: `${pct(tick)}%` }}
                  />
                ))}
                <span
                  className="kw-range__span"
                  style={{
                    left: `${pct(row.min)}%`,
                    width: `${Math.max(0.6, pct(row.max) - pct(row.min))}%`,
                  }}
                />
                {typeof row.median === "number" && (
                  <span
                    className="kw-range__median"
                    style={{ left: `${pct(row.median)}%` }}
                  />
                )}
                {row.marker && (
                  <span
                    className="kw-range__marker"
                    style={{ left: `${pct(row.marker.value)}%` }}
                  />
                )}
              </div>
              <div className="kw-range__value">
                {row.value ??
                  (typeof row.count === "number" ? `${row.count} 隻` : "")}
              </div>
            </li>
          ))}
        </ul>
        <div className="kw-range__axis" aria-hidden="true">
          <span />
          <div>
            {ticks.map((tick) => (
              <span key={tick} style={{ left: `${pct(tick)}%` }}>
                {formatTick(tick, unit)}
              </span>
            ))}
          </div>
          <span />
        </div>
        <Tooltip tip={tooltip.tip} />
      </div>
    </ChartFrame>
  );
}

export type StackedSeries = { key: string; label: string; color: string };
export type StackedRow = {
  key: string;
  label: ReactNode;
  sub?: ReactNode;
  plainLabel: string;
  values: Record<string, number>;
};

/** Part-to-whole per row (counts); each bar sums to its own row total. */
export function StackedBars({
  title,
  subtitle,
  rows,
  series,
  note,
  unitLabel = "隻",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  rows: StackedRow[];
  series: StackedSeries[];
  note?: ReactNode;
  unitLabel?: string;
}) {
  const tooltip = useTooltip();
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      legend={series.map((item) => ({ label: item.label, color: item.color }))}
      note={note}
      className="kw-stacked"
      table={{
        caption: typeof title === "string" ? title : "組成數據表",
        columns: ["項目", ...series.map((item) => item.label), "合計"],
        rows: rows.map((row) => {
          const total = series.reduce(
            (sum, item) => sum + (row.values[item.key] ?? 0),
            0,
          );
          return [
            row.plainLabel,
            ...series.map((item) => `${row.values[item.key] ?? 0}`),
            `${total}`,
          ];
        }),
      }}
    >
      <div className="kw-viz__body" ref={tooltip.frame}>
        <ul className="kw-stacked__rows">
          {rows.map((row) => {
            const total = series.reduce(
              (sum, item) => sum + (row.values[item.key] ?? 0),
              0,
            );
            const summary = `${row.plainLabel}：${series
              .filter((item) => row.values[item.key])
              .map(
                (item) => `${item.label} ${row.values[item.key]} ${unitLabel}`,
              )
              .join("，")}（合計 ${total} ${unitLabel}）`;
            return (
              <li
                key={row.key}
                className="kw-stacked__row"
                tabIndex={0}
                aria-label={summary}
                onFocus={(event) =>
                  tooltip.atElement(
                    event.currentTarget.querySelector(".kw-stacked__track") ??
                      event.currentTarget,
                    <span>{summary}</span>,
                  )
                }
                onBlur={tooltip.hide}
              >
                <div className="kw-stacked__label">
                  <span>{row.label}</span>
                  {row.sub && <small>{row.sub}</small>}
                </div>
                <div className="kw-stacked__track" aria-hidden="true">
                  {series.map((item) => {
                    const value = row.values[item.key] ?? 0;
                    if (!value || !total) return null;
                    return (
                      <span
                        key={item.key}
                        style={{
                          flexGrow: value,
                          background: item.color,
                        }}
                        onPointerMove={(event) =>
                          tooltip.at(
                            event.clientX,
                            event.clientY,
                            <>
                              <strong>
                                {value} {unitLabel}（
                                {formatDerived((value / total) * 100)}）
                              </strong>
                              <span>
                                {item.label} · {row.plainLabel}
                              </span>
                            </>,
                          )
                        }
                        onPointerLeave={tooltip.hide}
                      />
                    );
                  })}
                </div>
                <div className="kw-stacked__total">
                  {total} {unitLabel}
                </div>
              </li>
            );
          })}
        </ul>
        <Tooltip tip={tooltip.tip} />
      </div>
    </ChartFrame>
  );
}

/** Loads data once the element scrolls near view; without IntersectionObserver, waits for a click. */
export function useWhenVisible<T extends Element>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  const supported = typeof IntersectionObserver !== "undefined";
  useEffect(() => {
    if (visible || !supported || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { rootMargin: "240px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible, supported]);
  return { ref, visible, supported, reveal: () => setVisible(true) };
}

/** Official MPFA risk class (1–7) on an ordinal ramp; the class number is always printed. */
export function RiskScale({ riskClass }: { riskClass?: number | null }) {
  const valid =
    typeof riskClass === "number" &&
    Number.isInteger(riskClass) &&
    riskClass >= 1 &&
    riskClass <= 7;
  return (
    <div
      className="kw-risk-scale"
      role="img"
      aria-label={
        valid
          ? `風險級別 ${riskClass}（1 最低，7 最高）`
          : "風險級別：官方未提供"
      }
    >
      <ol aria-hidden="true">
        {VIZ_ORDINAL.map((color, index) => (
          <li
            key={color}
            className={valid && index + 1 === riskClass ? "is-current" : ""}
            style={{ background: color }}
          >
            {index + 1}
          </li>
        ))}
      </ol>
      <div className="kw-risk-scale__ends" aria-hidden="true">
        <span>1 波動較低</span>
        <span>7 波動較高</span>
      </div>
    </div>
  );
}
