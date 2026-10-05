import { expect, test, type Page } from "@playwright/test";

const numeric = (value: string) => Number(value.replace(/[^0-9.-]/g, ""));

type Row = { rank: number; value: number; group: string };

async function readRows(page: Page): Promise<Row[]> {
  const rows = page.locator("table.kw-table tbody tr");
  await expect
    .poll(async () => {
      if ((await rows.count()) > 0) return true;
      return (await page.getByRole("status").allTextContents()).some((text) =>
        text.includes("目前沒有合資格"),
      );
    })
    .toBe(true);

  return Promise.all(
    (await rows.all()).map(async (row) => {
      const cells = await row.locator("td").allTextContents();
      // 欄位：名次、比較掣、基金、數值、積金局基金類型、截至日期、來源。
      return {
        rank: numeric(cells[0]!),
        value: numeric(cells[3]!),
        group: cells[4]!.trim(),
      };
    }),
  );
}

// 未揀類型時排名頁先列出積金局基金類型；揀合資格基金最多的一個。
async function pickLargestType(page: Page) {
  const buttons = page.locator(".kw-type-picker button");
  await expect(buttons.first()).toBeVisible();
  const counts = await buttons.locator("strong").allTextContents();
  const largest = counts
    .map((text, index) => ({ count: Number(text), index }))
    .sort((a, b) => b.count - a.count)[0]!;
  await buttons.nth(largest.index).click();
  await expect(page).toHaveURL(/group=/);
}

async function expectHonestEmptyReturnState(page: Page, period: string) {
  await expect(
    page.locator(".kw-status--warning").filter({
      hasText: "目前沒有合資格",
    }),
  ).toContainText(`目前沒有合資格的${period}回報資料。`);
  await expect(
    page.locator(".kw-status--warning").filter({
      hasText: "超出網站時效門檻",
    }),
  ).toBeVisible();
}

// Competition ranking: equal values share a rank, the next fund takes its
// ordinal position.
function expectCompetitionRanks(rows: Row[], group: string) {
  expect(rows[0]!.rank, `${group} 應由第 1 名開始`).toBe(1);
  for (let index = 1; index < rows.length; index += 1) {
    const expected =
      rows[index]!.value === rows[index - 1]!.value
        ? rows[index - 1]!.rank
        : index + 1;
    expect(rows[index]!.rank, `${group} 第 ${index + 1} 行名次`).toBe(expected);
  }
}

function rankingResponseFor(
  page: Page,
  key: "period" | "metric",
  value: string,
) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname.endsWith("/rankings") &&
      url.searchParams.get(key) === value &&
      response.ok()
    );
  });
}

test("回報排名按比較組別排序，過期資料會明確剔除", async ({ page }) => {
  await page.goto("/rankings");
  await expect(
    page.getByRole("heading", { name: "先揀一個積金局基金類型" }),
  ).toBeVisible();
  await expect(page.locator("table.kw-table tbody tr")).toHaveCount(0);
  await pickLargestType(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "一年回報排名",
  );

  const rows = await readRows(page);
  if (rows.length === 0) {
    await expectHonestEmptyReturnState(page, "一年");
    return;
  }

  for (const [group, groupRows] of groupBy(rows)) {
    expectCompetitionRanks(groupRows, group);
    for (let index = 1; index < groupRows.length; index += 1) {
      expect(groupRows[index]!.value).toBeLessThanOrEqual(
        groupRows[index - 1]!.value,
      );
    }
  }
});

function groupBy(rows: Row[]) {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    groups.set(row.group, [...(groups.get(row.group) ?? []), row]);
  }
  return groups;
}

test("排名列出官方截至日期及來源，空排名會交代過期原因", async ({ page }) => {
  await page.goto("/rankings");
  await pickLargestType(page);

  const rows = await readRows(page);
  if (rows.length === 0) {
    await expectHonestEmptyReturnState(page, "一年");
    return;
  }

  const firstRow = page.locator("table.kw-table tbody tr").first();
  await expect(firstRow.locator("td").nth(5)).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
  await expect(
    firstRow.getByRole("link", { name: /官方來源$/ }),
  ).toHaveAttribute("href", /^https?:\/\//);
});

test("切換回報期間會更新排名，或說明沒有合資格資料", async ({ page }) => {
  await page.goto("/rankings");
  await pickLargestType(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "一年回報排名",
  );

  const threeYearResponse = rankingResponseFor(page, "period", "3");
  await page.getByLabel("回報期間").selectOption("3");
  await threeYearResponse;

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "三年回報排名",
  );
  await expect(page.getByLabel("回報期間")).toHaveValue("3");
  const threeYearRows = await readRows(page);
  if (threeYearRows.length === 0) {
    await expectHonestEmptyReturnState(page, "三年");
  } else {
    await expect(
      page.getByRole("columnheader", { name: "三年回報" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "一年回報" }),
    ).toHaveCount(0);
    await expect(
      page.locator("table.kw-table tbody tr").first().locator("td").nth(5),
    ).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
  }

  const tenYearResponse = rankingResponseFor(page, "period", "10");
  await page.getByLabel("回報期間").selectOption("10");
  await tenYearResponse;

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "十年回報排名",
  );
  const tenYearRows = await readRows(page);
  if (tenYearRows.length === 0) {
    await expectHonestEmptyReturnState(page, "十年");
  } else {
    await expect(
      page.getByRole("columnheader", { name: "十年回報" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "一年回報" }),
    ).toHaveCount(0);
    await expect(
      page.locator("table.kw-table tbody tr").first().locator("td").nth(5),
    ).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
  }
});

test("切換至管理費指標會改為由低至高排序，並隱藏回報期間", async ({ page }) => {
  await page.goto("/rankings");

  const feeResponse = rankingResponseFor(page, "metric", "fee");
  await page.getByLabel("排序指標").selectOption("fee");
  await feeResponse;
  await pickLargestType(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "管理費排名",
  );
  await expect(page.getByLabel("回報期間")).toHaveCount(0);

  const rows = await readRows(page);
  if (rows.length === 0) {
    await expect(
      page.locator(".kw-status--warning").filter({
        hasText: "目前沒有合資格",
      }),
    ).toContainText("目前沒有合資格的管理費資料。");
    await expect(
      page.locator(".kw-status--warning").filter({
        hasText: "超出網站時效門檻",
      }),
    ).toBeVisible();
    return;
  }
  expect(rows.length).toBeGreaterThan(0);
  for (const [group, groupRows] of groupBy(rows)) {
    expectCompetitionRanks(groupRows, group);
    for (let index = 1; index < groupRows.length; index += 1) {
      expect(groupRows[index]!.value).toBeGreaterThanOrEqual(
        groupRows[index - 1]!.value,
      );
    }
  }
});

test("選擇比較組別後，只保留同組基金", async ({ page }) => {
  await page.goto("/rankings?metric=fee");
  await pickLargestType(page);

  const rows = page.locator("table.kw-table tbody tr");
  const allRows = await readRows(page);
  if (allRows.length === 0) {
    await expect(
      page.locator(".kw-status--warning").filter({
        hasText: "目前沒有合資格",
      }),
    ).toContainText("目前沒有合資格的管理費資料。");
    await expect(
      page.locator(".kw-status--warning").filter({
        hasText: "超出網站時效門檻",
      }),
    ).toBeVisible();
    return;
  }
  expect(allRows.length).toBeGreaterThan(0);
  for (const row of allRows) expect(row.group).toBe(allRows[0]!.group);

  // 轉去另一個類型，表內只剩該類型基金。
  const select = page.getByLabel("積金局基金類型");
  const group = (await select.locator("option").allTextContents())
    .map((text) => text.trim())
    .find((text) => text !== allRows[0]!.group && !text.startsWith("全部"))!;
  await select.selectOption(group);
  await expect(page).toHaveURL(/group=/);

  const filtered = await readRows(page);
  if (filtered.length === 0) return;
  await expect(rows.first()).toBeVisible();
  for (const row of filtered) {
    expect(row.group).toBe(group);
  }
  expectCompetitionRanks(filtered, group);
});

test("窄螢幕排名表可用左右方向鍵橫向捲動", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/rankings?metric=return&period=3");
  await pickLargestType(page);

  const tableRegion = page.getByRole("region", { name: "基金排名結果" });
  await expect(tableRegion).toBeVisible();
  const dimensions = await tableRegion.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);

  await tableRegion.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => tableRegion.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);

  await page.keyboard.press("ArrowLeft");
  await expect
    .poll(() => tableRegion.evaluate((element) => element.scrollLeft))
    .toBe(0);
});
