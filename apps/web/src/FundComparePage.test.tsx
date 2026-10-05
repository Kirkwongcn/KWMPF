import {
  render,
  screen,
  cleanup,
  within,
  fireEvent,
} from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { FundComparePage } from "./FundComparePage";
const fund = {
  snapshotId: "snapshot-1",
  comparisonGroup: "Group A",
  fundClass: {
    constituentFundName: "Fund A",
    fundClassName: "Class A",
    schemeName: "Scheme A",
    annualizedReturn1y: 0,
    annualizedReturn3y: 1.205,
    returnSources: {
      "3": {
        dataAsOf: "2026-06-30",
        sourceUrl: "https://trustee.test/fund.pdf",
      },
    },
  },
  provenance: { sourceUrl: "https://mpfa.test/fund", dataAsOf: "2026-08-31" },
  returnsFreshness: {
    "1": { status: "verified", dataAsOf: "2026-08-31" },
    "3": { status: "stale", dataAsOf: "2026-06-30" },
  },
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});
describe("fund comparison", () => {
  it("keeps raw zero and stale returns with their own source dates", async () => {
    window.history.replaceState({}, "", "/funds/compare?ids=a");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(fund)));
    render(<FundComparePage apiBaseUrl="https://api.test" />);
    const table = await screen.findByRole("table", {
      name: "原始數值與來源（過期值仍保留）",
    });
    expect(table).toBeVisible();
    expect(within(table).getByText("1.205%")).toBeVisible();
    expect(within(table).getByText(/過期 · 截至 2026-06-30/)).toBeVisible();
    expect(
      screen
        .getAllByRole("link", { name: /官方來源/ })
        .some(
          (link) =>
            link.getAttribute("href") === "https://trustee.test/fund.pdf",
        ),
    ).toBe(true);
  });
  it("rejects mixed publication snapshots", async () => {
    window.history.replaceState({}, "", "/funds/compare?ids=a,b");
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          Response.json(
            url.endsWith("/a") ? fund : { ...fund, snapshotId: "snapshot-2" },
          ),
        ),
      ),
    );
    render(<FundComparePage apiBaseUrl="https://api.test" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("同一快照");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
  it("does not silently truncate selections beyond four", () => {
    window.history.replaceState({}, "", "/funds/compare?ids=a,b,c,d,e");
    vi.stubGlobal("fetch", vi.fn());
    render(<FundComparePage apiBaseUrl="https://api.test" />);
    expect(screen.getByText(/請在基金瀏覽頁選取/)).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("marks highest and lowest only when every fund shares one MPFA type", async () => {
    const make = (name: string, group: string, oneYear: number) => ({
      ...fund,
      comparisonGroup: group,
      fundClass: {
        ...fund.fundClass,
        constituentFundName: name,
        annualizedReturn1y: oneYear,
      },
    });
    window.history.replaceState({}, "", "/funds/compare?ids=a,b");
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          Response.json(
            url.endsWith("/a")
              ? make("Fund A", "Group A", 4.5)
              : make("Fund B", "Group A", 2.25),
          ),
        ),
      ),
    );
    render(<FundComparePage apiBaseUrl="https://api.test" />);
    const table = await screen.findByRole("table", {
      name: "原始數值與來源（過期值仍保留）",
    });
    expect(within(table).getByText("最高")).toBeVisible();
    expect(within(table).getByText("最低")).toBeVisible();
    cleanup();

    window.history.replaceState({}, "", "/funds/compare?ids=a,b");
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          Response.json(
            url.endsWith("/a")
              ? make("Fund A", "Group A", 4.5)
              : make("Fund B", "Group B", 2.25),
          ),
        ),
      ),
    );
    render(<FundComparePage apiBaseUrl="https://api.test" />);
    const mixed = await screen.findByRole("table", {
      name: "原始數值與來源（過期值仍保留）",
    });
    expect(within(mixed).queryByText("最高")).toBeNull();
    expect(screen.getByText(/不同積金局基金類型/)).toBeVisible();
  });
  it("lets the reader add a fund from the page when nothing is selected", async () => {
    window.history.replaceState({}, "", "/funds/compare");
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          Response.json(
            url.includes("/search")
              ? [
                  {
                    id: "a",
                    constituentFundName: "Fund A",
                    fundClassName: "Class A",
                    schemeName: "Scheme A",
                    comparisonGroup: "Group A",
                  },
                ]
              : fund,
          ),
        ),
      ),
    );
    render(<FundComparePage apiBaseUrl="https://api.test" />);
    expect(screen.getByText(/未揀基金/)).toBeVisible();
    fireEvent.change(screen.getByLabelText("加入基金"), {
      target: { value: "Fund" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "加入" }));
    expect(window.location.search).toBe("?ids=a");
    expect(
      await screen.findByRole("table", {
        name: "原始數值與來源（過期值仍保留）",
      }),
    ).toBeVisible();
  });
});
