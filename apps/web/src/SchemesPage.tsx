import { useEffect, useMemo, useState } from "react";
import { SiteChrome } from "./SiteChrome";
import { fundClassLabel, joinFundParts } from "./fundClassLabel";

type SchemeFund = {
  id: string;
  constituentFundName: string;
  fundClassName: string;
  fundType: string;
  riskClass?: number;
  dataAsOf?: string;
  sourceUrl?: string;
  annualizedReturn1y?: number;
  annualizedReturn5y?: number;
  annualizedReturn10y?: number;
};

type Scheme = {
  schemeName: string;
  trusteeName: string;
  fundClassCount: number;
  fundTypes: string[];
  riskClassDistribution: Record<string, number>;
  managementFee: {
    min: number;
    median: number;
    max: number;
    fundCount: number;
  } | null;
  dataAsOf: { earliest: string; latest: string } | null;
  factSheet: {
    url: string;
    capturedAt: string;
    registerUrl: string;
  } | null;
  funds: SchemeFund[];
};

type Horizon = "1" | "5" | "10";

const horizons = {
  "1": { label: "一年", field: "annualizedReturn1y" },
  "5": { label: "五年", field: "annualizedReturn5y" },
  "10": { label: "十年", field: "annualizedReturn10y" },
} as const satisfies Record<
  Horizon,
  { label: string; field: keyof SchemeFund }
>;

function horizonReturn(fund: SchemeFund, horizon: Horizon) {
  const value = fund[horizons[horizon].field];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

/** 官方未提供該期間回報的基金排在最後，不會被當成 0% 混進排序。 */
function byHorizonReturnDescending(horizon: Horizon) {
  return (a: SchemeFund, b: SchemeFund) => {
    const left = horizonReturn(a, horizon);
    const right = horizonReturn(b, horizon);
    if (left !== undefined && right !== undefined && left !== right)
      return right - left;
    if ((left === undefined) !== (right === undefined))
      return left === undefined ? 1 : -1;
    return a.constituentFundName.localeCompare(b.constituentFundName);
  };
}

function dataAsOfLabel(dataAsOf: Scheme["dataAsOf"]) {
  if (!dataAsOf) return "官方未提供日期";
  return dataAsOf.earliest === dataAsOf.latest
    ? dataAsOf.latest
    : `${dataAsOf.earliest} – ${dataAsOf.latest}`;
}

export function SchemesPage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [schemes, setSchemes] = useState<Scheme[] | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "fee">("name");
  const [horizon, setHorizon] = useState<Horizon>("1");
  useEffect(() => {
    fetch(`${apiBaseUrl}/schemes`)
      .then((response) => response.json() as Promise<Scheme[]>)
      .then(setSchemes)
      .catch(() => setSchemes([]));
  }, [apiBaseUrl]);

  const sortedSchemes = useMemo(() => {
    if (!schemes) return schemes;
    if (sortBy === "name")
      return [...schemes].sort((a, b) =>
        a.schemeName.localeCompare(b.schemeName),
      );
    return [...schemes].sort((a, b) => {
      if (!a.managementFee) return b.managementFee ? 1 : 0;
      if (!b.managementFee) return -1;
      return a.managementFee.median - b.managementFee.median;
    });
  }, [schemes, sortBy]);

  return (
    <SiteChrome
      current="schemes"
      eyebrow="香港強積金比較"
      title="強積金計劃比較"
      subtitle="只統計同一發布快照內已核實的基金類別；每項統計均可追查至基金詳情。"
    >
      <section className="kw-section" aria-labelledby="schemes-title">
        <h2 className="kw-section__heading" id="schemes-title">
          計劃概覽
        </h2>
        <div className="kw-toolbar">
          <div className="kw-toolbar__controls">
            <p className="kw-field">
              <label htmlFor="scheme-sort">排序</label>
              <select
                className="kw-control"
                id="scheme-sort"
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as "name" | "fee")
                }
              >
                <option value="name">按計劃名稱</option>
                <option value="fee">按官方管理費中位數</option>
              </select>
            </p>
            <p className="kw-field">
              <label htmlFor="scheme-horizon">回報期間</label>
              <select
                className="kw-control"
                id="scheme-horizon"
                value={horizon}
                onChange={(event) => setHorizon(event.target.value as Horizon)}
              >
                {Object.entries(horizons).map(([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </p>
          </div>
          <div className="kw-toolbar__notes">
            <p className="kw-muted">
              計劃內的基金按所選期間的官方年率化回報由高至低排列，官方未提供回報的排在最後。
            </p>
            <p className="kw-muted">
              管理費不等於總開支；基金開支比率（FER）才反映完整成本，請於基金詳情查閱。
            </p>
            <p className="kw-muted">
              回報為官方年率化數值。不同基金種類的回報不能直接比較，同組比較請使用基金排名。
            </p>
          </div>
        </div>
        {schemes === null && <p className="kw-status">正在載入計劃資料…</p>}
        {schemes !== null && schemes.length === 0 && (
          <p className="kw-status kw-status--warning">
            目前沒有已發布的計劃資料。
          </p>
        )}
        <div className="kw-grid scheme-list">
          {sortedSchemes?.map((scheme) => {
            const mixedDates = Boolean(
              scheme.dataAsOf &&
              scheme.dataAsOf.earliest !== scheme.dataAsOf.latest,
            );
            const funds = [...scheme.funds].sort(
              byHorizonReturnDescending(horizon),
            );
            const withReturn = funds.filter(
              (fund) => horizonReturn(fund, horizon) !== undefined,
            ).length;
            return (
              <article key={scheme.schemeName} className="kw-card scheme-card">
                <h3>{scheme.schemeName}</h3>
                <p className="kw-muted scheme-card__trustee">
                  {scheme.trusteeName}
                </p>
                <dl className="status-list">
                  <div>
                    <dt>官方管理費</dt>
                    <dd>
                      {scheme.managementFee ? (
                        <>
                          <span className="kw-nowrap">
                            {scheme.managementFee.min.toFixed(2)}% –{" "}
                            {scheme.managementFee.max.toFixed(2)}%
                          </span>
                          <small className="kw-fee-note">
                            中位數 {scheme.managementFee.median.toFixed(2)}%
                          </small>
                          <small className="kw-fee-note">
                            {scheme.fundClassCount} 隻基金中{" "}
                            {scheme.managementFee.fundCount} 隻有官方管理費
                          </small>
                        </>
                      ) : (
                        "官方未提供"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>資料截至</dt>
                    <dd>
                      <span className="kw-nowrap">
                        {dataAsOfLabel(scheme.dataAsOf)}
                      </span>
                      {mixedDates && (
                        <small className="kw-fee-note">
                          同一計劃內基金的官方截至日期不同，比較時請留意。
                        </small>
                      )}
                    </dd>
                  </div>
                  <div className="status-list--wide">
                    <dt>基金類別數量</dt>
                    <dd>{scheme.fundClassCount}</dd>
                  </div>
                  <div className="status-list--wide">
                    <dt>風險級別分布</dt>
                    <dd>
                      <span className="kw-riskbar">
                        {Object.entries(scheme.riskClassDistribution).map(
                          ([risk, count]) => (
                            <span key={risk}>
                              級別 {risk}: {count}
                            </span>
                          ),
                        )}
                      </span>
                    </dd>
                  </div>
                </dl>
                {scheme.factSheet && (
                  <p className="kw-scheme-factsheet">
                    <a
                      href={scheme.factSheet.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${scheme.schemeName} 積金局基金便覽 PDF`}
                    >
                      積金局基金便覽（PDF）
                    </a>
                    <small className="kw-fee-note">
                      連結取自積金局註冊強積金計劃登記冊（
                      {scheme.factSheet.capturedAt}
                      ），文件按計劃發布，涵蓋計劃內全部成分基金。
                    </small>
                  </p>
                )}
                <details className="kw-disclosure">
                  <summary>基金種類（{scheme.fundTypes.length}）</summary>
                  <p className="kw-muted">{scheme.fundTypes.join("、")}</p>
                </details>
                {funds.length > 0 && (
                  <details className="kw-disclosure kw-fund-disclosure">
                    <summary>
                      <span>基金列表（{funds.length}）</span>
                      <small className="kw-fee-note">
                        {scheme.fundClassCount} 隻基金中 {withReturn} 隻有
                        {horizons[horizon].label}回報
                      </small>
                    </summary>
                    <ul className="kw-fund-list">
                      {funds.map((fund) => {
                        const value = horizonReturn(fund, horizon);
                        return (
                          <li key={fund.id}>
                            <a
                              href={`/fund-classes/${encodeURIComponent(fund.id)}`}
                              aria-label={`${fund.constituentFundName} 基金詳情`}
                            >
                              <strong>{fund.constituentFundName}</strong>
                              <small>
                                {joinFundParts(
                                  fundClassLabel(fund.fundClassName),
                                  fund.fundType,
                                )}
                              </small>
                            </a>
                            <span className="kw-fund-metrics">
                              <span className="kw-fund-return">
                                {horizons[horizon].label}年率化
                                {value === undefined
                                  ? "官方未提供"
                                  : ` ${value.toFixed(2)}%`}
                                {mixedDates && fund.dataAsOf && (
                                  <small className="kw-fund-asof">
                                    截至 {fund.dataAsOf}
                                  </small>
                                )}
                              </span>
                              <span className="kw-muted">
                                {typeof fund.riskClass === "number"
                                  ? `風險級別 ${fund.riskClass}`
                                  : "風險級別官方未提供"}
                              </span>
                              {fund.sourceUrl && (
                                <a
                                  className="kw-fund-source"
                                  href={fund.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label={`${fund.constituentFundName} 積金局基金資料`}
                                >
                                  積金局基金資料
                                </a>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </SiteChrome>
  );
}
