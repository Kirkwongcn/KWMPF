import { useEffect, useState } from "react";
import { SiteChrome } from "./SiteChrome";
import { ArrowIcon } from "./ArrowIcon";
import { AvailabilityChart, type DataQuality } from "./DataCharts";
type Summary = {
  snapshotId: string | null;
  fundClassCount: number;
  schemeCount: number;
  trusteeCount: number;
  dataAsOf: { earliest: string; latest: string } | null;
};
export function App({ apiUrl }: { apiUrl: string }) {
  const [summary, setSummary] = useState<Summary | null>(null),
    [quality, setQuality] = useState<DataQuality | null>(null),
    [failed, setFailed] = useState(false),
    [query, setQuery] = useState("");
  useEffect(() => {
    const controller = new AbortController(),
      origin = new URL(apiUrl).origin;
    Promise.all([
      fetch(`${origin}/summary`, { signal: controller.signal }),
      fetch(`${origin}/data-quality`, { signal: controller.signal }),
    ])
      .then(async ([a, b]) => {
        if (!a.ok || !b.ok) throw new Error("Data unavailable");
        const nextSummary = (await a.json()) as Summary,
          nextQuality = (await b.json()) as DataQuality;
        if (
          !nextSummary.snapshotId ||
          nextSummary.snapshotId !== nextQuality.snapshotId
        )
          throw new Error("Snapshot changed");
        setSummary(nextSummary);
        setQuality(nextQuality);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [apiUrl]);
  return (
    <SiteChrome isHome title="查清資料，再作比較">
      <section className="kw-home-intro" aria-labelledby="home-search-title">
        <div className="kw-home-intro__search">
          <h2 id="home-search-title">搜尋及查閱</h2>
          <p className="kw-home-intro__lead">
            查閱基金、比較同類表現，逐項核對費用、風險與官方來源。
          </p>
          <form className="search-form" action="/funds" method="get">
            <label htmlFor="fund-search">搜尋基金、計劃或受託人</label>
            <div>
              <input
                className="kw-control"
                id="fund-search"
                name="q"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={120}
                placeholder="例如：滙豐、富達、保守基金"
              />
              <button className="kw-button" type="submit">
                搜尋基金
              </button>
            </div>
          </form>
          <p className="kw-search-help">
            可用中文常用名稱或英文名稱；結果保留官方名稱。
          </p>
          <div className="kw-home-shortcuts">
            <a href="/funds">瀏覽全部基金</a>
            <a href="/rankings">按同類組別比較</a>
          </div>
        </div>
        <aside className="kw-home-intro__quality">
          {quality ? (
            <AvailabilityChart quality={quality} />
          ) : (
            <div className="kw-loading-block" role="status">
              {failed ? (
                <>
                  未能載入資料覆蓋。<a href="/data-status">查看資料狀態</a>
                  ，或重新整理再試。
                </>
              ) : (
                "正在讀取回報資料覆蓋…"
              )}
            </div>
          )}
          <a className="kw-text-link" href="/data-status">
            查看截至日期及缺口
          </a>
        </aside>
      </section>
      <section className="kw-coverage-strip" aria-label="已發布資料範圍">
        {summary ? (
          <>
            <span>
              <strong>{summary.fundClassCount}</strong> 個基金類別
            </span>
            <span>
              <strong>{summary.schemeCount}</strong> 個計劃
            </span>
            <span>
              <strong>{summary.trusteeCount}</strong> 個受託人
            </span>
            <span>
              平台資料截至{" "}
              <strong>{summary.dataAsOf?.latest ?? "官方未提供"}</strong>
            </span>
          </>
        ) : (
          <span>{failed ? "資料範圍暫時無法取得" : "正在讀取公開快照…"}</span>
        )}
      </section>
      <section className="kw-task-section" aria-labelledby="next-title">
        <div>
          <h2 id="next-title">由你的問題出發</h2>
          <p className="kw-muted">
            所有比較都保留來源；缺失與過期資料分開呈現。
          </p>
        </div>
        <div className="kw-task-list">
          <a href="/funds">
            <span>
              <strong>找出你持有的基金</strong>
              <small>查閱回報、費用、配置與持倉</small>
            </span>
            <span>
              <ArrowIcon />
            </span>
          </a>
          <a href="/rankings">
            <span>
              <strong>比較同類基金表現</strong>
              <small>回報、費用、波幅分開排序</small>
            </span>
            <span>
              <ArrowIcon />
            </span>
          </a>
          <a href="/schemes">
            <span>
              <strong>了解不同計劃</strong>
              <small>並列最多四個計劃的實際數據</small>
            </span>
            <span>
              <ArrowIcon />
            </span>
          </a>
        </div>
      </section>
      <section className="kw-research-note kw-advanced">
        <h2>深入分析，先看資料邊界。</h2>
        <p>
          平台快照與受託人便覽的日期可能不同。三年回報採用最長 90
          日的網站門檻；其他排名指標一般為 45
          日。切換期間後，可排名的基金數量會改變。
        </p>
        <a href="/methodology">閱讀完整比較方法</a>
        <p className="kw-muted">公開快照：{summary?.snapshotId ?? "讀取中"}</p>
      </section>
    </SiteChrome>
  );
}
