import { chromium, devices } from "/home/user/KWMPF/apps/e2e/node_modules/@playwright/test/index.mjs";
const base = "http://127.0.0.1:4180";
const routes = ["/", "/?view=analysis", "/funds", "/funds?q=%E6%9D%B1%E4%BA%9E", "/funds/compare?ids=mpfa-cf-102,mpfa-cf-1159,mpfa-cf-1040",
  "/fund-classes/mpfa-cf-1040", "/rankings", "/rankings?period=3", "/schemes", "/schemes/compare", "/data-status", "/methodology", "/fund-classes/does-not-exist", "/nope"];
const browser = await chromium.launch();
const out = [];
for (const [name, opts] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["mobile", devices["Pixel 5"]]]) {
  const ctx = await browser.newContext(opts);
  for (const route of routes) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
    const t0 = Date.now();
    const resp = await page.goto(base + route, { waitUntil: "load" }); await page.waitForTimeout(2500);
    const loadMs = Date.now() - t0;
    const r = await page.evaluate(() => {
      const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const name = (el) => (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.textContent || el.getAttribute("title") || "").trim();
      const controls = [...document.querySelectorAll("button,a[href],select,input,textarea")].filter(vis);
      const unnamed = controls.filter((el) => {
        if (["SELECT","INPUT","TEXTAREA"].includes(el.tagName)) return !(el.labels && el.labels.length) && !el.getAttribute("aria-label");
        return !name(el) && !el.querySelector("img[alt]:not([alt=''])");
      }).map((el) => el.outerHTML.slice(0, 100));
      const small = controls.filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && (b.height < 24 || b.width < 24); }).length;
      const imgsNoAlt = [...document.images].filter((i) => !i.hasAttribute("alt")).length;
      const hs = [...document.querySelectorAll("h1,h2,h3,h4")].map((h) => +h.tagName[1]);
      let skips = 0; for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i-1] > 1) skips++;
      return { title: document.title, h1: document.querySelectorAll("h1").length, headingSkips: skips,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1, scrollW: document.documentElement.scrollWidth,
        main: !!document.querySelector("main"), skipLink: !!document.querySelector('a[href^="#"]'), unnamed, smallTargets: small, imgsNoAlt,
        canonical: !!document.querySelector('link[rel=canonical]'), metaDesc: document.querySelector('meta[name=description]')?.content,
        text: document.body.innerText.slice(0, 0) };
    });
    // keyboard: first 3 tab stops
    const tabs = [];
    for (let i = 0; i < 3; i++) { await page.keyboard.press("Tab"); tabs.push(await page.evaluate(() => { const a = document.activeElement; const s = getComputedStyle(a); return `${a.tagName}:${(a.textContent||"").trim().slice(0,12)}:outline=${s.outlineStyle}/${s.outlineWidth}`; })); }
    const file = `${name}${route.replace(/[^a-z0-9]+/gi, "_")}.png`;
    await page.screenshot({ path: `${process.argv[2]}/shots/${file}`, fullPage: false });
    out.push({ device: name, route, status: resp?.status(), loadMs, ...r, tabs, errors });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
