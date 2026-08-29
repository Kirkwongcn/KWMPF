import { expect, test } from "@playwright/test";

test("基金詳情頁顯示逐期回報、費用及可追溯來源", async ({ page }) => {
  await page.goto("/rankings");
  const firstFund = page
    .locator("table.kw-table tbody tr td.kw-table__name a")
    .first();
  await expect(firstFund).toBeVisible();
  const fundName = (await firstFund.textContent())!.trim();
  await firstFund.click();

  await expect(page).toHaveURL(/\/fund-classes\//);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(fundName);

  const returns = page.getByRole("table", { name: "回報" });
  await expect(returns.getByRole("rowheader", { name: "一年" })).toBeVisible();
  await expect(returns.getByRole("rowheader", { name: "五年" })).toBeVisible();
  await expect(returns.getByRole("rowheader", { name: "十年" })).toBeVisible();

  await expect(
    page.getByRole("heading", { name: "費用及資料限制" }),
  ).toBeVisible();
  await expect(page.getByText("當前管理費")).toBeVisible();

  // 基金概況及年度回報在官方未提供時仍要顯示欄位，不可靜默消失。
  const profile = page.getByRole("region", { name: "基金概況" });
  await expect(profile.getByText("基金規模", { exact: true })).toBeVisible();
  await expect(profile.getByText("成立日期", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "年度回報" })).toBeVisible();
  await expect(page.getByText(/年度回報是該個曆年的累積回報/)).toBeVisible();

  const provenance = page.getByRole("region", { name: "資料來源及驗證" });
  await expect(provenance).toContainText(/資料截至：\d{4}-\d{2}-\d{2}/);
  await expect(provenance).toContainText("snapshot-mpfa-platform-2026-07-31");
  await expect(
    provenance.getByRole("link", { name: "積金局原始資料" }),
  ).toHaveAttribute("href", /^https?:\/\//);
  await expect(provenance).toContainText("過往表現不代表未來結果");
});

test("詳情頁的同組比較連結會帶著比較組別回到排名", async ({ page }) => {
  await page.goto("/rankings");
  const firstFund = page
    .locator("table.kw-table tbody tr td.kw-table__name a")
    .first();
  await expect(firstFund).toBeVisible();
  await firstFund.click();

  const peers = page.getByRole("region", { name: "同組比較" });
  const group = (await peers.locator("strong").first().textContent())!.trim();
  await peers.getByRole("link", { name: "查看同組基金排名" }).click();

  await expect(page).toHaveURL(/\/rankings\?/);
  await expect(page.getByLabel("比較組別")).toHaveValue(group);

  const rows = page.locator("table.kw-table tbody tr");
  await expect(rows.first()).toBeVisible();
  for (const row of await rows.all()) {
    await expect(row.locator("td").nth(3)).toHaveText(group);
  }
});

test("找不到的基金不會顯示估算資料", async ({ page }) => {
  await page.goto("/fund-classes/does-not-exist");

  await expect(page.getByText("未能取得基金資料。")).toBeVisible();
});
