import { expect, test, type Page } from "@playwright/test";

const numeric = (value: string) => Number(value.replace(/[^0-9.-]/g, ""));

type Row = { rank: number; value: number; group: string };

async function readRows(page: Page): Promise<Row[]> {
  const rows = page.locator("table.kw-table tbody tr");
  await expect(rows.first()).toBeVisible();
  return Promise.all(
    (await rows.all()).map(async (row) => {
      const cells = await row.locator("td").allTextContents();
      return {
        rank: numeric(cells[0]!),
        value: numeric(cells[2]!),
        group: cells[3]!.trim(),
      };
    }),
  );
}

function groupBy(rows: Row[]) {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    groups.set(row.group, [...(groups.get(row.group) ?? []), row]);
  }
  return groups;
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

test("回報排名在每個比較組別內獨立編號並由高至低排列", async ({ page }) => {
  await page.goto("/rankings");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "一年回報排名",
  );

  const rows = await readRows(page);
  expect(rows.length).toBeGreaterThan(0);

  for (const [group, groupRows] of groupBy(rows)) {
    expectCompetitionRanks(groupRows, group);
    for (let index = 1; index < groupRows.length; index += 1) {
      expect(groupRows[index]!.value).toBeLessThanOrEqual(
        groupRows[index - 1]!.value,
      );
    }
  }
});

test("每行排名都標示官方截至日期及原始來源連結", async ({ page }) => {
  await page.goto("/rankings");

  const firstRow = page.locator("table.kw-table tbody tr").first();
  await expect(firstRow).toBeVisible();
  await expect(firstRow.locator("td").nth(4)).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
  await expect(
    firstRow.getByRole("link", { name: /官方來源$/ }),
  ).toHaveAttribute("href", /^https?:\/\//);
});

test("切換回報期間會換走一年欄位並重新排名", async ({ page }) => {
  await page.goto("/rankings");

  const firstValue = page
    .locator("table.kw-table tbody tr")
    .first()
    .locator("td.kw-return");
  await expect(firstValue).toBeVisible();
  const firstOneYear = await firstValue.textContent();

  await page.getByLabel("回報期間").selectOption("10");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "十年回報排名",
  );
  await expect(
    page.getByRole("columnheader", { name: "十年回報" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "一年回報" }),
  ).toHaveCount(0);
  await expect(firstValue).not.toHaveText(firstOneYear ?? "");
});

test("切換至管理費指標會改為由低至高排序，並隱藏回報期間", async ({ page }) => {
  await page.goto("/rankings");
  await expect(page.locator("table.kw-table tbody tr").first()).toBeVisible();

  await page.getByLabel("排序指標").selectOption("fee");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "管理費排名",
  );
  await expect(page.getByLabel("回報期間")).toHaveCount(0);

  for (const [group, groupRows] of groupBy(await readRows(page))) {
    expectCompetitionRanks(groupRows, group);
    for (let index = 1; index < groupRows.length; index += 1) {
      expect(groupRows[index]!.value).toBeGreaterThanOrEqual(
        groupRows[index - 1]!.value,
      );
    }
  }
});

test("選擇比較組別後，只保留同組基金", async ({ page }) => {
  await page.goto("/rankings");

  const rows = page.locator("table.kw-table tbody tr");
  await expect(rows.first()).toBeVisible();
  const group = (await rows.first().locator("td").nth(3).textContent())!.trim();

  await page.getByLabel("比較組別").selectOption(group);

  await expect(rows.first()).toBeVisible();
  const filtered = await readRows(page);
  expect(filtered.length).toBeGreaterThan(0);
  for (const row of filtered) {
    expect(row.group).toBe(group);
  }
  expectCompetitionRanks(filtered, group);
});
