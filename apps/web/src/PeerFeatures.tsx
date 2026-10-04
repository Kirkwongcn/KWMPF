import { useEffect, useState } from "react";
import { formatDerived } from "./Charts";

/**
 * 基金特色的同類位置（ADR 0012 第 6 點）：規模、成立年期、波幅、管理費喺同一積金局
 * 基金類型入面排喺邊。全部係本站計算，只講位置，唔講好壞；管理費放最後（費用置後）。
 */

type FeatureKey = "fundSize" | "fundAge" | "volatility" | "managementFee";

type FeaturePosition = {
  key: FeatureKey;
  value?: number;
  staleValue?: number;
  asOf?: string;
  excludedReason?: "missing" | "stale" | "unverified";
  peerCount: number;
  rank?: number;
  quartile?: 1 | 2 | 3 | 4;
  median?: number;
  feeCap?: true;
};

type FeaturesResponse = {
  snapshotId: string;
  comparisonGroup: string;
  groupMemberCount: number;
  methodology: { rule: string; minPeersForQuartile: number };
  positions: FeaturePosition[];
};

const DAYS_PER_YEAR = 365.25;

/** 官方值照原值顯示；成立年期係本站由成立日期計出嚟，標明「本站計算」。 */
const features: Record<
  FeatureKey,
  {
    label: string;
    value: (value: number) => string;
    derivedValue?: true;
    median: (value: number) => string;
    rank: (rank: number, count: number) => string;
    ends: [string, string];
  }
> = {
  fundSize: {
    label: "基金規模",
    value: (value) => `HK$${String(value)} 百萬`,
    median: (value) => `HK$${formatDerived(value, "")} 百萬`,
    rank: (rank, count) => `同類 ${count} 隻中第 ${rank} 大`,
    ends: ["較大", "較小"],
  },
  fundAge: {
    label: "成立年期",
    value: (days) => `約 ${(days / DAYS_PER_YEAR).toFixed(1)} 年`,
    derivedValue: true,
    median: (days) => `約 ${(days / DAYS_PER_YEAR).toFixed(1)} 年`,
    rank: (rank, count) => `同類 ${count} 隻中第 ${rank} 早成立`,
    ends: ["較早成立", "較遲成立"],
  },
  volatility: {
    label: "波幅（基金風險指標）",
    value: (value) => `${String(value)}%`,
    median: (value) => formatDerived(value),
    rank: (rank, count) => `同類 ${count} 隻中第 ${rank} 低`,
    ends: ["波幅較低", "波幅較高"],
  },
  managementFee: {
    label: "管理費",
    value: (value) => `${String(value)}%`,
    median: (value) => formatDerived(value),
    rank: (rank, count) => `同類 ${count} 隻中第 ${rank} 低`,
    ends: ["收費較低", "收費較高"],
  },
};

const quartileNames = [
  "首四分之一",
  "第二個四分之一",
  "第三個四分之一",
  "末四分之一",
];

function QuartileStrip({
  quartile,
  ends,
}: {
  quartile: 1 | 2 | 3 | 4;
  ends: [string, string];
}) {
  return (
    <div
      className="kw-quartile"
      role="img"
      aria-label={`${ends[0]}一端數起的${quartileNames[quartile - 1]}`}
    >
      <span className="kw-quartile__end">{ends[0]}</span>
      <span className="kw-quartile__cells" aria-hidden="true">
        {[1, 2, 3, 4].map((cell) => (
          <span
            key={cell}
            className={
              cell === quartile
                ? "kw-quartile__cell kw-quartile__cell--on"
                : "kw-quartile__cell"
            }
          />
        ))}
      </span>
      <span className="kw-quartile__end">{ends[1]}</span>
    </div>
  );
}

function FeatureRow({ position }: { position: FeaturePosition }) {
  const feature = features[position.key];
  const own =
    position.value !== undefined ? (
      <>
        {feature.value(position.value)}
        {position.feeCap ? "（上限）" : ""}
        {feature.derivedValue && (
          <small className="kw-muted">
            （成立日期 {position.asOf}，本站計算）
          </small>
        )}
      </>
    ) : position.excludedReason === "stale" &&
      position.staleValue !== undefined ? (
      <>
        {feature.value(position.staleValue)}
        <small className="kw-muted">
          （截至 {position.asOf}，已超出時效，不作比較）
        </small>
      </>
    ) : position.excludedReason === "unverified" ? (
      <span className="kw-muted">官方數值待核實，不作比較</span>
    ) : (
      <span className="kw-muted">未取得官方數值，不作比較</span>
    );
  return (
    <li className="kw-features__row">
      <span className="kw-features__label">{feature.label}</span>
      <span className="kw-features__value">{own}</span>
      <span className="kw-features__position">
        {position.rank !== undefined ? (
          <>
            {feature.rank(position.rank, position.peerCount)}
            {position.quartile ? (
              <QuartileStrip quartile={position.quartile} ends={feature.ends} />
            ) : (
              <small className="kw-muted">
                （同類合資格基金少於 4 隻，不分四分位）
              </small>
            )}
          </>
        ) : (
          <small className="kw-muted">
            同類 {position.peerCount} 隻有可比較數值
          </small>
        )}
        {position.median !== undefined && (
          <small className="kw-muted">
            同類中位數 {feature.median(position.median)}（本站計算）
          </small>
        )}
      </span>
    </li>
  );
}

export function PeerFeatures({
  apiBaseUrl,
  fundClassId,
  snapshotId,
}: {
  apiBaseUrl: string;
  fundClassId: string;
  snapshotId: string;
}) {
  const [data, setData] = useState<FeaturesResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setFailed(false);
    fetch(
      `${apiBaseUrl}/fund-classes/${encodeURIComponent(fundClassId)}/features`,
      { signal: controller.signal },
    )
      .then((response) => {
        if (!response.ok) throw new Error("Unavailable");
        return response.json() as Promise<FeaturesResponse>;
      })
      .then((next) => {
        // 同基金本身唔同快照就唔顯示，唔混合兩期數據。
        if (next.snapshotId !== snapshotId || !Array.isArray(next.positions))
          throw new Error("Snapshot changed");
        setData(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [apiBaseUrl, fundClassId, snapshotId]);

  return (
    <div
      className="kw-features"
      role="group"
      aria-labelledby="fund-peer-features-title"
    >
      <h3 className="kw-features__title" id="fund-peer-features-title">
        同類位置（本站計算）
      </h3>
      {failed ? (
        <p className="kw-status kw-status--negative" role="status">
          暫時未能取得同類位置；上面的官方資料不受影響。
        </p>
      ) : !data ? (
        <p className="kw-status" role="status" aria-live="polite">
          正在計算同類位置…
        </p>
      ) : (
        <>
          <p className="kw-muted">
            積金局基金類型：{data.comparisonGroup}（同類共{" "}
            {data.groupMemberCount} 隻）
          </p>
          <ul className="kw-features__list">
            {data.positions.map((position) => (
              <FeatureRow key={position.key} position={position} />
            ))}
          </ul>
          <p className="kw-muted" role="note">
            {data.methodology.rule}
          </p>
        </>
      )}
    </div>
  );
}
