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

test("窄螢幕導覽文字維持單行並保留觸控尺寸", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "主要導覽" });
  for (const name of ["基金瀏覽", "基金排名", "計劃比較"]) {
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
