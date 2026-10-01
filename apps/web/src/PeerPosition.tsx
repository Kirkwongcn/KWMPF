import { useEffect, useState } from "react";
import {
  RangeChart,
  formatDerived,
  median,
  useWhenVisible,
  type RangeRow,
} from "./Charts";

type PeerRow = {
  fundClassId: string;
  comparisonGroup: string;
  value: number;
  displayValue: string;
  feeCap?: boolean;
  rank: number;
  dataAsOf: string;
};
type PeerPublication = { snapshotId: string; rankings: PeerRow[] };
const queries = [
  ["period=1", "一年回報"],
  ["period=3", "三年回報"],
  ["period=5", "五年回報"],
  ["period=10", "十年回報"],
  ["metric=fee", "管理費"],
  ["metric=risk", "波幅"],
] as const;

function toRow(
  label: string,
  publication: PeerPublication,
  group: string,
  fundClassId: string,
): RangeRow | null {
  const peers = publication.rankings.filter(
    (row) => row.comparisonGroup === group,
  );
  if (!peers.length) return null;
  const values = peers.map((row) => row.value);
  const own = peers.find((row) => row.fundClassId === fundClassId);
  const middle = median(values)!;
  const min = Math.min(...values),
    max = Math.max(...values);
  return {
    key: label,
    label,
    sub: `同組 ${peers.length} 隻合資格基金`,
    min,
    max,
    median: middle,
    marker: own
      ? { value: own.value, label: `本基金 ${own.displayValue}` }
      : undefined,
    value: own ? (
      <>
        {own.displayValue}
        {own.feeCap ? "（上限）" : ""}
        <small className="kw-range__rank">
          組內第 {own.rank}／{peers.length}
        </small>
      </>
    ) : (
      <small className="kw-range__rank">本基金未列入</small>
    ),
    summary: `${label}：同組 ${peers.length} 隻，範圍 ${min}% 至 ${max}%，中位數 ${formatDerived(middle)}（本站計算）；${own ? `本基金 ${own.displayValue}${own.feeCap ? "（上限）" : ""}，組內第 ${own.rank}` : "本基金沒有可排名的數值（過期或未取得）"}`,
  };
}

/** Where this fund sits inside its comparison group, metric by metric. */
export function PeerPosition({
  apiBaseUrl,
  fundClassId,
  comparisonGroup,
  snapshotId,
}: {
  apiBaseUrl: string;
  fundClassId: string;
  comparisonGroup: string;
  snapshotId: string;
}) {
  const { ref, visible, supported, reveal } = useWhenVisible<HTMLDivElement>();
  const [rows, setRows] = useState<Record<string, RangeRow | null> | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    Promise.all(
      queries.map(([query]) =>
        fetch(`${apiBaseUrl}/rankings?${query}`, {
          signal: controller.signal,
        }).then((response) => {
          if (!response.ok) throw new Error("Unavailable");
          return response.json() as Promise<PeerPublication>;
        }),
      ),
    )
      .then((publications) => {
        if (
          publications.some(
            (item) =>
              item.snapshotId !== snapshotId || !Array.isArray(item.rankings),
          )
        )
          throw new Error("Snapshot changed");
        setRows(
          Object.fromEntries(
            queries.map(([, label], index) => [
              label,
              toRow(label, publications[index]!, comparisonGroup, fundClassId),
            ]),
          ),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [apiBaseUrl, fundClassId, comparisonGroup, snapshotId, visible]);

  const legend = [
    { label: "同組範圍（官方原值）", color: "var(--kw-viz-context)" },
    {
      label: "中位數（本站計算）",
      color: "var(--kw-ink)",
      shape: "line" as const,
    },
    { label: "本基金", color: "var(--kw-viz-2)", shape: "dot" as const },
  ];
  const pick = (labels: string[]) =>
    labels.flatMap((label) => (rows?.[label] ? [rows[label]!] : []));
  const returnRows = pick(["一年回報", "三年回報", "五年回報", "十年回報"]);
  return (
    <div className="kw-peer" ref={ref}>
      {!visible ? (
        <p className="kw-status">
          {supported ? (
            "捲動至此時載入同組位置圖…"
          ) : (
            <button className="kw-button" type="button" onClick={reveal}>
              載入同組位置圖
            </button>
          )}
        </p>
      ) : failed ? (
        <p className="kw-status kw-status--negative" role="status">
          暫時未能取得同組數據；基金本身的資料不受影響。
        </p>
      ) : !rows ? (
        <p className="kw-status" role="status" aria-live="polite">
          正在讀取同組數據…
        </p>
      ) : (
        <>
          {returnRows.length > 0 && (
            <RangeChart
              title="本基金在同組的回報位置"
              subtitle={`比較組別：${comparisonGroup}（非官方分類）· 各期間年率化回報，共同尺度`}
              legend={legend}
              rows={returnRows}
              note="只計同一快照內未過期的官方數值；不同期間是獨立披露，不構成時間走勢。"
            />
          )}
          <div className="kw-viz-grid">
            {pick(["波幅"]).map((row) => (
              <RangeChart
                key="risk"
                title="波幅位置"
                subtitle="官方基金風險指標（三年年度化標準差）"
                rows={[row]}
                legend={legend}
                note="波幅較低代表過往價格波動較小，不代表較佳。"
              />
            ))}
            {pick(["管理費"]).map((row) => (
              <RangeChart
                key="fee"
                title="管理費位置"
                subtitle="由低至高；費率較低不代表總開支較低"
                rows={[row]}
                legend={legend}
                note="官方以上限披露的費率按上限值比較。"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
