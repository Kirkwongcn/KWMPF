import { expect, test } from "@playwright/test";
test("首頁顯示同一快照的覆蓋並把搜尋送往基金瀏覽", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "用可追溯資料，讀懂強積金選擇",
  );
  const coverage = page.getByRole("region", { name: "已發布資料範圍" });
  await expect(coverage).toContainText("451");
  await expect(coverage).toContainText("24");
  await expect(coverage).toContainText(/資料截至 \d{4}-\d{2}-\d{2}/);
  await page.getByLabel("搜尋基金、計劃或受託人").fill("BCT");
  await page.getByRole("button", { name: "搜尋基金" }).click();
  await expect(page).toHaveURL(/\/funds\?q=BCT/);
  const rows = page.locator("table.kw-table tbody tr");
  await expect(rows.first()).toBeVisible();
  for (const text of await rows.allTextContents())
    expect(text.toLowerCase()).toContain("bct");
});
test("沒有結果時顯示明確訊息", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("zzz-no-such-fund");
  await page.getByRole("button", { name: "搜尋基金" }).click();
  await expect(page.getByText("沒有符合條件的已發布基金。")).toBeVisible();
  await expect(page.locator("table.kw-table tbody tr")).toHaveCount(0);
});
test("由搜尋結果可跳至基金詳情", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("Principal");
  await page.getByRole("button", { name: "搜尋基金" }).click();
  const link = page.locator("table.kw-table tbody th a").first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/fund-classes\//);
  await expect(
    page.getByRole("heading", { name: "資料來源及驗證" }),
  ).toBeVisible();
});
test("中文別名、分頁及並列比較可一起使用", async ({ page }) => {
  await page.goto("/funds?q=%E6%BB%99%E8%B1%90");
  const rows = page.locator("table.kw-table tbody tr");
  await expect(rows).toHaveCount(50);
  const firstId = await rows.first().locator("th a").getAttribute("href");
  await rows.first().getByRole("checkbox").check();
  await page.getByRole("button", { name: "下一頁" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(rows).toHaveCount(27);
  expect(await rows.first().locator("th a").getAttribute("href")).not.toBe(
    firstId,
  );
  await rows.first().getByRole("checkbox").check();
  await page.getByRole("link", { name: "並列比較" }).click();
  await expect(
    page.getByRole("heading", { name: "基金並列比較" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "原始數值與來源（過期值仍保留）" }),
  ).toBeVisible();
});
