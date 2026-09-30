export type BarDatum = {
  label: string;
  value?: number | null;
  display?: string;
  href?: string;
  identifier?: string;
  note?: string;
};
/** One shared, zero-based scale per chart; absent values never become bars. */
export function ValueBars({
  rows,
  label,
  unit = "%",
  variant = "bar",
}: {
  rows: BarDatum[];
  label: string;
  unit?: string;
  variant?: "bar" | "dot";
}) {
  const values = rows.flatMap((row) =>
    typeof row.value === "number" && Number.isFinite(row.value)
      ? [row.value]
      : [],
  );
  const min = Math.min(0, ...values),
    max = Math.max(0, ...values),
    span = max - min || 1,
    zero = ((0 - min) / span) * 100;
  return (
    <figure className="kw-chart" aria-label={label}>
      <figcaption>
        {label}
        <span className="kw-muted">共同尺度 · {unit || "數量"} · 零起點</span>
      </figcaption>
      <ul className="kw-bars">
        {rows.map((row, index) => {
          const valid =
            typeof row.value === "number" && Number.isFinite(row.value);
          const end = valid ? ((row.value! - min) / span) * 100 : zero;
          return (
            <li key={`${row.label}-${index}`}>
              <div className="kw-bars__label">
                {row.href ? <a href={row.href}>{row.label}</a> : row.label}
                {row.identifier && <small>{row.identifier}</small>}
                {row.note && <small>{row.note}</small>}
              </div>
              <div className="kw-bars__plot" aria-hidden="true">
                <span className="kw-bars__zero" style={{ left: `${zero}%` }} />
                {valid && (
                  <span
                    className={`${variant === "dot" ? "kw-bars__dot" : "kw-bars__bar"}${row.value! < 0 ? " kw-bars__bar--negative" : ""}`}
                    style={{
                      left: `${variant === "dot" ? end : Math.min(zero, end)}%`,
                      ...(variant === "bar"
                        ? { width: `${Math.abs(end - zero)}%` }
                        : {}),
                    }}
                  />
                )}
              </div>
              <strong className="kw-bars__value">
                {valid
                  ? (row.display ?? `${row.value}${unit}`)
                  : (row.display ?? "未取得")}
              </strong>
            </li>
          );
        })}
      </ul>
      <div className="kw-chart__scale" aria-hidden="true">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </figure>
  );
}
export type QualityPeriod = {
  periodYears: number;
  eligible: number;
  stale: number;
  missing: number;
  unverified: number;
  dataAsOf: { earliest: string; latest: string } | null;
};
export type DataQuality = {
  snapshotId: string;
  evaluatedOn: string;
  evaluationTimezone: string;
  fundClassCount: number;
  retrievedAt: string | null;
  returns: QualityPeriod[];
};
export function AvailabilityChart({ quality }: { quality: DataQuality }) {
  return (
    <figure className="kw-availability" aria-label="各期間回報資料可用情況">
      <figcaption>有多少資料可作比較？</figcaption>
      <p className="kw-muted">
        每條代表同一快照的 {quality.fundClassCount} 個基金類別；按{" "}
        {quality.evaluatedOn}（UTC）評估。
      </p>
      <ul>
        {quality.returns.map((period) => (
          <li key={period.periodYears}>
            <div className="kw-availability__label">
              <strong>{period.periodYears} 年回報</strong>
              <span>{period.eligible} 可排名</span>
            </div>
            <div className="kw-availability__track" aria-hidden="true">
              {(["eligible", "stale", "missing", "unverified"] as const).map(
                (key) => (
                  <span
                    key={key}
                    className={`kw-availability__${key}`}
                    style={{
                      width: `${quality.fundClassCount ? (period[key] / quality.fundClassCount) * 100 : 0}%`,
                    }}
                  />
                ),
              )}
            </div>
            <p className="kw-availability__counts">
              {period.stale} 過期 · {period.missing} 未取得
              {period.unverified > 0 ? ` · ${period.unverified} 未核實` : ""}
            </p>
          </li>
        ))}
      </ul>
      <div className="kw-chart-legend">
        <span>
          <i className="kw-availability__eligible" />
          可排名
        </span>
        <span>
          <i className="kw-availability__stale" />
          過期
        </span>
        <span>
          <i className="kw-availability__missing" />
          未取得
        </span>
      </div>
    </figure>
  );
}
/** A conservative display guard, not a substitute for verifying the source parser. */
export function isUsableAllocation(
  entries: { label: string; percent: number }[],
) {
  return (
    entries.length > 0 &&
    entries.every(
      (entry) =>
        Number.isFinite(entry.percent) &&
        entry.label.trim().length > 0 &&
        entry.label.length <= 180 &&
        !/%|\bN\/?A\b|\b20\d{2}\b|year\s+to\s+date|reference\s+portfolio|annualis?ed|annualized|this\s+fund|回報|不適用/i.test(
          entry.label,
        ),
    )
  );
}
export function AllocationChart({
  entries,
  heading,
  sourceUrl,
}: {
  entries: { label: string; percent: number }[];
  heading: string;
  sourceUrl?: string;
}) {
  if (!isUsableAllocation(entries))
    return (
      <figure className="kw-allocation" aria-label={heading}>
        <figcaption>{heading}</figcaption>
        <p className="kw-status kw-status--warning" role="note">
          配置抽取未通過顯示核對，暫不顯示圖表或數值表；這不代表官方沒有披露。
          {sourceUrl && (
            <>
              {" "}
              <a href={sourceUrl} target="_blank" rel="noreferrer">
                查閱便覽原文
              </a>
            </>
          )}
        </p>
      </figure>
    );
  const sum = entries.reduce((total, entry) => total + entry.percent, 0);
  // Only the derived sum is cleaned of floating-point noise; source entries stay raw.
  const displaySum = Number(sum.toFixed(6));
  const complete =
    entries.length > 0 &&
    entries.every(
      (entry) => Number.isFinite(entry.percent) && entry.percent >= 0,
    ) &&
    sum >= 99 &&
    sum <= 101;
  if (!complete)
    return (
      <ValueBars
        label={heading}
        rows={entries.map((entry) => ({
          label: entry.label,
          value: entry.percent,
        }))}
      />
    );
  return (
    <figure className="kw-allocation" aria-label={heading}>
      <figcaption>{heading}</figcaption>
      <div className="kw-allocation__composition">
        {entries.length <= 6 ? (
          <svg className="kw-donut" viewBox="0 0 200 200" aria-hidden="true">
            {entries.map((entry, index) => {
              const circumference = 2 * Math.PI * 70;
              const before = entries
                .slice(0, index)
                .reduce((total, item) => total + item.percent, 0);
              return (
                <circle
                  key={index}
                  className={`kw-donut__part kw-donut__part--${index}`}
                  cx="100"
                  cy="100"
                  r="70"
                  fill="none"
                  strokeWidth="26"
                  strokeDasharray={`${(entry.percent / sum) * circumference} ${circumference}`}
                  strokeDashoffset={(-before / sum) * circumference}
                  transform="rotate(-90 100 100)"
                />
              );
            })}
            <text
              x="100"
              y="94"
              textAnchor="middle"
              className="kw-donut__caption"
            >
              披露合計
            </text>
            <text
              x="100"
              y="119"
              textAnchor="middle"
              className="kw-donut__total"
            >
              {displaySum}%
            </text>
          </svg>
        ) : (
          <div className="kw-allocation__track" aria-hidden="true">
            {entries.map((entry, index) => (
              <span
                key={index}
                className={`kw-allocation__part kw-allocation__part--${index % 6}`}
                style={{ width: `${(entry.percent / sum) * 100}%` }}
              />
            ))}
          </div>
        )}
        <ul>
          {entries.map((entry, index) => (
            <li key={index}>
              <i className={`kw-allocation__part--${index % 6}`} />
              <span>{entry.label}</span>
              <strong>{entry.percent}%</strong>
            </li>
          ))}
        </ul>
      </div>
      {displaySum !== 100 && (
        <p className="kw-muted">
          披露合計 {displaySum}%；圖形按合計調整長度，數字保留原值。
        </p>
      )}
    </figure>
  );
}

/** Independent calendar-year observations, never an invented NAV series. */
export function CalendarColumns({
  rows,
  label,
}: {
  rows: BarDatum[];
  label: string;
}) {
  const finite = rows.flatMap((row) =>
    typeof row.value === "number" && Number.isFinite(row.value)
      ? [row.value]
      : [],
  );
  const min = Math.min(0, ...finite),
    max = Math.max(0, ...finite),
    span = max - min || 1;
  const zero = (max / span) * 100;
  return (
    <figure className="kw-chart kw-calendar" aria-label={label}>
      <figcaption>
        {label}
        <span className="kw-muted">共同尺度 · % · 橫線為零</span>
      </figcaption>
      <ul className="kw-calendar__columns">
        {rows.map((row, index) => {
          const valid =
            typeof row.value === "number" && Number.isFinite(row.value);
          const end = valid ? ((max - row.value!) / span) * 100 : zero;
          return (
            <li key={index}>
              <div className="kw-calendar__plot" aria-hidden="true">
                <span
                  className="kw-calendar__zero"
                  style={{ top: `${zero}%` }}
                />
                {valid && (
                  <span
                    className={`kw-calendar__bar${row.value! < 0 ? " kw-calendar__bar--negative" : ""}`}
                    style={{
                      top: `${Math.min(end, zero)}%`,
                      height: `${Math.abs(end - zero)}%`,
                    }}
                  />
                )}
              </div>
              <span>{row.label}</span>
              <strong>
                {valid ? (row.display ?? `${row.value}%`) : "未取得"}
              </strong>
            </li>
          );
        })}
      </ul>
      <p className="kw-muted kw-calendar__note">
        尺度 {min}% 至 {max}%；每條柱代表一個完整曆年，下方表格保留官方原值。
      </p>
    </figure>
  );
}

export type HeatmapRow = {
  label: string;
  href: string;
  cells: {
    period: string;
    value?: number;
    status?: string;
    dataAsOf?: string;
    sourceUrl?: string;
  }[];
};
/** Colour is a secondary cue: each cell also contains its raw value and status. */
export function ReturnHeatmap({ rows }: { rows: HeatmapRow[] }) {
  const max = Math.max(
    1,
    ...rows.flatMap((row) =>
      row.cells.flatMap((cell) =>
        cell.status === "verified" &&
        typeof cell.value === "number" &&
        Number.isFinite(cell.value)
          ? [Math.abs(cell.value)]
          : [],
      ),
    ),
  );
  return (
    <figure className="kw-chart kw-heatmap" aria-label="不同期間年率化回報矩陣">
      <figcaption>
        不同期間，一次看清
        <span className="kw-muted">年率化回報 · % · 不同期間並非時間走勢</span>
      </figcaption>
      <p className="kw-muted">
        色深表示目前可用回報的絕對幅度；過期及未核實數值不著色、不參與色階。每格保留截至日期及來源。
      </p>
      <p className="kw-table-hint">左右滑動可查看三年、五年及十年回報</p>
      <div
        className="kw-table-wrap"
        tabIndex={0}
        role="region"
        aria-label="回報矩陣，可左右滑動查看所有期間"
      >
        <table className="kw-table">
          <thead>
            <tr>
              <th scope="col">基金類別</th>
              {["1", "3", "5", "10"].map((period) => (
                <th key={period} scope="col">
                  {period} 年
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <th scope="row">
                  <a href={row.href}>{row.label}</a>
                </th>
                {row.cells.map((cell) => {
                  const exists =
                    typeof cell.value === "number" &&
                    Number.isFinite(cell.value);
                  const eligible = exists && cell.status === "verified";
                  const colour = eligible
                    ? `rgba(${cell.value! < 0 ? "154,59,59" : "38,119,134"}, ${0.06 + (Math.abs(cell.value!) / max) * 0.22})`
                    : "var(--kw-soft)";
                  return (
                    <td key={cell.period} style={{ backgroundColor: colour }}>
                      <strong>{exists ? `${cell.value}%` : "未取得"}</strong>
                      <small>
                        {exists
                          ? cell.status === "verified"
                            ? "可用"
                            : cell.status === "stale"
                              ? "過期"
                              : "未核實"
                          : "缺資料"}
                        {cell.dataAsOf ? ` · ${cell.dataAsOf}` : ""}
                      </small>
                      {exists && cell.sourceUrl && (
                        <a
                          href={cell.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="kw-heatmap__source"
                        >
                          官方來源
                        </a>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
