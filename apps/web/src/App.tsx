import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { SiteChrome } from "./SiteChrome";
import { ArrowIcon } from "./ArrowIcon";
import { AvailabilityChart, type DataQuality } from "./DataCharts";
import {
  AtlasPlot,
  MPFA_FAMILIES,
  SheetIndex,
  useAtlasData,
  type AtlasPoint,
  type RankingRow,
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

const GRID_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** 圖框坐標：上緣每 60px 大刻度之間一個字母，右緣每 60px 一個數字，與刻度對齊。 */
function FrameRefs() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    if (!element) return;
    const measure = () =>
      setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  const { width, height } = size;
  const columns = Math.min(GRID_LETTERS.length, Math.floor(width / 60));
  const rows = Math.floor(height / 60);
  return (
    <div className="kw-plate__refs" ref={setElement} aria-hidden="true">
      {Array.from({ length: columns }, (_, index) => (
        <span key={`c${index}`} style={{ left: index * 60 + 30 }}>
          {GRID_LETTERS[index]}
        </span>
      ))}
      {Array.from({ length: rows }, (_, index) => (
        <span
          key={`r${index}`}
          className="kw-plate__refs-row"
          style={{ top: index * 60 + 30 }}
        >
          {index + 1}
        </span>
      ))}
    </div>
  );
}

function AtlasSection({
  data,
  failed,
  waiting,
}: {
  data: { points: AtlasPoint[] } | null;
  failed: boolean;
  waiting: boolean;
}) {
  const [family, setFamily] = useState<string | null>(null);
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const point of data?.points ?? [])
      result.set(point.family, (result.get(point.family) ?? 0) + 1);
    return result;
  }, [data]);
  const points: AtlasPoint[] = data?.points ?? [];
  return (
    <section className="kw-sheet kw-sheet--atlas" aria-labelledby="atlas-title">
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
          <div className="kw-legend__chips">
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
          </div>
          <p className="kw-legend__note">
            <span className="kw-legend__sample kw-legend__sample--point" />
            一點＝一隻基金類別（官方原值）
            <br />
            <span className="kw-legend__sample kw-legend__sample--box" />
            虛線框＝該類型四分位範圍（本站計算，少於 3 隻不畫）
            <br />
            類別及類型全部來自積金局強積金基金平台。
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
                  : waiting
                    ? "正在測繪基金圖…"
                    : "未取得公開快照，未能繪製基金圖。"}
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
            {data ? dateRange(points.map((point) => point.ret.dataAsOf)) : "—"}
          </dd>
        </div>
        <div>
          <dt>三年波幅截至</dt>
          <dd>
            {data ? dateRange(points.map((point) => point.risk.dataAsOf)) : "—"}
          </dd>
        </div>
        <div>
          <dt>來源</dt>
          <dd>積金局強積金基金平台</dd>
        </div>
      </dl>
    </section>
  );
}

function IndexSection({ returns }: { returns: RankingRow[] }) {
  return (
    <section className="kw-sheet kw-sheet--index" aria-labelledby="index-title">
      <header className="kw-sheet__head">
        <h2 id="index-title">各類基金一年回報分布</h2>
        <p>
          按積金局基金類型逐行列出一年回報。每點一隻基金類別，金色短線為該類型中位數（本站計算）；點類型名稱打開同類排名。
        </p>
      </header>
      <SheetIndex returns={returns} />
    </section>
  );
}

const contents = [
  ["搵基金", "按名稱、受託人、積金局基金類型篩選，撳欄位排序", "/funds"],
  ["同類排名", "只在同一積金局基金類型內比較回報、波幅與費用", "/rankings"],
  [
    "比較基金",
    "最多四隻基金並列：回報、曆年表現、波幅及收費",
    "/funds/compare",
  ],
  ["比較計劃", "計劃一覽、收費範圍，以及各計劃同類基金對照", "/schemes"],
  ["資料說明", "每個期間有多少可排名、過期或未取得", "/data-status"],
  ["比較方法與來源", "截至日期規則、本站計算的定義及限制", "/methodology"],
] as const;

export function App({ apiUrl }: { apiUrl: string }) {
  const [summary, setSummary] = useState<Summary | null>(null),
    [quality, setQuality] = useState<DataQuality | null>(null),
    [failed, setFailed] = useState(false),
    [query, setQuery] = useState("");
  const origin = new URL(apiUrl).origin;
  const atlas = useAtlasData(origin, summary?.snapshotId ?? null);
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
          <div className="kw-plate__frame">
            <form
              className="kw-gazetteer"
              action="/funds"
              method="get"
              role="search"
            >
              <label htmlFor="fund-search">
                <span className="kw-gazetteer__name">搵基金</span>
                輸入基金、計劃或受託人名稱
              </label>
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
              <p className="kw-plate__shortcuts">
                <a href="/funds">瀏覽全部基金</a>
                <a href="/rankings">按積金局基金類型比較</a>
                <a href="/funds/compare">並列比較基金</a>
                <a href="/schemes">比較計劃／受託人</a>
              </p>
            </form>
            <figure className="kw-plate__photo">
              <img
                src="/images/hk-harbour-1200.webp"
                srcSet="/images/hk-harbour-1200.webp 1200w, /images/hk-harbour-2400.webp 2400w"
                sizes="(max-width: 1520px) 100vw, 1520px"
                width={2400}
                height={1041}
                alt="由太平山俯瞰維多利亞港兩岸的夜景"
                fetchPriority="high"
              />
              <FrameRefs />
              <div className="kw-plate__title">
                <h1 id="home-title">強積金基金圖</h1>
                <p className="kw-plate__en" lang="en">
                  Hong Kong MPF Fund Atlas
                </p>
                <p className="kw-plate__lead">
                  以積金局及受託人官方資料，把每隻強積金基金放回同一張圖上；比較只在同一積金局基金類型內進行，每項數值都可追溯來源及截至日期。
                </p>
              </div>
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
            <section
              className="kw-plate__titleblock"
              aria-label="已發布資料範圍"
            >
              {summary ? (
                <dl>
                  <div className="kw-plate__titleblock-name">
                    <dt>圖名</dt>
                    <dd>
                      強積金基金圖{" "}
                      <span lang="en">Hong Kong MPF Fund Atlas</span>
                    </dd>
                  </div>
                  <div>
                    <dt>基金類別</dt>
                    <dd>{summary.fundClassCount}</dd>
                  </div>
                  <div>
                    <dt>強積金計劃</dt>
                    <dd>{summary.schemeCount}</dd>
                  </div>
                  <div>
                    <dt>受託人</dt>
                    <dd>{summary.trusteeCount}</dd>
                  </div>
                  <div>
                    <dt>平台資料截至</dt>
                    <dd>{summary.dataAsOf?.latest ?? "官方未提供"}</dd>
                  </div>
                  <div>
                    <dt>來源</dt>
                    <dd>積金局強積金基金平台、受託人便覽</dd>
                  </div>
                </dl>
              ) : (
                <p>{failed ? "資料範圍暫時無法取得" : "正在讀取公開快照…"}</p>
              )}
            </section>
            <AtlasSection
              data={atlas.data}
              failed={atlas.failed}
              waiting={!failed}
            />
          </div>
        </div>
      </section>
      {atlas.data && atlas.data.returns.length > 0 && (
        <IndexSection returns={atlas.data.returns} />
      )}
      <div className="kw-ledger">
        <section
          className="kw-sheet kw-sheet--survey"
          aria-labelledby="survey-title"
        >
          <header className="kw-sheet__head">
            <h2 id="survey-title">資料覆蓋</h2>
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
            <h2 id="contents-title">網站功能</h2>
          </header>
          <ol>
            {contents.map(([title, text, href]) => (
              <li key={href}>
                <a href={href}>
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
