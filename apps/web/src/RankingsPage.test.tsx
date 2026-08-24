import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RankingsPage } from "./RankingsPage";

describe("published return rankings", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows traceable rankings and filters them by comparison group", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-2026-07-31",
          periodYears: 1,
          methodology: {
            metric: "annualized_return",
            grouping: "comparison_group",
            sortDirection: "descending",
            displayPrecision: 2,
          },
          rankings: [
            {
              fundClassId: "fund-a",
              fundClassName: "Class A",
              constituentFundName: "North America Fund",
              schemeName: "Scheme One",
              trusteeName: "Trustee One",
              comparisonGroup: "Equity Fund (North America)",
              value: 17.21,
              displayValue: "17.21%",
              rank: 1,
              dataAsOf: "2026-07-31",
              sourceUrl: "https://example.test/fund-a",
            },
            {
              fundClassId: "fund-b",
              fundClassName: "Class B",
              constituentFundName: "Hong Kong Money Market Fund",
              schemeName: "Scheme Two",
              trusteeName: "Trustee Two",
              comparisonGroup: "Money Market Fund - Hong Kong",
              value: 1.91,
              displayValue: "1.91%",
              rank: 1,
              dataAsOf: "2026-07-31",
              sourceUrl: "https://example.test/fund-b",
            },
          ],
        }),
      ),
    );

    render(<RankingsPage apiBaseUrl="https://api.test" />);

    expect(
      await screen.findByRole("heading", { name: "一年回報排名" }),
    ).toBeVisible();
    expect(screen.getByText("North America Fund")).toBeVisible();
    expect(screen.getByText("17.21%")).toBeVisible();
    expect(screen.getAllByText("2026-07-31")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "查看 North America Fund 詳情" }),
    ).toHaveAttribute("href", "/fund-classes/fund-a");
    expect(
      screen.getByRole("link", { name: "North America Fund 官方來源" }),
    ).toHaveAttribute("href", "https://example.test/fund-a");

    fireEvent.change(screen.getByLabelText("比較組別"), {
      target: { value: "Money Market Fund - Hong Kong" },
    });

    expect(screen.queryByText("North America Fund")).not.toBeInTheDocument();
    expect(screen.getByText("Hong Kong Money Market Fund")).toBeVisible();
    expect(fetch).toHaveBeenCalledWith("https://api.test/rankings?period=1");
  });
  it("lets the reader switch the ranking period and refetches from the API", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        Response.json({
          snapshotId: "snapshot-2026-07-31",
          periodYears: url.includes("period=5") ? 5 : 1,
          rankings: [
            {
              fundClassId: url.includes("period=5") ? "fund-long" : "fund-a",
              fundClassName: "Class A",
              constituentFundName: url.includes("period=5")
                ? "Long Horizon Fund"
                : "North America Fund",
              schemeName: "Scheme One",
              trusteeName: "Trustee One",
              comparisonGroup: "Equity Fund (North America)",
              displayValue: url.includes("period=5") ? "6.14%" : "17.21%",
              rank: 1,
              dataAsOf: "2026-07-31",
              sourceUrl: "https://example.test/fund",
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<RankingsPage apiBaseUrl="https://api.test" />);

    expect(await screen.findByText("17.21%")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/rankings?period=1",
    );

    fireEvent.change(screen.getByLabelText("回報期間"), {
      target: { value: "5" },
    });

    expect(await screen.findByText("6.14%")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/rankings?period=5",
    );
  });

  it("tells the reader the official source publishes no three year return", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-2026-07-31",
          periodYears: 1,
          rankings: [],
        }),
      ),
    );

    render(<RankingsPage apiBaseUrl="https://api.test" />);

    expect(await screen.findByText(/官方沒有提供三年年率化回報/)).toBeVisible();
    expect(screen.getByLabelText("回報期間")).toBeVisible();
  });
  it("opens on the comparison group and period named in the link", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        Response.json({
          snapshotId: "snapshot-2026-07-31",
          periodYears: Number(new URL(url).searchParams.get("period")),
          rankings: [
            {
              fundClassId: "fund-a",
              fundClassName: "Class A",
              constituentFundName: "North America Fund",
              schemeName: "Scheme One",
              trusteeName: "Trustee One",
              comparisonGroup: "Equity Fund (North America)",
              displayValue: "17.21%",
              rank: 1,
              dataAsOf: "2026-07-31",
              sourceUrl: "https://example.test/fund-a",
            },
            {
              fundClassId: "fund-b",
              fundClassName: "Class B",
              constituentFundName: "Money Market Fund",
              schemeName: "Scheme Two",
              trusteeName: "Trustee Two",
              comparisonGroup: "Money Market Fund - Hong Kong",
              displayValue: "1.91%",
              rank: 1,
              dataAsOf: "2026-07-31",
              sourceUrl: "https://example.test/fund-b",
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <RankingsPage
        apiBaseUrl="https://api.test"
        initialPeriod="5"
        initialComparisonGroup="Money Market Fund - Hong Kong"
      />,
    );

    expect(await screen.findByText("1.91%")).toBeVisible();
    expect(screen.queryByText("17.21%")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/rankings?period=5",
    );
    expect(screen.getByLabelText("回報期間")).toHaveValue("5");
    expect(screen.getByLabelText("比較組別")).toHaveValue(
      "Money Market Fund - Hong Kong",
    );
  });
  it("keeps showing a linked group that has no eligible funds for the period", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-2026-07-31",
          periodYears: 10,
          rankings: [
            {
              fundClassId: "fund-a",
              fundClassName: "Class A",
              constituentFundName: "North America Fund",
              schemeName: "Scheme One",
              trusteeName: "Trustee One",
              comparisonGroup: "Equity Fund (North America)",
              displayValue: "8.02%",
              rank: 1,
              dataAsOf: "2026-07-31",
              sourceUrl: "https://example.test/fund-a",
            },
          ],
        }),
      ),
    );

    render(
      <RankingsPage
        apiBaseUrl="https://api.test"
        initialPeriod="10"
        initialComparisonGroup="Guaranteed Fund"
      />,
    );

    expect(await screen.findByText(/沒有合資格的十年回報資料/)).toBeVisible();
    expect(screen.getByLabelText("比較組別")).toHaveValue("Guaranteed Fund");
  });

  const metricResponse = (metric: string) =>
    Response.json({
      snapshotId: "snapshot-2026-07-31",
      metric,
      periodYears: metric === "return" ? 1 : null,
      rankings: [
        {
          fundClassId: "fund-a",
          fundClassName: "Class A",
          constituentFundName: "North America Fund",
          schemeName: "Scheme One",
          trusteeName: "Trustee One",
          comparisonGroup: "Equity Fund (North America)",
          displayValue:
            metric === "fee" ? "0.65%" : metric === "risk" ? "3" : "17.21%",
          rank: 1,
          dataAsOf: "2026-07-31",
          sourceUrl: "https://example.test/fund-a",
        },
      ],
    });

  it("lets the reader rank by management fee instead of return", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          metricResponse(url.includes("metric=fee") ? "fee" : "return"),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<RankingsPage apiBaseUrl="https://api.test" />);

    expect(await screen.findByText("17.21%")).toBeVisible();

    fireEvent.change(screen.getByLabelText("排序指標"), {
      target: { value: "fee" },
    });

    expect(await screen.findByText("0.65%")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/rankings?metric=fee",
    );
    expect(screen.getByRole("heading", { name: "管理費排名" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "管理費" })).toBeVisible();
    expect(screen.queryByLabelText("回報期間")).not.toBeInTheDocument();
  });

  it("ranks official risk classes as a separate lower volatility view", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          metricResponse(url.includes("metric=risk") ? "risk" : "return"),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<RankingsPage apiBaseUrl="https://api.test" initialMetric="risk" />);

    expect(await screen.findByText("3")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/rankings?metric=risk",
    );
    expect(screen.getByLabelText("排序指標")).toHaveValue("risk");
    expect(screen.getByRole("heading", { name: "風險級別排名" })).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "風險級別" }),
    ).toBeVisible();
    expect(
      screen.getByText(/風險級別由官方公布，數字越低代表過往波幅越低/),
    ).toBeVisible();
  });

  it("puts the ranked value before the long comparison group column", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(metricResponse("fee"))),
    );

    render(<RankingsPage apiBaseUrl="https://api.test" initialMetric="fee" />);

    expect(await screen.findByText("0.65%")).toBeVisible();
    expect(
      screen.getAllByRole("columnheader").map((cell) => cell.textContent),
    ).toEqual(["名次", "基金", "管理費", "比較組別", "截至日期", "來源"]);
  });

  it("keeps the return metric link format unchanged", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(metricResponse("return")));
    vi.stubGlobal("fetch", fetchMock);

    render(<RankingsPage apiBaseUrl="https://api.test" />);

    expect(await screen.findByText("17.21%")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/rankings?period=1",
    );
    expect(screen.getByLabelText("排序指標")).toHaveValue("return");
  });
});
