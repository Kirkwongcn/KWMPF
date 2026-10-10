import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FundsPage } from "./FundsPage";

const filters = {
  snapshotId: "snapshot-1",
  categories: ["股票基金 - 香港股票基金", "債券基金 - 環球債券基金"],
  families: ["股票基金", "債券基金"],
  classification: {
    provider: "積金局強積金基金平台",
    capturedAt: "2026-10-04",
    official: true,
  },
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
    comparisonGroup: "股票基金 - 香港股票基金",
    comparisonGroupSource: "mpfa",
    riskClass: 6,
    annualizedReturn1y: 8.12,
    managementFee: 1.25,
    feeCaps: ["managementFee"],
    latestFer: 1.4,
    dataAsOf: "2026-06-30",
    freshness: {
      status: "stale",
      dataAsOf: "2026-06-30",
      graceDays: 45,
      ageDays: 88,
    },
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

    const fundType = await screen.findByLabelText("官方基金種類");
    expect(
      screen.getByRole("option", { name: "Equity Fund" }),
    ).toBeInTheDocument();
    expect(fundType).toHaveValue("all");
    expect(
      screen.getByRole("option", { name: "Trustee Two" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "風險級別 3" })).toBeVisible();
  });

  it("filters by the official MPFA fund type and names its source", async () => {
    const fetchMock = stubFetch((url) =>
      url.includes("/filters") ? filters : equityResults,
    );

    render(<FundsPage apiBaseUrl="https://api.test" />);

    fireEvent.change(await screen.findByLabelText("積金局基金類型"), {
      target: { value: "股票基金 - 香港股票基金" },
    });

    expect(await screen.findByText("港股基金")).toBeVisible();
    const searchCall = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter((url) => url.includes("/search"))
      .at(-1);
    expect(searchCall).toContain(
      "category=" +
        encodeURIComponent("股票基金 - 香港股票基金").replaceAll("%20", "+"),
    );
    expect(
      screen.getByText(/積金局強積金基金平台的官方分類（擷取 2026-10-04）/),
    ).toBeVisible();
    expect(screen.queryByText(/Lipper|非官方/)).toBeNull();
  });

  it("shows the comparison group rather than the platform descriptor", async () => {
    stubFetch((url) => (url.includes("/filters") ? filters : equityResults));

    render(<FundsPage apiBaseUrl="https://api.test" />);

    fireEvent.change(await screen.findByLabelText("積金局基金類型"), {
      target: { value: "股票基金 - 香港股票基金" },
    });

    expect(
      await screen.findByRole("cell", { name: "股票基金 - 香港股票基金" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("cell", { name: "Hong Kong Equity Fund" }),
    ).toBeNull();
  });

  it("keeps the old fundType URL working alongside the new category filter", async () => {
    const fetchMock = stubFetch((url) =>
      url.includes("/filters") ? filters : equityResults,
    );

    render(
      <FundsPage apiBaseUrl="https://api.test" initialFundType="Equity Fund" />,
    );

    expect(await screen.findByText("港股基金")).toBeVisible();
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .find((url) => url.includes("/search")),
    ).toContain("fundType=Equity+Fund");
  });

  it("browses by filter alone, without a search term", async () => {
    const fetchMock = stubFetch((url) =>
      url.includes("/filters") ? filters : equityResults,
    );

    render(<FundsPage apiBaseUrl="https://api.test" />);

    fireEvent.change(await screen.findByLabelText("官方基金種類"), {
      target: { value: "Equity Fund" },
    });

    expect(await screen.findByText("港股基金")).toBeVisible();
    const searchCall = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter((url) => url.includes("/search"))
      .at(-1);
    expect(searchCall).toContain("fundType=Equity+Fund");
    expect(searchCall).not.toContain("q=");
  });

  it("shows the official figures and source date for each match", async () => {
    stubFetch((url) => (url.includes("/filters") ? filters : equityResults));

    render(<FundsPage apiBaseUrl="https://api.test" />);

    fireEvent.change(await screen.findByLabelText("官方基金種類"), {
      target: { value: "Equity Fund" },
    });

    expect(await screen.findByText("8.12%")).toBeVisible();
    expect(screen.getByText("1.25%（上限）")).toBeVisible();
    expect(screen.getByText(/本頁一年回報截至 2026-06-30/)).toBeVisible();
    expect(screen.getAllByText(/^過期/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /港股基金/ })).toHaveAttribute(
      "href",
      "/fund-classes/equity-low",
    );
  });

  it("loads a useful default browse page without a filter", async () => {
    const fetchMock = stubFetch((url) =>
      url.includes("/filters") ? filters : equityResults,
    );

    render(<FundsPage apiBaseUrl="https://api.test" />);

    expect(await screen.findByLabelText("官方基金種類")).toBeVisible();
    expect(await screen.findByText("港股基金")).toBeVisible();
    expect(
      fetchMock.mock.calls
        .map((call) => String(call[0]))
        .some((url) => url.includes("/search?page=1&pageSize=50&sort=name")),
    ).toBe(true);
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

    fireEvent.change(await screen.findByLabelText("官方基金種類"), {
      target: { value: "Equity Fund" },
    });

    expect(
      await screen.findByText(/共 137 隻符合條件；第 1 \/ 3 頁，顯示 1–50 隻/),
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

    fireEvent.change(await screen.findByLabelText("官方基金種類"), {
      target: { value: "Equity Fund" },
    });

    expect(
      await screen.findByText(/共 1 隻符合條件；第 1 \/ 1 頁/),
    ).toBeVisible();
    expect(screen.queryByText(/顯示首 50 隻/)).not.toBeInTheDocument();
  });

  it("keeps site navigation and the sitewide disclaimer available", async () => {
    stubFetch((url) => (url.includes("/filters") ? filters : []));

    render(<FundsPage apiBaseUrl="https://api.test" />);

    await screen.findByLabelText("官方基金種類");
    expect(
      screen.getByRole("navigation", { name: "主要導覽" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/本網站提供資料比較及投資教育，不構成投資建議/),
    ).toBeVisible();
  });
});

describe("fund browse page without a separate class", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("omits the official n.a. placeholder next to the fund name", async () => {
    stubFetch((url) =>
      url.includes("/filters")
        ? filters
        : [{ ...equityResults[0], fundClassName: "n.a." }],
    );

    render(<FundsPage apiBaseUrl="https://api.test" />);

    fireEvent.change(await screen.findByLabelText("官方基金種類"), {
      target: { value: "Equity Fund" },
    });

    expect(await screen.findByRole("link", { name: "港股基金" })).toBeVisible();
    expect(screen.queryByText(/n\.a\./i)).not.toBeInTheDocument();
  });

  it("sorts by a column header, flips on a second click and keeps it in the link", async () => {
    const fetchMock = stubFetch((url) =>
      url.includes("/filters") ? filters : equityResults,
    );
    render(<FundsPage apiBaseUrl="https://api.test" />);
    const header = await screen.findByRole("button", { name: "3年" });
    fireEvent.click(header);
    expect(window.location.search).toContain("sort=return3y");
    expect(window.location.search).toContain("order=desc");
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("sort=return3y&order=desc"),
      ),
    ).toBe(true);
    fireEvent.click(await screen.findByRole("button", { name: "3年" }));
    expect(window.location.search).toContain("order=asc");
    expect(
      (await screen.findByRole("button", { name: "3年" })).closest("th"),
    ).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByText(/唔同基金類型一齊排序，只方便瀏覽/)).toBeVisible();
    window.history.replaceState({}, "", "/");
  });

  it("filters by a fund family chip and narrows the type list", async () => {
    stubFetch((url) => (url.includes("/filters") ? filters : equityResults));
    render(<FundsPage apiBaseUrl="https://api.test" />);
    fireEvent.click(await screen.findByRole("button", { name: "債券基金" }));
    expect(window.location.search).toContain(
      "family=" + encodeURIComponent("債券基金"),
    );
    const typeSelect = screen.getByLabelText("積金局基金類型");
    expect(
      Array.from((typeSelect as HTMLSelectElement).options).map(
        (option) => option.value,
      ),
    ).toEqual(["all", "債券基金 - 環球債券基金"]);
    window.history.replaceState({}, "", "/");
  });

  it("shows the trustee's three-year cumulative return as printed, apart from annualized", async () => {
    stubFetch((url) =>
      url.includes("/filters")
        ? filters
        : [
            {
              ...equityResults[0],
              id: "cumulative-a",
              constituentFundName: "累積基金甲",
              cumulativeReturn3y: 9.2,
              cumulativeReturn3yPrinted: "9.20",
              cumulativeReturnsFreshness: {
                "3": {
                  status: "verified",
                  dataAsOf: "2026-08-31",
                  graceDays: 90,
                  ageDays: 10,
                },
              },
            },
            {
              ...equityResults[0],
              id: "cumulative-b",
              constituentFundName: "累積基金乙",
              cumulativeReturn3y: 41.2,
              cumulativeReturn3yPrinted: "41.20",
              cumulativeReturnsFreshness: {
                "3": {
                  status: "stale",
                  dataAsOf: "2026-05-31",
                  graceDays: 90,
                  ageDays: 120,
                },
              },
            },
            {
              ...equityResults[0],
              id: "cumulative-dash",
              constituentFundName: "累積基金丙",
              cumulativeReturn3yPrinted: "-",
              cumulativeReturnsFreshness: {
                "3": {
                  status: "verified",
                  dataAsOf: "2026-08-31",
                  graceDays: 90,
                  ageDays: 10,
                },
              },
            },
          ],
    );
    render(<FundsPage apiBaseUrl="https://api.test" />);
    await screen.findByText("累積基金甲");
    const cells = screen
      .getAllByTitle("受託人官方累積回報（非年率化）")
      .map((cell) => cell.textContent);
    // 每格印出自己的截至日期：累積回報日期同年率化唔同。
    expect(cells).toEqual([
      "9.20%截至 2026-08-31",
      "41.20%過期截至 2026-05-31",
    ]);
    // 官方印「-」：寫官方未提供連日期，唔當 0。
    expect(
      screen.getByTitle("受託人每月摘要截至 2026-08-31 未有提供"),
    ).toHaveTextContent("官方未提供截至 2026-08-31");
    expect(
      screen.getByRole("columnheader", { name: "官方累積" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "年率化回報" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "3年累積" }).closest("th"),
    ).toBeInTheDocument();
  });
});
