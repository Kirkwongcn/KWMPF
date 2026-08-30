import { useEffect, useMemo, useState } from "react";
import { SiteChrome } from "./SiteChrome";
import { fundClassLabel, joinFundParts } from "./fundClassLabel";

type RankingRow = {
  fundClassId: string;
  fundClassName: string;
  constituentFundName: string;
  schemeName: string;
  trusteeName: string;
  comparisonGroup: string;
  displayValue: string;
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
      dataset: string;
      capturedAt: string;
    } | null;
  };
  rankings: RankingRow[];
};

const periodLabels = { "1": "一年", "5": "五年", "10": "十年" } as const;

type RankingMetric = "return" | "fee" | "risk";

const metricLabels = {
  return: "年率化回報",
  fee: "管理費（低至高）",
  risk: "波幅（低至高）",
} as const;

export function RankingsPage({
  apiBaseUrl,
  initialPeriod = "1",
  initialComparisonGroup = "all",
  initialMetric = "return",
}: {
  apiBaseUrl: string;
  initialPeriod?: "1" | "5" | "10";
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
  const [period, setPeriod] = useState<"1" | "5" | "10">(initialPeriod);
  const [metric, setMetric] = useState<RankingMetric>(initialMetric);

  useEffect(() => {
    setPublication(null);
    setFailed(false);
    const query = metric === "return" ? `period=${period}` : `metric=${metric}`;
    fetch(`${apiBaseUrl}/rankings?${query}`)
      .then((response) => {
        if (!response.ok) throw new Error("Rankings unavailable");
        return response.json() as Promise<PublishedRankings>;
      })
      .then(setPublication)
      .catch(() => setFailed(true));
  }, [apiBaseUrl, period, metric]);

  // 舊網址可能帶著已停用的平台分類組別。快照內完全沒有這個組別時退回「全部」，
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
      ? `只比較相同基金種類及配置組別，名次按官方${periodLabels[period]}年率化回報排列。`
      : metric === "fee"
        ? "只比較相同基金種類及配置組別，名次按官方當前管理費由低至高排列。"
        : "只比較相同基金種類及配置組別，名次按官方基金風險指標（年度化標準差）由低至高排列。";

  return (
    <SiteChrome
      current="rankings"
      eyebrow="同組基金比較"
      title={`${valueLabel}排名`}
      subtitle={subtitle}
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
                onChange={(event) =>
                  setMetric(event.target.value as RankingMetric)
                }
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
                  onChange={(event) =>
                    setPeriod(event.target.value as "1" | "5" | "10")
                  }
                >
                  <option value="1">一年</option>
                  <option value="5">五年</option>
                  <option value="10">十年</option>
                </select>
              </p>
            )}
            {publication && (
              <p className="kw-field">
                <label htmlFor="comparison-group">比較組別</label>
                <select
                  className="kw-control"
                  id="comparison-group"
                  value={effectiveGroup}
                  onChange={(event) => setComparisonGroup(event.target.value)}
                >
                  <option value="all">全部比較組別</option>
                  {comparisonGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </p>
            )}
          </div>
          <div className="kw-toolbar__notes">
            <p className="kw-muted">
              {metric === "return"
                ? "官方沒有提供三年年率化回報，本站不會由其他期間推算。同一比較組別內按回報由高至低排列。"
                : metric === "fee"
                  ? "管理費為官方公布的當前費率，不包括基金開支比率所涵蓋的歷史費用。"
                  : "波幅用官方公布的基金風險指標，即過去三年的年度化標準差。數字越低代表過往價格波動越小，不代表基金較佳或較適合你。成立不足三年的基金官方沒有這項數據，不會出現在此排名。"}
            </p>
            {publication && (
              <>
                <p className="kw-muted">
                  公開快照：<code>{publication.snapshotId}</code>
                </p>
                <p className="kw-muted">
                  {publication.methodology?.classification
                    ? `比較組別採用 ${publication.methodology.classification.provider}「${publication.methodology.classification.dataset}」（期別 ${publication.methodology.classification.capturedAt}），屬非官方來源；排名數值全部來自官方平台。`
                    : "比較組別分類屬非官方來源；排名數值全部來自官方平台。"}
                </p>
              </>
            )}
          </div>
        </div>
        {failed ? (
          <p className="kw-status kw-status--negative">
            暫時未能取得排名，現有公開快照不受影響，請稍後再試。
          </p>
        ) : !publication ? (
          <p className="kw-status">正在載入已發布排名…</p>
        ) : (
          <>
            {retiredGroup ? (
              <p className="kw-status kw-status--warning">
                {`比較組別已改用同類基金分類，「${retiredGroup}」不再是獨立組別，現顯示全部組別。`}
              </p>
            ) : null}
            {publication.excludedStaleCount ? (
              <p className="kw-status kw-status--warning">
                {`有 ${publication.excludedStaleCount} 隻基金的資料已超出官方披露寬限期（${publication.methodology?.freshness?.graceDays ?? 45} 日），暫不列入排名。這些數值仍可在各基金詳情頁連同原截至日期查看。`}
              </p>
            ) : null}
            {rankings?.length ? (
              <div className="kw-table-wrap">
                <table className="kw-table">
                  <thead>
                    <tr>
                      <th scope="col">名次</th>
                      <th scope="col">基金</th>
                      <th scope="col">{valueLabel}</th>
                      <th scope="col">比較組別</th>
                      <th scope="col">截至日期</th>
                      <th scope="col">來源</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((row) => (
                      <tr key={row.fundClassId}>
                        <td className="kw-rank">第 {row.rank}</td>
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
                        <td className="kw-return">{row.displayValue}</td>
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
            ) : (
              <p className="kw-status kw-status--warning">
                這個比較組別目前沒有合資格的{valueLabel}資料。
              </p>
            )}
            <p className="disclaimer">
              排名只反映同一比較組別內的單一官方指標，回報、費用及風險分開排序，不會合成推薦總分；過往表現不代表未來結果。
            </p>
          </>
        )}
      </section>
    </SiteChrome>
  );
}
