import { render, screen, cleanup } from "@testing-library/react";
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
  window.history.replaceState({}, "", "/");
});
describe("fund comparison", () => {
  it("keeps raw zero and stale returns with their own source dates", async () => {
    window.history.replaceState({}, "", "/funds/compare?ids=a");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(fund)));
    render(<FundComparePage apiBaseUrl="https://api.test" />);
    expect(await screen.findByRole("table")).toBeVisible();
    expect(screen.getByText("1.205%")).toBeVisible();
    expect(screen.getByText(/過期 · 截至 2026-06-30/)).toBeVisible();
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
});
