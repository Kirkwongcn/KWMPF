import { useEffect, useMemo, useState } from "react";
import { SiteChrome } from "./SiteChrome";

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
  rankings: RankingRow[];
};

const periodLabels = { "1": "一年", "5": "五年", "10": "十年" } as const;

export function RankingsPage({
  apiBaseUrl,
  initialPeriod = "1",
  initialComparisonGroup = "all",
}: {
  apiBaseUrl: string;
  initialPeriod?: "1" | "5" | "10";
  initialComparisonGroup?: string;
}) {
  const [publication, setPublication] = useState<PublishedRankings | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const [comparisonGroup, setComparisonGroup] = useState(
    initialComparisonGroup,
  );
  const [period, setPeriod] = useState<"1" | "5" | "10">(initialPeriod);

  useEffect(() => {
    setPublication(null);
    setFailed(false);
    fetch(`${apiBaseUrl}/rankings?period=${period}`)
      .then((response) => {
        if (!response.ok) throw new Error("Rankings unavailable");
        return response.json() as Promise<PublishedRankings>;
      })
      .then(setPublication)
      .catch(() => setFailed(true));
  }, [apiBaseUrl, period]);

  const comparisonGroups = useMemo(
    () =>
      [
        ...new Set([
          ...(publication?.rankings.map((row) => row.comparisonGroup) ?? []),
          ...(comparisonGroup === "all" ? [] : [comparisonGroup]),
        ]),
      ].sort((a, b) => a.localeCompare(b)),
    [publication, comparisonGroup],
  );
  const rankings =
    comparisonGroup === "all"
      ? publication?.rankings
      : publication?.rankings.filter(
          (row) => row.comparisonGroup === comparisonGroup,
        );

  return (
    <SiteChrome
      current="rankings"
      eyebrow="同組基金比較"
      title={`${periodLabels[period]}回報排名`}
      subtitle={`只比較相同基金種類及配置組別，名次按官方${periodLabels[period]}年率化回報排列。`}
    >
      <section className="kw-section" aria-labelledby="ranking-table-title">
        <h2 className="kw-section__heading" id="ranking-table-title">
          已發布基金排名
        </h2>
        <div className="kw-ranking-controls">
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
          <p className="kw-muted">
            官方沒有提供三年年率化回報，本站不會由其他期間推算。
          </p>
        </div>
        {failed ? (
          <p className="kw-status kw-status--negative">
            暫時未能取得排名，現有公開快照不受影響，請稍後再試。
          </p>
        ) : !publication ? (
          <p className="kw-status">正在載入已發布排名…</p>
        ) : (
          <>
            <div className="kw-ranking-controls">
              <label htmlFor="comparison-group">比較組別</label>
              <select
                className="kw-control"
                id="comparison-group"
                value={comparisonGroup}
                onChange={(event) => setComparisonGroup(event.target.value)}
              >
                <option value="all">全部比較組別</option>
                {comparisonGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
              <p className="kw-muted">
                公開快照：<code>{publication.snapshotId}</code>
              </p>
            </div>
            {rankings?.length ? (
              <div className="kw-table-wrap">
                <table className="kw-table">
                  <thead>
                    <tr>
                      <th scope="col">名次</th>
                      <th scope="col">基金</th>
                      <th scope="col">比較組別</th>
                      <th scope="col">{periodLabels[period]}回報</th>
                      <th scope="col">截至日期</th>
                      <th scope="col">來源</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((row) => (
                      <tr key={row.fundClassId}>
                        <td className="kw-rank">第 {row.rank}</td>
                        <td>
                          <a
                            href={`/fund-classes/${encodeURIComponent(row.fundClassId)}`}
                            aria-label={`查看 ${row.constituentFundName} 詳情`}
                          >
                            {row.constituentFundName}
                          </a>
                          <small>
                            {row.fundClassName} · {row.schemeName}
                          </small>
                        </td>
                        <td>{row.comparisonGroup}</td>
                        <td className="kw-return">{row.displayValue}</td>
                        <td>{row.dataAsOf}</td>
                        <td>
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
                這個比較組別目前沒有合資格的{periodLabels[period]}回報資料。
              </p>
            )}
            <p className="disclaimer">
              排名只反映同一比較組別內的單一歷史回報指標，不代表基金推薦；過往表現不代表未來結果。
            </p>
          </>
        )}
      </section>
    </SiteChrome>
  );
}
