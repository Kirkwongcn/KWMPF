import { ReactNode, useEffect } from "react";

type NavKey = "rankings" | "schemes";

const siteName = "KWMPF";
const homeDescription =
  "以積金局及受託人官方資料比較香港強積金計劃及基金，每項數值均可追溯來源及截至日期。";

export function SiteChrome({
  eyebrow,
  title,
  subtitle,
  current,
  isHome,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  current?: NavKey;
  isHome?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = isHome
      ? `${siteName}｜香港強積金比較`
      : `${title}｜${siteName}`;
    const description = subtitle ?? homeDescription;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
  }, [title, subtitle, isHome]);

  return (
    <>
      <header className="kw-header">
        <div className="kw-shell kw-header__inner">
          <a className="kw-brand" href="/" aria-label="KWMPF 首頁">
            <span className="kw-brand__mark">kW</span>
            <span>
              <small>Kirk Wong Research</small>
              <strong>KWMPF</strong>
            </span>
          </a>
          <nav className="kw-nav" aria-label="主要導覽">
            <a
              href="/rankings"
              aria-current={current === "rankings" ? "page" : undefined}
            >
              基金排名
            </a>
            <a
              href="/schemes"
              aria-current={current === "schemes" ? "page" : undefined}
            >
              計劃比較
            </a>
          </nav>
        </div>
      </header>
      <section className="kw-hero" aria-labelledby="page-title">
        <div className="kw-hero__inner">
          <p className="kw-eyebrow">{eyebrow}</p>
          <h1 id="page-title">{title}</h1>
          {subtitle && <p className="kw-hero__subtitle">{subtitle}</p>}
        </div>
      </section>
      <main className="kw-main">{children}</main>
      <footer className="kw-footer">
        <div className="kw-shell kw-footer__inner">
          <p>
            本網站只提供資料比較及投資教育，不構成投資建議、要約或招攬。過往表現不代表未來結果，投資涉及風險。
          </p>
          <p className="kw-muted">
            資料來源：積金局強積金基金平台及受託人官方基金便覽。每項公開數值均標示截至日期及來源連結，網站不會以估算值補足官方未提供的欄位。
          </p>
          <p className="kw-muted">KWMPF · Kirk Wong Research</p>
        </div>
      </footer>
    </>
  );
}
