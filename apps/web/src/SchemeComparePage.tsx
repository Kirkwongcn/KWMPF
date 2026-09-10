import { useEffect, useMemo, useState } from "react";
import { SiteChrome } from "./SiteChrome";

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

const schemeColors = ["#0f414e", "#267786", "#c7a66a", "#9a3b3b"] as const;

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
    .filter((id, index, all) => id.length > 0 && all.indexOf(id) === index)
    .slice(0, 4);
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatRange(band: DisReturnBand | FeeRange | null) {
  if (!band) return "官方未提供";
  if (band.min === band.max) return formatPercent(band.min);
  return `${formatPercent(band.min)} – ${formatPercent(band.max)}`;
}

function midpoint(band: DisReturnBand) {
  if (!band) return null;
  return (band.min + band.max) / 2;
}

type RadarAxisKey = "fundChoiceCount" | "fer" | "disCore1y" | "disAge651y";

const radarAxes: Array<{
  key: RadarAxisKey;
  label: string;
  higherIsBetter: boolean;
}> = [
  { key: "fundChoiceCount", label: "基金選擇", higherIsBetter: true },
  { key: "fer", label: "FER", higherIsBetter: false },
  { key: "disCore1y", label: "DIS核心1年", higherIsBetter: true },
  { key: "disAge651y", label: "DIS65歲1年", higherIsBetter: true },
];

function radarRawValue(scheme: ComparedScheme, key: RadarAxisKey) {
  if (key === "fundChoiceCount") return scheme.fundChoiceCount;
  if (key === "fer") {
    return scheme.fer ? scheme.fer.median : null;
  }
  if (scheme.disPerformance.status !== "complete") return null;
  if (key === "disCore1y")
    return midpoint(
      scheme.disPerformance.coreAccumulation?.returns["1y"] ?? null,
    );
  return midpoint(scheme.disPerformance.age65Plus?.returns["1y"] ?? null);
}

/** 只在今次揀中的計劃之間做 0–100 相對分數；缺值唔當成 0。 */
function radarScores(schemes: ComparedScheme[]) {
  const ranges = Object.fromEntries(
    radarAxes.map(({ key, higherIsBetter }) => {
      const values = schemes
        .map((scheme) => radarRawValue(scheme, key))
        .filter((value): value is number => typeof value === "number");
      if (values.length === 0) return [key, null];
      const min = Math.min(...values);
      const max = Math.max(...values);
      return [key, { min, max, higherIsBetter }];
    }),
  ) as Record<
    RadarAxisKey,
    { min: number; max: number; higherIsBetter: boolean } | null
  >;

  return schemes.map((scheme) => ({
    scheme,
    incompleteDis: scheme.disPerformance.status !== "complete",
    scores: Object.fromEntries(
      radarAxes.map(({ key }) => {
        const value = radarRawValue(scheme, key);
        const range = ranges[key];
        if (value === null || !range) return [key, null];
        if (range.max === range.min) return [key, 50];
        const ratio = (value - range.min) / (range.max - range.min);
        return [key, (range.higherIsBetter ? ratio : 1 - ratio) * 100];
      }),
    ) as Record<RadarAxisKey, number | null>,
  }));
}

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function SchemeCompareRadar({ schemes }: { schemes: ComparedScheme[] }) {
  const scored = useMemo(() => radarScores(schemes), [schemes]);
  const size = 360;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = 108;
  const axisCount = radarAxes.length;

  return (
    <div className="scheme-compare-radar">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="計劃比較雷達圖：基金選擇、FER、DIS 核心累積一年回報、DIS 65歲後一年回報，各軸獨立標準化為 0 至 100 分"
      >
        {[0.25, 0.5, 0.75, 1].map((scale) => {
          const points = radarAxes
            .map((_, index) => {
              const angle = -Math.PI / 2 + (index * 2 * Math.PI) / axisCount;
              const point = polarPoint(cx, cy, maxRadius * scale, angle);
              return `${point.x},${point.y}`;
            })
            .join(" ");
          return (
            <polygon
              key={scale}
              className="scheme-compare-radar__grid"
              points={points}
            />
          );
        })}
        {radarAxes.map((axis, index) => {
          const angle = -Math.PI / 2 + (index * 2 * Math.PI) / axisCount;
          const end = polarPoint(cx, cy, maxRadius, angle);
          const label = polarPoint(cx, cy, maxRadius + 36, angle);
          const anchor =
            Math.abs(Math.cos(angle)) < 0.1
              ? "middle"
              : Math.cos(angle) > 0
                ? "start"
                : "end";
          return (
            <g key={axis.key}>
              <line
                className="scheme-compare-radar__axis"
                x1={cx}
                y1={cy}
                x2={end.x}
                y2={end.y}
              />
              <text
                className="scheme-compare-radar__label"
                x={label.x}
                y={label.y}
                textAnchor={anchor}
                dominantBaseline="middle"
              >
                {axis.label}
              </text>
            </g>
          );
        })}
        {scored.map(({ scheme, scores, incompleteDis }, schemeIndex) => {
          const points = radarAxes.map((axis, index) => {
            const angle = -Math.PI / 2 + (index * 2 * Math.PI) / axisCount;
            const score = scores[axis.key];
            // 缺值唔畫到中心（會被誤讀成最低分），改畫在外框內側虛線位置並用虛線多邊形標示。
            const radius =
              score === null ? maxRadius * 0.08 : (score / 100) * maxRadius;
            return polarPoint(cx, cy, radius, angle);
          });
          const polygon = points
            .map((point) => `${point.x},${point.y}`)
            .join(" ");
          const color = schemeColors[schemeIndex % schemeColors.length]!;
          return (
            <polygon
              key={scheme.id}
              points={polygon}
              fill={color}
              fillOpacity={incompleteDis ? 0.08 : 0.18}
              stroke={color}
              strokeWidth={incompleteDis ? 1.5 : 2}
              strokeDasharray={incompleteDis ? "5 4" : undefined}
            />
          );
        })}
      </svg>
      <ul className="scheme-compare-radar__legend">
        {scored.map(({ scheme, incompleteDis }, index) => (
          <li key={scheme.id}>
            <span
              className="scheme-compare-radar__swatch"
              style={{ background: schemeColors[index % schemeColors.length] }}
              aria-hidden="true"
            />
            <span>
              {scheme.schemeName}
              {incompleteDis && (
                <small className="scheme-compare-badge">DIS 不完整</small>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="kw-muted" role="note">
        雷達圖各軸只在今次比較的計劃之間標準化成 0–100
        分，並非單一總分，亦不是官方評分。FER 愈低分愈高；DIS
        回報用一年年率化中位數。虛線表示該計劃 DIS
        表現不完整，對應軸沒有可比較數值。
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
      subtitle="一次最多比較 4 個計劃。表格列出官方可追溯數字；雷達圖只做相對視覺化，不會合成單一總分。"
    >
      <p className="kw-compare-back">
        <a href="/schemes">← 返回計劃概覽</a>
      </p>

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
            <p className="kw-muted">
              快照 {result.snapshotId ?? "尚未發布"}。行政評分 v1
              暫不評分，欄位預留為空。
            </p>
            <div className="kw-table-scroll">
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
                    <th scope="row">FER 範圍</th>
                    {result.schemes.map((scheme) => (
                      <td key={scheme.id}>
                        {scheme.fer ? (
                          <>
                            <span className="kw-nowrap">
                              {formatRange(scheme.fer)}
                            </span>
                            <small className="kw-fee-note">
                              中位數 {formatPercent(scheme.fer.median)}；
                              {scheme.fer.fundCount} 隻有 FER
                            </small>
                          </>
                        ) : (
                          "官方未提供"
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">行政評分</th>
                    {result.schemes.map((scheme) => (
                      <td key={scheme.id}>
                        {scheme.administrationScore === null
                          ? "v1 暫不評分"
                          : scheme.administrationScore}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">DIS 表現</th>
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
                              完整
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
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    },
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section
            className="kw-section"
            aria-labelledby="scheme-compare-radar-title"
          >
            <h2 className="kw-section__heading" id="scheme-compare-radar-title">
              雷達圖概覽
            </h2>
            <SchemeCompareRadar schemes={result.schemes} />
          </section>
        </>
      )}
    </SiteChrome>
  );
}
