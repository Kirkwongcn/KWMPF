import { expect, test } from "@playwright/test";

test("首頁公開涵蓋範圍及搜尋結果來自同一發布快照", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "用可追溯資料，讀懂強積金選擇",
  );
  const coverage = page
    .getByRole("region", { name: "目前涵蓋範圍" })
    .locator(".status-list");
  await expect(coverage).toContainText("451");
  await expect(coverage).toContainText("24");
  await expect(coverage).toContainText("2026-07-31");

  await page.getByLabel("搜尋基金、計劃或受託人").fill("BCT");
  await page.getByRole("button", { name: "搜尋" }).click();

  const results = page.getByRole("list", { name: "搜尋結果" }).locator("li");
  await expect(results.first()).toBeVisible();
  expect(await results.count()).toBeGreaterThan(0);
  for (const text of await results.allTextContents()) {
    expect(text).toContain("BCT");
  }
});

test("搜尋沒有結果時顯示明確訊息，不會顯示估算資料", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("搜尋基金、計劃或受託人").fill("zzz-no-such-fund");
  await page.getByRole("button", { name: "搜尋" }).click();

  await expect(
    page.getByText("沒有符合「zzz-no-such-fund」的已發布基金。"),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "搜尋結果" })).toHaveCount(0);
});

test("由搜尋結果可跳至基金詳情頁", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("搜尋基金、計劃或受託人").fill("Principal");
  await page.getByRole("button", { name: "搜尋" }).click();

  const firstResult = page
    .getByRole("list", { name: "搜尋結果" })
    .locator("li a")
    .first();
  const fundName = (await firstResult.textContent())?.trim() ?? "";
  expect(fundName.length).toBeGreaterThan(0);
  await firstResult.click();

  await expect(page).toHaveURL(/\/fund-classes\//);
  await expect(
    page.getByRole("heading", { name: "資料來源及驗證" }),
  ).toBeVisible();
});
