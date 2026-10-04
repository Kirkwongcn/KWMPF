import { ReactNode, useEffect } from "react";
import { useViewMode } from "./viewMode";
type NavKey = "funds" | "rankings" | "schemes" | "data";
export function SiteChrome({
  title,
  subtitle,
  current,
  isHome,
  titleBlock,
  children,
}: {
  /** Retained for callers; the redesign has no eyebrow above headings. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  current?: NavKey;
  isHome?: boolean;
  /** 圖幅標題欄：每格一項身份或來源資料，原值照印。 */
  titleBlock?: { label: string; value: ReactNode }[];
  children: ReactNode;
}) {
  const [mode, changeMode] = useViewMode();
  useEffect(() => {
    document.title = isHome ? "KWMPF｜香港強積金比較" : `${title}｜KWMPF`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      "content",
      subtitle ??
        "以積金局及受託人官方資料比較香港強積金基金，追溯每項數值的來源及截至日期。",
    );
  }, [title, subtitle, isHome]);
  return (
    <div className={`kw-app kw-mode--${mode}`}>
      <a className="kw-skip-link" href="#main-content">
        跳至主內容
      </a>
      <header className="kw-header">
        <div className="kw-shell kw-header__inner">
          <a className="kw-brand" href="/" aria-label="KWMPF 首頁">
            <span className="kw-brand__mark" aria-hidden="true">
              kW
            </span>
            <span className="kw-brand__name">
              <small>Kirk Wong Research</small>
              <strong>KWMPF</strong>
            </span>
          </a>
          <nav className="kw-nav" aria-label="主要導覽">
            {(
              [
                ["funds", "基金瀏覽", "/funds"],
                ["rankings", "基金排名", "/rankings"],
                ["schemes", "計劃比較", "/schemes"],
              ] as const
            ).map(([key, label, href]) => (
              <a
                key={key}
                href={href}
                aria-current={current === key ? "page" : undefined}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="kw-header__tools">
            <a
              className="kw-header__status"
              href="/data-status"
              aria-current={current === "data" ? "page" : undefined}
            >
              資料時效及覆蓋
            </a>
            <div className="kw-mode" role="group" aria-label="閱讀模式">
              <button
                type="button"
                aria-pressed={mode === "simple"}
                onClick={() => changeMode("simple")}
              >
                簡潔
              </button>
              <button
                type="button"
                aria-pressed={mode === "analysis"}
                onClick={() => changeMode("analysis")}
              >
                深入分析
              </button>
            </div>
          </div>
        </div>
      </header>
      {!isHome && (
        <section className="kw-sheet-title" aria-labelledby="page-title">
          <div className="kw-shell">
            <div className="kw-sheet-title__inner">
              <h1 id="page-title">{title}</h1>
              {subtitle && <p>{subtitle}</p>}
              {titleBlock && titleBlock.length > 0 && (
                <dl className="kw-sheet-title__block" aria-label="圖幅標題欄">
                  {titleBlock.map((cell) => (
                    <div key={cell.label}>
                      <dt>{cell.label}</dt>
                      <dd>{cell.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </section>
      )}
      <main
        className={`kw-main${isHome ? " kw-main--home" : ""}`}
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </main>
      <footer className="kw-footer">
        <div className="kw-shell">
          <dl className="kw-titleblock" aria-label="網站說明">
            <div className="kw-titleblock__name">
              <dt>圖名</dt>
              <dd>
                <strong>KWMPF</strong> 香港強積金基金圖
                <span lang="en">Hong Kong MPF Fund Atlas</span>
              </dd>
            </div>
            <div>
              <dt>資料來源</dt>
              <dd>
                積金局強積金基金平台、受託人官方便覽。每項數值保留自己的截至日期；官方未提供的欄位不補估值。
              </dd>
            </div>
            <div>
              <dt>分類</dt>
              <dd>
                只用積金局基金類型；平均、分布等衍生數值標明「本站計算」。
              </dd>
            </div>
            <div>
              <dt>參考</dt>
              <dd className="kw-titleblock__links">
                <a href="/methodology">比較方法與來源</a>
                <a href="/data-status">資料時效及覆蓋</a>
                <a
                  href="https://mfp.mpfa.org.hk/"
                  target="_blank"
                  rel="noreferrer"
                >
                  積金局基金平台
                </a>
              </dd>
            </div>
            <div className="kw-titleblock__notice">
              <dt>注意</dt>
              <dd>
                本網站提供資料比較及投資教育，不構成投資建議、要約或招攬。過往表現不代表未來結果，投資涉及風險。Kirk
                Wong Research
              </dd>
            </div>
          </dl>
        </div>
      </footer>
    </div>
  );
}
