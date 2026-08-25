import { expect, test } from "@playwright/test";

test("未選條件前不會查詢，選受託人後結果全部相符", async ({ page }) => {
  await page.goto("/funds");

  await expect(
    page.getByText("先選擇一項篩選條件或輸入關鍵字，才會查詢已發布快照。"),
  ).toBeVisible();

  const trusteeFilter = page.getByLabel("受託人");
  await expect(trusteeFilter.locator("option")).not.toHaveCount(1);
  const trustee = (await trusteeFilter.locator("option").nth(1).textContent())!;
  await trusteeFilter.selectOption({ label: trustee });

  const rows = page.locator("table.kw-table tbody tr");
  await expect(rows.first()).toBeVisible();
  for (const text of await rows.allTextContents()) {
    expect(text).toContain(trustee);
  }
});

test("加入風險級別條件後結果收窄且仍全部相符", async ({ page }) => {
  await page.goto("/funds");

  const trusteeFilter = page.getByLabel("受託人");
  const trustee = (await trusteeFilter.locator("option").nth(1).textContent())!;
  await trusteeFilter.selectOption({ label: trustee });

  const rows = page.locator("table.kw-table tbody tr");
  await expect(rows.first()).toBeVisible();
  const beforeCount = await rows.count();

  const riskCell = rows.first().locator("td").nth(2);
  const riskClass = (await riskCell.textContent())!.trim();
  test.skip(!/^\d+$/.test(riskClass), "首行沒有官方風險級別可用作篩選");

  const narrowed = page.waitForResponse(
    (response) =>
      response.url().includes("/search?") &&
      new URL(response.url()).searchParams.get("riskClass") === riskClass,
  );
  await page.getByLabel("風險級別").selectOption(riskClass);
  await narrowed;

  await expect(rows.first()).toBeVisible();
  await expect
    .poll(async () =>
      rows.evaluateAll(
        (elements, expected) =>
          elements
            .map((element) => ({
              text: element.textContent ?? "",
              riskClass:
                element.querySelectorAll("td")[2]?.textContent?.trim() ?? "",
            }))
            .filter(
              (row) =>
                !row.text.includes(expected.trustee) ||
                row.riskClass !== expected.riskClass,
            ),
        { trustee, riskClass },
      ),
    )
    .toEqual([]);

  expect(await rows.count()).toBeLessThanOrEqual(beforeCount);
});

test("篩選結果每一行都標示官方截至日期", async ({ page }) => {
  await page.goto("/funds?trustee=all&riskClass=all&fundType=all&q=BCT");

  const rows = page.locator("table.kw-table tbody tr");
  await expect(rows.first()).toBeVisible();
  for (const row of await rows.all()) {
    await expect(row.locator("td").last()).toHaveText(
      /^\d{4}-\d{2}-\d{2}$|官方未提供/,
    );
  }
});
