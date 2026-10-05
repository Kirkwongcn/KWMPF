import { expect, test } from "@playwright/test";

test("由搵基金加入比較，比較欄跨頁保留，比較頁可直接增減基金", async ({
  page,
}) => {
  await page.goto("/funds?q=BCT");
  const rows = page.locator("table.kw-table tbody tr");
  await expect(rows.first()).toBeVisible();
  await rows
    .nth(0)
    .getByRole("button", { name: /^加入比較：/ })
    .click();
  await rows
    .nth(1)
    .getByRole("button", { name: /^加入比較：/ })
    .click();

  // 換頁後比較欄仍然喺度。
  await page.goto("/rankings");
  const tray = page.getByRole("complementary", { name: "比較清單" });
  await expect(tray).toContainText("已選 2/4");
  await tray.getByRole("link", { name: "並列比較" }).click();

  await expect(page).toHaveURL(/\/funds\/compare\?ids=/);
  const table = page.getByRole("table", {
    name: "原始數值與來源（過期值仍保留）",
  });
  await expect(table).toBeVisible();
  await expect(table.locator("thead th")).toHaveCount(3);

  await table
    .getByRole("button", { name: /^移除：/ })
    .first()
    .click();
  await expect(table.locator("thead th")).toHaveCount(2);

  await page.getByLabel("加入基金").fill("Principal");
  const results = page.getByRole("list", { name: "搜尋結果" });
  await results.getByRole("button", { name: "加入" }).first().click();
  await expect(table.locator("thead th")).toHaveCount(3);
  await expect(page).toHaveURL(/ids=[^,]+,[^,]+$/);
});

test("計劃一覽勾選兩個計劃後，比較頁按積金局基金類型對照各計劃基金", async ({
  page,
}) => {
  await page.goto("/schemes");
  const overview = page.getByRole("table", { name: /計劃一覽/ });
  await expect(overview).toBeVisible();
  const boxes = overview.getByRole("checkbox");
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.getByRole("link", { name: "比較已選計劃" }).click();

  await expect(page).toHaveURL(/\/schemes\/compare\?ids=/);
  const lineup = page.getByRole("region", { name: "同類基金對照表" });
  await expect(lineup).toBeVisible();
  const lineupRows = lineup.locator("tbody tr");
  expect(await lineupRows.count()).toBeGreaterThan(0);
  // 每格要麼列出基金連結，要麼明確寫「沒有此類基金」。
  for (const cell of await lineup.locator("tbody td").all()) {
    const links = await cell.getByRole("link").count();
    if (links === 0) await expect(cell).toHaveText("沒有此類基金");
  }
  await expect(page.getByRole("list", { name: "已選計劃" })).toBeVisible();
});
