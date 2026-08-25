import { expect, test } from "@playwright/test";

const pages = [
  { path: "/", ready: "搜尋及查閱" },
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

test("主要導覽的每個項目在窄螢幕都不會摺行", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "主要導覽" });
  for (const name of ["基金瀏覽", "基金排名", "計劃比較"]) {
    const { height, lineHeight } = await nav
      .getByRole("link", { name })
      .evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        lineHeight: parseFloat(getComputedStyle(element).lineHeight),
      }));
    expect(height, `${name} 佔了多於一行`).toBeLessThan(lineHeight * 1.5);
  }
});

test("每頁都可經主要導覽互相跳轉", async ({ page }) => {
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "主要導覽" });
  await nav.getByRole("link", { name: "基金排名" }).click();
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
