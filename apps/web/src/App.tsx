import { useEffect, useMemo, useState } from "react";
import { SiteChrome } from "./SiteChrome";
import { ArrowIcon } from "./ArrowIcon";
import { AvailabilityChart, type DataQuality } from "./DataCharts";
import { StatTiles } from "./Charts";
import {
  AtlasPlot,
  MPFA_FAMILIES,
  SheetIndex,
  useAtlasData,
  type AtlasPoint,
} from "./Atlas";
type Summary = {
  snapshotId: string | null;
  fundClassCount: number;
  schemeCount: number;
  trusteeCount: number;
  dataAsOf: { earliest: string; latest: string } | null;
};

function dateRange(dates: string[]) {
  const sorted = [...dates].sort();
  const first = sorted[0],
    last = sorted.at(-1);
  if (!first || !last) return "官方未提供";
  return first === last ? first : `${first} 至 ${last}`;
}

function AtlasSheet({
  apiOrigin,
  snapshotId,
}: {
  apiOrigin: string;
  snapshotId: string;
}) {
  const { data, failed } = useAtlasData(apiOrigin, snapshotId);
  const [family, setFamily] = useState<string | null>(null);
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const point of data?.points ?? [])
      result.set(point.family, (result.get(point.family) ?? 0) + 1);
    return result;
  }, [data]);
  const points: AtlasPoint[] = data?.points ?? [];
  return (
    <>
      <section
        className="kw-sheet kw-sheet--atlas"
        aria-labelledby="atlas-title"
      >
        <header className="kw-sheet__head">
          <h2 id="atlas-title">基金圖</h2>
          <p>
            每點是一隻基金類別：向右波幅較大，向上一年回報較高。只有一年回報及三年波幅都是已核實、未過期的官方數值才落點；選一個積金局基金類別，其餘退作背景。
          </p>
        </header>
        <div className="kw-sheet__body">
          <div
            className="kw-legend"
            role="group"
            aria-label="按積金局基金類別突出"
          >
            <button
              type="button"
              aria-pressed={family === null}
              onClick={() => setFamily(null)}
            >
              <span>全部類別</span>
              <span className="kw-legend__count">{points.length || "—"}</span>
            </button>
            {MPFA_FAMILIES.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={family === name}
                disabled={!counts.get(name)}
                onClick={() => setFamily(family === name ? null : name)}
              >
                <span>{name}</span>
                <span className="kw-legend__count">
                  {counts.get(name) ?? 0}
                </span>
              </button>
            ))}
            <p className="kw-legend__note">
              類別及類型全部來自積金局強積金基金平台；分布框及中位數為本站計算。
            </p>
          </div>
          <div className="kw-sheet__plot">
            {data && points.length > 0 ? (
              <AtlasPlot points={points} family={family} />
            ) : (
              <div className="kw-loading-block" role="status">
                {failed
                  ? "暫時未能繪製基金圖；排名及基金頁的已發布資料不受影響。"
                  : data
                    ? "目前沒有同時具備一年回報及三年波幅的基金類別。"
                    : "正在測繪基金圖…"}
              </div>
            )}
          </div>
        </div>
        <dl className="kw-sheet__key" aria-label="基金圖圖例資料">
          <div>
            <dt>測量點</dt>
            <dd>{data ? `${points.length} 隻基金類別` : "—"}</dd>
          </div>
          <div>
            <dt>一年回報截至</dt>
            <dd>
              {data
                ? dateRange(points.map((point) => point.ret.dataAsOf))
                : "—"}
            </dd>
          </div>
          <div>
            <dt>三年波幅截至</dt>
            <dd>
              {data
                ? dateRange(points.map((point) => point.risk.dataAsOf))
                : "—"}
            </dd>
          </div>
          <div>
            <dt>來源</dt>
            <dd>積金局強積金基金平台</dd>
          </div>
        </dl>
      </section>
      {data && data.returns.length > 0 && (
        <section
          className="kw-sheet kw-sheet--index"
          aria-labelledby="index-title"
        >
          <header className="kw-sheet__head">
            <h2 id="index-title">圖幅索引</h2>
            <p>
              按積金局基金類型逐行列出一年回報。每點一隻基金類別，金色短線為該類型中位數（本站計算）；點類型名稱打開同類排名。
            </p>
          </header>
          <SheetIndex returns={data.returns} />
        </section>
      )}
    </>
  );
}

const contents = [
  [
    "01",
    "基金瀏覽",
    "按名稱、受託人、積金局基金類型找出你持有的基金",
    "/funds",
  ],
  [
    "02",
    "基金排名",
    "只在同一積金局基金類型內比較回報、波幅與費用",
    "/rankings",
  ],
  ["03", "計劃比較", "並列最多四個計劃的基金數目、風險級別與收費", "/schemes"],
  [
    "04",
    "資料時效及覆蓋",
    "每個期間有多少可排名、過期或未取得",
    "/data-status",
  ],
  [
    "05",
    "比較方法與來源",
    "截至日期規則、本站計算的定義及限制",
    "/methodology",
  ],
] as const;

export function App({ apiUrl }: { apiUrl: string }) {
  const [summary, setSummary] = useState<Summary | null>(null),
    [quality, setQuality] = useState<DataQuality | null>(null),
    [failed, setFailed] = useState(false),
    [query, setQuery] = useState("");
  const origin = new URL(apiUrl).origin;
  useEffect(() => {
    const controller = new AbortController();
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
  }, [origin]);
  return (
    <SiteChrome isHome title="強積金基金圖">
      <section className="kw-plate" aria-labelledby="home-title">
        <div className="kw-shell">
          <div className="kw-plate__inner">
            <div className="kw-plate__copy">
              <h1 id="home-title">強積金基金圖</h1>
              <p className="kw-plate__en" lang="en">
                Hong Kong MPF Fund Atlas
              </p>
              <p className="kw-plate__lead">
                以積金局及受託人官方資料，把每隻強積金基金放回同一張圖上；比較只在同一積金局基金類型內進行，每項數值都可追溯來源及截至日期。
              </p>
              <form
                className="kw-gazetteer"
                action="/funds"
                method="get"
                role="search"
              >
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
                <p>可用中文常用名稱或英文名稱；結果保留官方名稱。</p>
              </form>
              <p className="kw-plate__shortcuts">
                <a href="/funds">瀏覽全部基金</a>
                <a href="/rankings">按同類組別比較</a>
              </p>
            </div>
            <figure className="kw-plate__photo">
              <img
                src="/images/hk-harbour-1200.webp"
                srcSet="/images/hk-harbour-1200.webp 1200w, /images/hk-harbour-2400.webp 2400w"
                sizes="(max-width: 760px) 100vw, 60vw"
                width={2400}
                height={1041}
                alt="由太平山俯瞰維多利亞港兩岸的夜景"
                fetchPriority="high"
              />
              <span
                className="kw-plate__ref kw-plate__ref--n"
                aria-hidden="true"
              >
                A B C D
              </span>
              <span
                className="kw-plate__ref kw-plate__ref--e"
                aria-hidden="true"
              >
                1 2 3
              </span>
              <figcaption>
                維多利亞港，太平山，2007 年 12 月。相片：David Iliff，
                <a
                  href="https://commons.wikimedia.org/wiki/File:Hong_Kong_Skyline_Restitch_-_Dec_2007.jpg"
                  target="_blank"
                  rel="noreferrer"
                >
                  Wikimedia Commons
                </a>
                ，
                <a
                  href="https://creativecommons.org/licenses/by-sa/3.0/deed.zh_TW"
                  target="_blank"
                  rel="noreferrer"
                  lang="en"
                >
                  CC BY-SA 3.0
                </a>
              </figcaption>
            </figure>
          </div>
        </div>
        <div className="kw-shell">
          {summary ? (
            <StatTiles
              label="已發布資料範圍"
              className="kw-plate__stats"
              items={[
                { label: "基金類別", value: summary.fundClassCount },
                { label: "強積金計劃", value: summary.schemeCount },
                { label: "受託人", value: summary.trusteeCount },
                {
                  label: "平台資料截至",
                  value: summary.dataAsOf?.latest ?? "官方未提供",
                },
              ]}
            />
          ) : (
            <section
              className="kw-stats kw-plate__stats"
              aria-label="已發布資料範圍"
            >
              <span>
                {failed ? "資料範圍暫時無法取得" : "正在讀取公開快照…"}
              </span>
            </section>
          )}
        </div>
      </section>
      {summary?.snapshotId && (
        <AtlasSheet apiOrigin={origin} snapshotId={summary.snapshotId} />
      )}
      <div className="kw-ledger">
        <section
          className="kw-sheet kw-sheet--survey"
          aria-labelledby="survey-title"
        >
          <header className="kw-sheet__head">
            <h2 id="survey-title">測量紀錄</h2>
            <p>
              過期與未取得分開計算：過期數值仍在基金頁保留原值，但不入圖、不排名。
            </p>
          </header>
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
          <p className="kw-sheet__foot">
            <a href="/data-status">查看截至日期及缺口</a>
            <span className="kw-advanced">
              公開快照：{summary?.snapshotId ?? "讀取中"}
            </span>
          </p>
        </section>
        <nav className="kw-sheet kw-contents" aria-labelledby="contents-title">
          <header className="kw-sheet__head">
            <h2 id="contents-title">圖冊目錄</h2>
          </header>
          <ol>
            {contents.map(([number, title, text, href]) => (
              <li key={href}>
                <a href={href}>
                  <span className="kw-contents__no">{number}</span>
                  <span>
                    <strong>{title}</strong>
                    <small>{text}</small>
                  </span>
                  <ArrowIcon />
                </a>
              </li>
            ))}
          </ol>
          <p className="kw-sheet__foot kw-advanced">
            平台快照與受託人便覽的日期可能不同。三年回報採用最長 90
            日的網站門檻；一、五、十年回報新快照為 60
            日（以排名頁顯示的快照門檻為準）。
          </p>
        </nav>
      </div>
    </SiteChrome>
  );
}
