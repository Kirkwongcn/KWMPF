export type BarDatum = {
  label: string;
  value?: number | null;
  display?: string;
  href?: string;
  note?: string;
};
/** One shared, zero-based scale per chart; absent values never become bars. */
export function ValueBars({
  rows,
  label,
  unit = "%",
}: {
  rows: BarDatum[];
  label: string;
  unit?: string;
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
                {row.note && <small>{row.note}</small>}
              </div>
              <div className="kw-bars__plot" aria-hidden="true">
                <span className="kw-bars__zero" style={{ left: `${zero}%` }} />
                {valid && (
                  <span
                    className={`kw-bars__bar${row.value! < 0 ? " kw-bars__bar--negative" : ""}`}
                    style={{
                      left: `${Math.min(zero, end)}%`,
                      width: `${Math.abs(end - zero)}%`,
                    }}
                  />
                )}
              </div>
              <strong className="kw-bars__value">
                {valid
                  ? (row.display ?? `${row.value}${unit}`)
                  : (row.display ?? "官方未提供")}
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
              {period.stale} 過期 · {period.missing} 官方未提供
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
          官方未提供
        </span>
      </div>
    </figure>
  );
}
export function AllocationChart({
  entries,
  heading,
}: {
  entries: { label: string; percent: number }[];
  heading: string;
}) {
  const sum = entries.reduce((total, entry) => total + entry.percent, 0);
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
      <div className="kw-allocation__track" aria-hidden="true">
        {entries.map((entry, index) => (
          <span
            key={index}
            className={`kw-allocation__part kw-allocation__part--${index % 6}`}
            style={{ width: `${(entry.percent / sum) * 100}%` }}
          />
        ))}
      </div>
      <ul>
        {entries.map((entry, index) => (
          <li key={index}>
            <i className={`kw-allocation__part--${index % 6}`} />
            <span>{entry.label}</span>
            <strong>{entry.percent}%</strong>
          </li>
        ))}
      </ul>
      {sum !== 100 && (
        <p className="kw-muted">
          披露合計 {sum}%；圖形按合計調整長度，數字保留原值。
        </p>
      )}
    </figure>
  );
}
