import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FundsPage } from "./FundsPage";

const filters = {
  snapshotId: "snapshot-1",
  fundTypes: ["Bond Fund", "Equity Fund"],
  trustees: ["Trustee One", "Trustee Two"],
  riskClasses: [3, 5, 6],
};

const equityResults = [
  {
    id: "equity-low",
    fundClassName: "Class A",
    constituentFundName: "港股基金",
    schemeName: "計劃甲",
    trusteeName: "Trustee One",
    fundType: "Equity Fund",
    fundCategory: "Hong Kong Equity Fund",
    riskClass: 6,
    annualizedReturn1y: 8.12,
    managementFee: 1.25,
    latestFer: 1.4,
    dataAsOf: "2026-06-30",
  },
];

function stubFetch(handler: (url: string) => unknown) {
  const fetchMock = vi.fn((input: RequestInfo | URL) =>
    Promise.resolve(Response.json(handler(String(input)))),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fund browse page", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("offers the filter values published in the current snapshot", async () => {
    stubFetch((url) => (url.includes("/filters") ? filters : []));

    render(<FundsPage apiBaseUrl="https://api.test" />);

    const fundType = await screen.findByLabelText("基金種類");
    expect(
      screen.getByRole("option", { name: "Equity Fund" }),
    ).toBeInTheDocument();
    expect(fundType).toHaveValue("all");
    expect(
      screen.getByRole("option", { name: "Trustee Two" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "風險級別 3" })).toBeVisible();
  });

  it("browses by filter alone, without a search term", async () => {
    const fetchMock = stubFetch((url) =>
      url.includes("/filters") ? filters : equityResults,
    );

    render(<FundsPage apiBaseUrl="https://api.test" />);

    fireEvent.change(await screen.findByLabelText("基金種類"), {
      target: { value: "Equity Fund" },
    });

    expect(await screen.findByText("港股基金")).toBeVisible();
    const searchCall = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .find((url) => url.includes("/search"));
    expect(searchCall).toContain("fundType=Equity+Fund");
    expect(searchCall).not.toContain("q=");
  });

  it("shows the official figures and source date for each match", async () => {
    stubFetch((url) => (url.includes("/filters") ? filters : equityResults));

    render(<FundsPage apiBaseUrl="https://api.test" />);

    fireEvent.change(await screen.findByLabelText("基金種類"), {
      target: { value: "Equity Fund" },
    });

    expect(await screen.findByText("8.12%")).toBeVisible();
    expect(screen.getByText("1.25%")).toBeVisible();
    expect(screen.getByText("2026-06-30")).toBeVisible();
    expect(screen.getByRole("link", { name: /港股基金/ })).toHaveAttribute(
      "href",
      "/fund-classes/equity-low",
    );
  });

  it("prompts for a filter before any query is sent", async () => {
    const fetchMock = stubFetch((url) =>
      url.includes("/filters") ? filters : equityResults,
    );

    render(<FundsPage apiBaseUrl="https://api.test" />);

    expect(await screen.findByLabelText("基金種類")).toBeVisible();
    expect(
      screen.getByText(/先選擇一項篩選條件或輸入關鍵字/),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) => url.includes("/search")),
    ).toBe(false);
  });

  it("reports when no published fund matches the chosen filters", async () => {
    stubFetch((url) => (url.includes("/filters") ? filters : []));

    render(<FundsPage apiBaseUrl="https://api.test" />);

    fireEvent.change(await screen.findByLabelText("風險級別"), {
      target: { value: "3" },
    });

    expect(await screen.findByText(/沒有符合條件的已發布基金/)).toBeVisible();
  });

  it("states the true number of matches when the list is capped", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/filters"))
          return Promise.resolve(Response.json(filters));
        const cappedPage = Array.from({ length: 50 }, (_, index) => ({
          ...equityResults[0],
          id: `equity-${index}`,
        }));
        return Promise.resolve(
          Response.json(cappedPage, {
            headers: { "X-Total-Matches": "137" },
          }),
        );
      }),
    );

    render(<FundsPage apiBaseUrl="https://api.test" />);

    fireEvent.change(await screen.findByLabelText("基金種類"), {
      target: { value: "Equity Fund" },
    });

    expect(
      await screen.findByText(/共 137 隻符合條件，以下顯示首 50 隻/),
    ).toBeVisible();
  });

  it("does not claim a cap when every match is shown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/filters"))
          return Promise.resolve(Response.json(filters));
        return Promise.resolve(
          Response.json(equityResults, {
            headers: { "X-Total-Matches": "1" },
          }),
        );
      }),
    );

    render(<FundsPage apiBaseUrl="https://api.test" />);

    fireEvent.change(await screen.findByLabelText("基金種類"), {
      target: { value: "Equity Fund" },
    });

    expect(await screen.findByText(/共 1 隻已發布基金/)).toBeVisible();
    expect(screen.queryByText(/顯示首 50 隻/)).not.toBeInTheDocument();
  });

  it("keeps site navigation and the sitewide disclaimer available", async () => {
    stubFetch((url) => (url.includes("/filters") ? filters : []));

    render(<FundsPage apiBaseUrl="https://api.test" />);

    await screen.findByLabelText("基金種類");
    expect(
      screen.getByRole("navigation", { name: "主要導覽" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/本網站只提供資料比較及投資教育，不構成投資建議/),
    ).toBeVisible();
  });
});
