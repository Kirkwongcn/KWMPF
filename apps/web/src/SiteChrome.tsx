import { ReactNode, useEffect } from "react";
import { useViewMode } from "./viewMode";
type NavKey = "funds" | "rankings" | "schemes" | "data";
export function SiteChrome({
  title,
  subtitle,
  current,
  isHome,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  current?: NavKey;
  isHome?: boolean;
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
            <strong>
              KW<span>MPF</span>
            </strong>
          </a>
          <nav className="kw-nav" aria-label="主要導覽">
            {(
              [
                ["funds", "基金瀏覽", "/funds"],
                ["rankings", "同類排名", "/rankings"],
                ["schemes", "計劃比較", "/schemes"],
                ["data", "資料狀態", "/data-status"],
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
          <div className="kw-mode" role="group" aria-label="閱讀模式">
            <button
              aria-pressed={mode === "simple"}
              onClick={() => changeMode("simple")}
            >
              簡潔
            </button>
            <button
              aria-pressed={mode === "analysis"}
              onClick={() => changeMode("analysis")}
            >
              深入分析
            </button>
          </div>
        </div>
      </header>
      <main
        className={`kw-main${isHome ? " kw-main--home" : ""}`}
        id="main-content"
        tabIndex={-1}
      >
        {!isHome && (
          <header className="kw-page-heading">
            <h1 id="page-title">{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </header>
        )}
        {children}
      </main>
      <footer className="kw-footer">
        <div className="kw-shell kw-footer__inner">
          <div className="kw-footer__links">
            <strong>KWMPF</strong>
            <a href="/methodology">比較方法與來源</a>
            <a href="/data-status">資料時效及覆蓋</a>
            <a href="https://mfp.mpfa.org.hk/" target="_blank" rel="noreferrer">
              積金局基金平台
            </a>
          </div>
          <p>
            本網站提供資料比較及投資教育，不構成投資建議、要約或招攬。過往表現不代表未來結果，投資涉及風險。
          </p>
          <p className="kw-muted">
            數值來自積金局平台及受託人官方便覽；分類及衍生統計另行標示。官方未提供的欄位不補估值。Kirk
            Wong Research
          </p>
        </div>
      </footer>
    </div>
  );
}
