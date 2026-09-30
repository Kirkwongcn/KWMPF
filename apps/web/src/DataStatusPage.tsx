import { useEffect, useState } from "react";
import { SiteChrome } from "./SiteChrome";
import { AvailabilityChart, type DataQuality } from "./DataCharts";
export function DataStatusPage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [quality, setQuality] = useState<DataQuality | null>(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBaseUrl}/data-quality`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unavailable");
        const next = (await response.json()) as DataQuality;
        if (!next.snapshotId) throw new Error("No publication");
        setQuality(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [apiBaseUrl]);
  return (
    <SiteChrome
      title="資料時效與覆蓋"
      current="data"
      subtitle="擷取時間、官方截至日期和可排名狀態分開呈現。"
    >
      {quality ? (
        <>
          <div className="kw-status-layout">
            <AvailabilityChart quality={quality} />
            <section className="kw-publication">
              <h2>目前公開快照</h2>
              <dl>
                <dt>平台基金類別</dt>
                <dd>{quality.fundClassCount}</dd>
                <dt>時效評估日</dt>
                <dd>{quality.evaluatedOn}（UTC）</dd>
                <dt>最近來源擷取</dt>
                <dd>{quality.retrievedAt ?? "未記錄"}</dd>
                <dt>快照識別</dt>
                <dd>
                  <code>{quality.snapshotId}</code>
                </dd>
              </dl>
              <p className="kw-muted">
                擷取成功不代表來源已更新；排名採用各欄位的官方截至日期。
              </p>
            </section>
          </div>
          <p className="kw-table-hint">左右滑動可查看完整數量及日期範圍</p>
          <div
            className="kw-table-wrap"
            role="region"
            aria-label="回報時效明細"
            tabIndex={0}
          >
            <table className="kw-table">
              <caption>每個期間的資料邊界</caption>
              <thead>
                <tr>
                  <th scope="col">期間</th>
                  <th scope="col">可排名</th>
                  <th scope="col">過期</th>
                  <th scope="col">官方未提供</th>
                  <th scope="col">未核實</th>
                  <th scope="col">已提供數值的截至日期範圍</th>
                </tr>
              </thead>
              <tbody>
                {quality.returns.map((period) => (
                  <tr key={period.periodYears}>
                    <th scope="row">{period.periodYears} 年</th>
                    <td>{period.eligible}</td>
                    <td>{period.stale}</td>
                    <td>{period.missing}</td>
                    <td>{period.unverified}</td>
                    <td>
                      {period.dataAsOf
                        ? `${period.dataAsOf.earliest} 至 ${period.dataAsOf.latest}`
                        : "官方未提供"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="kw-status" role="status">
          {failed
            ? "未能讀取資料品質，請重新整理再試。"
            : "正在讀取已發布資料…"}
        </p>
      )}
      <section className="kw-prose kw-section">
        <h2>怎樣理解這些狀態</h2>
        <dl>
          <dt>可排名</dt>
          <dd>
            官方數值及來源已核實，欄位日期未超出網站門檻。只可在同一比較組別內排序。
          </dd>
          <dt>過期</dt>
          <dd>
            數值仍保留在詳情頁；已超出時效門檻、日期不合法或日期在未來，因此排除排名。
          </dd>
          <dt>官方未提供</dt>
          <dd>本快照沒有該期間的可用官方數值，並不代表回報為零。</dd>
          <dt>未核實</dt>
          <dd>數值或來源未通過核實，不用於公開比較。</dd>
        </dl>
        <p>
          三年回報最長 90 日；其他回報一般為 45
          日。這是本站資料政策，並非受託人的统一法律發布期限。快取有效期最長約
          15 分鐘，UTC 日期切換時可能短暫沿用前一天狀態。
        </p>
        <a href="/methodology">查看來源、排名規則與限制</a>
      </section>
    </SiteChrome>
  );
}
