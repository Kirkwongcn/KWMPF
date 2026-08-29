import { expect, test, type Locator, type Page } from "@playwright/test";

const cardsOf = (page: Page) => page.locator("article.scheme-card");

const median = async (card: Locator) =>
  Number(
    ((await card.locator(".kw-fee-note").first().textContent()) ?? "").replace(
      /[^0-9.]/g,
      "",
    ),
  );

test("計劃比較頁列出全部已發布計劃及官方管理費", async ({ page }) => {
  await page.goto("/schemes");

  const cards = cardsOf(page);
  await expect(cards.first()).toBeVisible();
  await expect(cards).toHaveCount(24);

  const first = cards.first();
  await expect(
    first.locator("dt").filter({ hasText: "官方管理費" }),
  ).toBeVisible();
  await expect(first).toContainText("中位數");
  await expect(first).toContainText(/\d+\.\d{2}% – \d+\.\d{2}%/);
});

test("每個計劃都顯示官方資料截至日期", async ({ page }) => {
  await page.goto("/schemes");

  const cards = cardsOf(page);
  await expect(cards.first()).toBeVisible();
  for (const card of await cards.all()) {
    await expect(card).toContainText("資料截至");
    await expect(card).toContainText(/\d{4}-\d{2}-\d{2}|官方未提供日期/);
  }
});

test("按管理費中位數排序後由低至高排列", async ({ page }) => {
  await page.goto("/schemes");
  const cards = cardsOf(page);
  await expect(cards.first()).toBeVisible();

  await page.getByLabel("排序").selectOption("fee");

  const medians: number[] = [];
  for (const card of await cards.all()) {
    medians.push(await median(card));
  }
  expect(medians.length).toBe(24);
  for (let index = 1; index < medians.length; index += 1) {
    expect(medians[index]!).toBeGreaterThanOrEqual(medians[index - 1]!);
  }
});

test("計劃的基金列表預設收起，展開後按回報由高至低排列", async ({ page }) => {
  await page.goto("/schemes");
  const card = cardsOf(page).first();
  const summary = card.locator("details.kw-fund-disclosure > summary");
  await expect(summary).toBeVisible();
  await expect(card.locator(".kw-fund-list a").first()).toBeHidden();

  await summary.click();
  const returns = await card
    .locator(".kw-fund-list .kw-fund-return")
    .allTextContents();
  const published = returns
    .filter((text) => !text.includes("官方未提供"))
    .map((text) => Number(/-?\d+\.\d{2}(?=%)/.exec(text)?.[0]));
  expect(published.length).toBeGreaterThan(1);
  for (let index = 1; index < published.length; index += 1) {
    expect(published[index]!).toBeLessThanOrEqual(published[index - 1]!);
  }
});

test("由計劃比較頁可追查至個別基金詳情", async ({ page }) => {
  await page.goto("/schemes");
  const card = cardsOf(page).first();
  await card.locator("details.kw-fund-disclosure > summary").click();
  const firstFundLink = card.locator(".kw-fund-list a").first();
  await expect(firstFundLink).toBeVisible();
  await firstFundLink.click();

  await expect(page).toHaveURL(/\/fund-classes\//);
  await expect(
    page.getByRole("heading", { name: "資料來源及驗證" }),
  ).toBeVisible();
});

test("每個計劃都連到積金局的官方基金便覽", async ({ page }) => {
  await page.goto("/schemes");
  const cards = cardsOf(page);
  await expect(cards.first()).toBeVisible();

  const links = page.locator(".kw-scheme-factsheet a");
  await expect(links).toHaveCount(24);
  for (const href of await links.evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLAnchorElement).href),
  )) {
    expect(href).toMatch(
      /^https:\/\/www\.mpfa\.org\.hk\/assets\/FF\/\w+\.pdf$/,
    );
  }
});
