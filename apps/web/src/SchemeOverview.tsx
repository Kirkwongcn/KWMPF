import { useState } from "react";
import {
  RangeChart,
  StackedBars,
  VIZ_ORDINAL,
  VIZ_SERIES,
  formatDerived,
} from "./Charts";

type OverviewScheme = {
  schemeName: string;
  trusteeName: string;
  fundClassCount: number;
  riskClassDistribution: Record<string, number>;
  managementFee: {
    min: number;
    median: number;
    max: number;
    fundCount: number;
  } | null;
  funds: { fundType: string }[];
};
type View = "fee" | "risk" | "types";

// Official MPFA fund-type families (the part of fundType before " - ").
const fundTypes = [
  ["Equity Fund", "股票基金"],
  ["Mixed Assets Fund", "混合資產基金"],
  ["Bond Fund", "債券基金"],
  ["Money Market Fund", "貨幣市場基金"],
  ["Guaranteed Fund", "保證基金"],
] as const;

export function SchemeOverview({ schemes }: { schemes: OverviewScheme[] }) {
  const [view, setView] = useState<View>("risk");
  if (!schemes.length) return null;
  const withFee = schemes
    .filter((scheme) => scheme.managementFee)
    .sort((a, b) => a.managementFee!.median - b.managementFee!.median);
  const typeSeries = [
    ...fundTypes.map(([key, label], index) => ({
      key,
      label,
      color: VIZ_SERIES[index]!,
    })),
    { key: "other", label: "其他官方種類", color: "var(--kw-viz-context)" },
  ];
  const typeRows = schemes.map((scheme) => {
    const values: Record<string, number> = {};
    for (const fund of scheme.funds) {
      const family = fund.fundType.split(" - ")[0] ?? "";
      const key = fundTypes.some(([name]) => name === family)
        ? family
        : "other";
      values[key] = (values[key] ?? 0) + 1;
    }
    return {
      key: scheme.schemeName,
      label: scheme.schemeName,
      sub: scheme.trusteeName,
      plainLabel: scheme.schemeName,
      values,
    };
  });
  const usedTypeSeries = typeSeries.filter((item) =>
    typeRows.some((row) => row.values[item.key]),
  );
  return (
    <section
      className="kw-scheme-overview"
      aria-labelledby="scheme-overview-title"
    >
      <header className="kw-section-head">
        <p className="kw-section-head__kicker">計劃一覽</p>
        <h2 id="scheme-overview-title">
          {schemes.length} 個計劃，三個角度並列
        </h2>
        <p className="kw-muted">
          跟隨上方搜尋條件；數值來自同一發布快照，統計方法在每幅圖下方註明。
        </p>
      </header>
      <div className="kw-filter-row">
        <div className="kw-segmented" role="group" aria-label="計劃一覽圖表">
          {(
            [
              ["risk", "風險級別分布"],
              ["types", "基金種類組合"],
              ["fee", "管理費範圍"],
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
      </div>
      {view === "fee" && (
        <RangeChart
          title="各計劃管理費範圍"
          subtitle="按中位數由低至高排列；灰線為計劃內最低至最高"
          legend={[
            { label: "計劃內範圍（官方原值）", color: "var(--kw-viz-context)" },
            {
              label: "中位數（本站計算）",
              color: "var(--kw-ink)",
              shape: "line",
            },
          ]}
          rows={withFee.map((scheme) => {
            const fee = scheme.managementFee!;
            return {
              key: scheme.schemeName,
              label: scheme.schemeName,
              sub: scheme.trusteeName,
              min: fee.min,
              max: fee.max,
              median: fee.median,
              value: `${fee.fundCount} 隻`,
              summary: `${scheme.schemeName}：管理費 ${fee.min}% 至 ${fee.max}%，中位數 ${formatDerived(fee.median)}（本站計算），${fee.fundCount} 隻有官方管理費`,
            };
          })}
          note="管理費不等於總開支；基金開支比率（FER）請於基金詳情查閱。中位數只計有官方管理費的基金類別，覆蓋率見下方各計劃卡。"
          table={{
            caption: "各計劃管理費範圍",
            columns: [
              "計劃",
              "受託人",
              "最低",
              "中位數（本站計算）",
              "最高",
              "有官方管理費的基金",
            ],
            rows: withFee.map((scheme) => [
              scheme.schemeName,
              scheme.trusteeName,
              `${scheme.managementFee!.min}%`,
              formatDerived(scheme.managementFee!.median),
              `${scheme.managementFee!.max}%`,
              `${scheme.managementFee!.fundCount}`,
            ]),
          }}
        />
      )}
      {view === "risk" && (
        <StackedBars
          title="各計劃基金的風險級別分布"
          subtitle="積金局風險級別 1（波動較低）至 7（波動較高）；每條代表計劃內有級別的基金類別"
          series={VIZ_ORDINAL.map((color, index) => ({
            key: String(index + 1),
            label: `級別 ${index + 1}`,
            color,
          }))}
          rows={schemes.map((scheme) => ({
            key: scheme.schemeName,
            label: scheme.schemeName,
            sub: scheme.trusteeName,
            plainLabel: scheme.schemeName,
            values: scheme.riskClassDistribution,
          }))}
          note="官方沒有提供風險級別的基金（例如成立不足三年）不計入，因此合計可能少於計劃的基金類別數目。"
        />
      )}
      {view === "types" && (
        <StackedBars
          title="各計劃的官方基金種類組合"
          subtitle="按積金局基金種類的大類點算基金類別數目"
          series={usedTypeSeries}
          rows={typeRows}
          note="基金種類取自積金局平台；大類只取官方名稱中「 - 」之前的部分，不是本站分類。"
        />
      )}
    </section>
  );
}
