import { expect, test } from "@playwright/test";

const pages = [
  { path: "/", ready: "由你的問題出發" },
  { path: "/funds?q=BCT", ready: "瀏覽結果" },
  { path: "/rankings", ready: "已發布基金排名" },
  { path: "/schemes", ready: "計劃概覽" },
];

for (const { path, ready } of pages) {
  test(`${path} 在目前視窗寬度內不需要橫向捲動`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: ready })).toBeVisible();

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("窄螢幕導覽文字維持單行並保留觸控尺寸", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "主要導覽" });
  for (const name of ["基金瀏覽", "同類排名", "計劃比較", "資料狀態"]) {
    const { height, textLines } = await nav
      .getByRole("link", { name })
      .evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return {
          height: element.getBoundingClientRect().height,
          textLines: range.getClientRects().length,
        };
      });
    expect(textLines, `${name} 的文字摺成多行`).toBe(1);
    expect(height, `${name} 的觸控範圍不足 44px`).toBeGreaterThanOrEqual(44);
  }
});

test("每頁都可經第一個鍵盤焦點跳至主內容", async ({ page }) => {
  for (const { path } of pages) {
    await page.goto(path);
    await expect(
      page.getByRole("link", { name: "跳至主內容" }),
    ).toHaveAttribute("href", "#main-content");
    await expect(page.getByRole("main")).toHaveAttribute("id", "main-content");
  }

  await page.goto("/");

  const skipLink = page.getByRole("link", { name: "跳至主內容" });
  await expect(skipLink).not.toBeInViewport();
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});

test("每頁都可經主要導覽互相跳轉", async ({ page }) => {
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "主要導覽" });
  await nav.getByRole("link", { name: "同類排名" }).click();
  await expect(page).toHaveURL(/\/rankings$/);

  await nav.getByRole("link", { name: "計劃比較" }).click();
  await expect(page).toHaveURL(/\/schemes$/);
  await expect(nav.getByRole("link", { name: "計劃比較" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await nav.getByRole("link", { name: "基金瀏覽" }).click();
  await expect(page).toHaveURL(/\/funds$/);

  await page.getByRole("link", { name: "KWMPF 首頁" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("320px nav wraps cleanly", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/");

  const layout = await page.evaluate(() => {
    const brand = document.querySelector(".kw-brand");
    const nav = document.querySelector(".kw-nav");
    const brandRect = brand?.getBoundingClientRect();
    const navRect = nav?.getBoundingClientRect();
    const root = document.documentElement;
    const links = Array.from(document.querySelectorAll(".kw-nav a"));
    let navBelowBrand = false;

    if (brandRect && navRect) {
      navBelowBrand = navRect.top >= brandRect.bottom;
    }

    return {
      overflow: root.scrollWidth - root.clientWidth,
      navBelowBrand,
      links: links.map((link) => {
        const rect = link.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          fontSize: getComputedStyle(link).fontSize,
        };
      }),
    };
  });

  expect(layout.overflow).toBeLessThanOrEqual(1);
  expect(layout.navBelowBrand).toBe(true);
  expect(layout.links).toHaveLength(4);
  for (const link of layout.links) {
    expect(link.width).toBeGreaterThanOrEqual(44);
    expect(link.height).toBeGreaterThanOrEqual(44);
    expect(link.fontSize).toBe("14px");
  }
});

test("320px 計劃比較表提示橫向捲動並可用方向鍵查看", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto(
    "/schemes/compare?ids=AIA%20MPF%20-%20Prime%20Value%20Choice,AMTD%20MPF%20Scheme",
  );

  const region = page.getByRole("region", { name: "計劃逐項比較表" });
  await expect(region).toBeVisible();
  await expect(
    page.getByText("左右滑動或使用方向鍵查看其餘欄位"),
  ).toBeVisible();
  await expect(region).toHaveAttribute(
    "aria-describedby",
    "scheme-compare-scroll-hint",
  );

  const dimensions = await region.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    pageOverflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
  expect(dimensions.pageOverflow).toBeLessThanOrEqual(1);

  await region.focus();
  const before = await region.evaluate((element) => element.scrollLeft);
  await page.keyboard.press("ArrowRight");
  const after = await region.evaluate((element) => element.scrollLeft);
  expect(after).toBeGreaterThan(before);
});
