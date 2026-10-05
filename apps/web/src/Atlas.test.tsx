import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { quantile } from "./Atlas";

const summary = {
  snapshotId: "published-1",
  fundClassCount: 451,
  schemeCount: 24,
  trusteeCount: 11,
  dataAsOf: { earliest: "2026-08-31", latest: "2026-08-31" },
};
const quality = {
  snapshotId: "published-1",
  fundClassCount: 451,
  evaluatedOn: "2026-09-30",
  returns: [1, 3, 5, 10].map((periodYears) => ({
    periodYears,
    eligible: 3,
    stale: 0,
    missing: 448,
    unverified: 0,
  })),
};
const row = (id: string, group: string, value: number, dataAsOf: string) => ({
  fundClassId: id,
  fundClassName: "n.a.",
  constituentFundName: `Fund ${id}`,
  schemeName: "Scheme",
  comparisonGroup: group,
  value,
  displayValue: `${value}%`,
  dataAsOf,
});
const hk = "股票基金 - 香港股票基金";
const bond = "債券基金 - 環球債券基金";
function stub({ riskSnapshot = "published-1" } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/summary"))
        return Promise.resolve(Response.json(summary));
      if (url.endsWith("/data-quality"))
        return Promise.resolve(Response.json(quality));
      if (url.includes("metric=risk"))
        return Promise.resolve(
          Response.json({
            snapshotId: riskSnapshot,
            rankings: [
              row("a", hk, 20.1, "2026-08-31"),
              row("b", hk, 18, "2026-08-31"),
              row("c", bond, 4.5, "2026-08-31"),
            ],
          }),
        );
      return Promise.resolve(
        Response.json({
          snapshotId: "published-1",
          rankings: [
            row("a", hk, 2.5, "2026-08-31"),
            row("b", hk, -1.205, "2026-07-31"),
            row("c", bond, 0.12, "2026-08-31"),
            // 沒有三年波幅的基金不入圖，但仍在圖幅索引出現。
            row("d", "股票基金 - 日本股票基金", 9, "2026-08-31"),
            // 不在積金局清單的組別不能被歸入任何類別。
            row("e", "積金局未提供基金類型", 5, "2026-08-31"),
          ],
        }),
      );
    }),
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("fund atlas", () => {
  it("plots only funds with both official values and keeps each source date", async () => {
    stub();
    render(<App apiUrl="https://api.test/health" />);
    expect(await screen.findByText("3 隻基金類別")).toBeVisible();
    const legend = screen.getByLabelText("基金圖圖例資料");
    expect(within(legend).getByText("2026-07-31 至 2026-08-31")).toBeVisible();
    expect(within(legend).getByText("積金局強積金基金平台")).toBeVisible();
    expect(
      screen.getByRole("img", { name: /3 隻基金類別，橫軸為三年波幅/ }),
    ).toBeInTheDocument();
  });

  it("highlights one MPFA family and labels derived medians as site calculations", async () => {
    stub();
    render(<App apiUrl="https://api.test/health" />);
    await screen.findByText("3 隻基金類別");
    const equity = screen.getByRole("button", { name: /^股票基金/ });
    expect(equity).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: /^保證基金/ })).toBeDisabled();
    fireEvent.click(equity);
    expect(equity).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("img", { name: /已突出股票基金（2 隻）/ }),
    ).toBeInTheDocument();
    // 少於 3 隻的類型不畫分布框，亦不列中位數表。
    expect(
      screen.queryByRole("table", { name: /本站計算/ }),
    ).not.toBeInTheDocument();
  });

  it("indexes every MPFA type and never files an unclassified fund", async () => {
    stub();
    render(<App apiUrl="https://api.test/health" />);
    const index = await screen.findByRole("heading", {
      name: "各類基金一年回報分布",
    });
    const sheet = index.closest("section")!;
    expect(
      within(sheet).getByRole("link", { name: /^日本股票基金/ }),
    ).toHaveAttribute(
      "href",
      `/rankings?period=1&group=${encodeURIComponent("股票基金 - 日本股票基金")}`,
    );
    expect(within(sheet).getByText(/2 隻 · 中位數 0.65%/)).toBeVisible();
    expect(
      within(sheet).queryByText(/積金局未提供基金類型/),
    ).not.toBeInTheDocument();
  });

  it("refuses to join rankings from different snapshots", async () => {
    stub({ riskSnapshot: "published-2" });
    render(<App apiUrl="https://api.test/health" />);
    expect(await screen.findByText(/暫時未能繪製基金圖/)).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "圖幅索引" }),
    ).not.toBeInTheDocument();
  });

  it("credits the harbour photograph with author and licence", () => {
    stub();
    render(<App apiUrl="https://api.test/health" />);
    expect(screen.getByRole("img", { name: /維多利亞港/ })).toBeInTheDocument();
    expect(screen.getByText(/David Iliff/)).toBeVisible();
    expect(screen.getByRole("link", { name: "CC BY-SA 3.0" })).toHaveAttribute(
      "href",
      expect.stringContaining("creativecommons.org/licenses/by-sa/3.0"),
    );
  });
});

describe("quantile", () => {
  it("interpolates and ignores non-finite values", () => {
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(quantile([5, NaN, Infinity], 0.5)).toBe(5);
    expect(quantile([], 0.5)).toBeUndefined();
  });
});
