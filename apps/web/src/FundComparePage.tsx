import { useEffect, useState } from "react";
import { SiteChrome } from "./SiteChrome";
import { ValueBars, ReturnHeatmap } from "./DataCharts";
import { joinFundParts, fundClassLabel } from "./fundClassLabel";
type ComparedFund = {
  snapshotId: string;
  comparisonGroup?: string;
  fundClass: {
    constituentFundName: string;
    fundClassName: string;
    schemeName: string;
    annualizedReturn1y?: number;
    annualizedReturn3y?: number;
    annualizedReturn5y?: number;
    annualizedReturn10y?: number;
    managementFee?: number;
    latestFer?: number;
    fundRiskIndicator?: number;
    feeCaps?: string[];
    returnSources?: Record<string, { dataAsOf: string; sourceUrl: string }>;
  };
  provenance: { sourceUrl: string; dataAsOf: string };
  returnsFreshness?: Record<string, { status: string; dataAsOf: string }>;
};
const periods = [
  ["1", "annualizedReturn1y"],
  ["3", "annualizedReturn3y"],
  ["5", "annualizedReturn5y"],
  ["10", "annualizedReturn10y"],
] as const;
export function FundComparePage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const raw = new URLSearchParams(window.location.search).get("ids") ?? "";
  const ids = [...new Set(raw.split(",").filter(Boolean))];
  const [funds, setFunds] = useState<ComparedFund[] | null>(null),
    [failed, setFailed] = useState(false),
    [period, setPeriod] = useState("1");
  useEffect(() => {
    if (!raw || ids.length > 4) return;
    const controller = new AbortController();
    Promise.all(
      ids.map((id) =>
        fetch(`${apiBaseUrl}/fund-classes/${encodeURIComponent(id)}`, {
          signal: controller.signal,
        }).then(async (response) => {
          if (!response.ok) throw new Error("Unavailable");
          return response.json() as Promise<ComparedFund>;
        }),
      ),
    )
      .then((next) => {
        if (new Set(next.map((fund) => fund.snapshotId)).size !== 1)
          throw new Error("Snapshot changed");
        setFunds(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [apiBaseUrl, raw]);
  const periodField = periods.find((item) => item[0] === period)![1];
  const sameGroup =
    funds &&
    funds.every(
      (fund) =>
        fund.comparisonGroup &&
        fund.comparisonGroup === funds[0]?.comparisonGroup,
    );
  return (
    <SiteChrome
      title="基金並列比較"
      current="funds"
      subtitle="逐項比較最多四個基金類別；保留每個期間的來源及時效。"
    >
      <a href="/funds">返回基金瀏覽</a>
      {!raw || ids.length > 4 ? (
        <p className="kw-status">請在基金瀏覽頁選取 1 至 4 個基金。</p>
      ) : failed ? (
        <p className="kw-status" role="alert">
          未能取得同一快照的所有基金。請重新整理，或返回基金瀏覽重新選取。
        </p>
      ) : !funds ? (
        <p className="kw-status" role="status">
          正在載入基金比較…
        </p>
      ) : (
        <>
          {!sameGroup && (
            <p className="kw-status kw-status--warning">
              所選基金來自不同或未明確的比較組別。以下只並列數據，不作跨組別排名。
            </p>
          )}
          <div className="kw-toolbar">
            <label className="kw-field" htmlFor="compare-period">
              年率化回報期間
              <select
                id="compare-period"
                className="kw-control"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              >
                {periods.map(([value]) => (
                  <option key={value} value={value}>
                    {value} 年
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ReturnHeatmap
            rows={funds.map((fund, index) => ({
              label: joinFundParts(
                fund.fundClass.constituentFundName,
                fundClassLabel(fund.fundClass.fundClassName),
                fund.fundClass.schemeName,
              ),
              href: `/fund-classes/${encodeURIComponent(ids[index]!)}`,
              cells: periods.map(([key, field]) => ({
                period: key,
                value: fund.fundClass[field],
                status: fund.returnsFreshness?.[key]?.status,
                dataAsOf: fund.returnsFreshness?.[key]?.dataAsOf,
                sourceUrl:
                  fund.fundClass.returnSources?.[key]?.sourceUrl ??
                  fund.provenance.sourceUrl,
              })),
            }))}
          />
          <ValueBars
            variant="dot"
            label={`${period} 年年率化回報（只繪製未過期數值）`}
            rows={funds.map((fund, index) => ({
              label: joinFundParts(
                fund.fundClass.constituentFundName,
                fundClassLabel(fund.fundClass.fundClassName),
                fund.fundClass.schemeName,
              ),
              value:
                fund.returnsFreshness?.[period]?.status === "verified"
                  ? fund.fundClass[periodField]
                  : null,
              display:
                fund.returnsFreshness?.[period]?.status === "stale"
                  ? "過期，暫不繪圖"
                  : typeof fund.fundClass[periodField] === "number" &&
                      fund.returnsFreshness?.[period]?.status !== "verified"
                    ? "未核實，暫不繪圖"
                    : undefined,
              href: `/fund-classes/${encodeURIComponent(ids[index]!)}`,
              note: fund.returnsFreshness?.[period]?.dataAsOf
                ? `${fund.returnsFreshness[period].status === "stale" ? "過期 · " : ""}截至 ${fund.returnsFreshness[period].dataAsOf}`
                : "日期未記錄",
            }))}
          />
          <p className="kw-table-hint">左右滑動可查看所有基金及來源欄位</p>
          <div
            className="kw-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="基金並列數據"
          >
            <table className="kw-table">
              <caption>原始數值與來源（過期值仍保留）</caption>
              <thead>
                <tr>
                  <th scope="col">項目</th>
                  {funds.map((fund, index) => (
                    <th scope="col" key={index}>
                      <a
                        href={`/fund-classes/${encodeURIComponent(ids[index]!)}`}
                      >
                        {joinFundParts(
                          fund.fundClass.constituentFundName,
                          fundClassLabel(fund.fundClass.fundClassName),
                          fund.fundClass.schemeName,
                        )}
                      </a>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">計劃</th>
                  {funds.map((fund, index) => (
                    <td key={index}>{fund.fundClass.schemeName}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">比較組別（非官方分類）</th>
                  {funds.map((fund, index) => (
                    <td key={index}>{fund.comparisonGroup ?? "未提供"}</td>
                  ))}
                </tr>
                {periods.map(([key, field]) => (
                  <tr key={key}>
                    <th scope="row">{key} 年年率化回報</th>
                    {funds.map((fund, index) => (
                      <td key={index}>
                        {typeof fund.fundClass[field] === "number" ? (
                          <>
                            {fund.fundClass[field]}%
                            <small>
                              {fund.returnsFreshness?.[key]?.status === "stale"
                                ? "過期 · "
                                : ""}
                              {fund.returnsFreshness?.[key]?.dataAsOf
                                ? `截至 ${fund.returnsFreshness[key].dataAsOf}`
                                : "日期未記錄"}{" "}
                              ·{" "}
                              <a
                                href={
                                  fund.fundClass.returnSources?.[key]
                                    ?.sourceUrl ?? fund.provenance.sourceUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                              >
                                官方來源
                              </a>
                            </small>
                          </>
                        ) : (
                          "未取得"
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {(
                  [
                    ["managementFee", "管理費"],
                    ["latestFer", "基金開支比率（歷史期別）"],
                    ["fundRiskIndicator", "三年波幅"],
                  ] as const
                ).map(([field, label]) => (
                  <tr key={field}>
                    <th scope="row">{label}</th>
                    {funds.map((fund, index) => (
                      <td key={index}>
                        {typeof fund.fundClass[field] === "number"
                          ? `${fund.fundClass[field]}%${fund.fundClass.feeCaps?.includes(field) ? "（上限）" : ""}`
                          : "未取得"}
                        <small>
                          平台截至 {fund.provenance.dataAsOf} ·{" "}
                          <a
                            href={fund.provenance.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            官方來源
                          </a>
                        </small>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="kw-muted">
            回報期間是獨立披露，並非連續走勢；基金開支比率、管理費及波幅口徑不同，不合成總分。
          </p>
          <p className="kw-muted kw-advanced">
            公開快照：<code>{funds[0]?.snapshotId}</code>
          </p>
        </>
      )}
    </SiteChrome>
  );
}
