import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Histogram,
  RangeChart,
  RiskScale,
  Scatter,
  StackedBars,
  StatTiles,
  formatDerived,
  median,
  niceTicks,
} from "./Charts";
import { PeerPosition } from "./PeerPosition";
import { SchemeOverview } from "./SchemeOverview";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("chart scale helpers", () => {
  it("builds clean ticks that cover the data", () => {
    expect(niceTicks(-4.33, 109.61, 5)).toEqual([-25, 0, 25, 50, 75, 100, 125]);
    expect(niceTicks(0.3, 1.9, 4)).toEqual([0, 0.5, 1, 1.5, 2]);
  });
  it("computes a derived median without touching the official values", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeUndefined();
    expect(formatDerived(1.23456)).toBe("1.23%");
  });
});

describe("chart components", () => {
  it("bins a distribution and offers a table twin", () => {
    render(
      <Histogram
        title="分布"
        values={[1, 2, 2.5, 7, -1]}
        binTarget={4}
        markers={[{ value: 2, label: "中位數 2%" }]}
      />,
    );
    expect(
      screen.getByRole("img", { name: /分布：共 5 個數值/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("中位數 2%")).toBeInTheDocument();
    fireEvent.click(screen.getByText("查看數據表"));
    const details = screen.getByText("查看數據表").closest("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByText(/隻基金$/).length).toBeGreaterThan(0);
  });

  it("does not draw a plot when no finite values exist", () => {
    render(<Histogram title="空" values={[Number.NaN]} />);
    expect(screen.getByText("沒有可用數值。")).toBeVisible();
  });

  it("states each range row in words for keyboard and screen readers", () => {
    render(
      <RangeChart
        title="範圍"
        rows={[
          {
            key: "a",
            label: "組別 A",
            min: 1,
            max: 5,
            median: 3,
            count: 4,
            summary: "組別 A：4 隻，範圍 1% 至 5%",
          },
        ]}
      />,
    );
    const row = screen.getByLabelText("組別 A：4 隻，範圍 1% 至 5%");
    expect(row).toHaveAttribute("tabindex", "0");
    expect(screen.getByText("4 隻")).toBeVisible();
  });

  it("summarises stacked composition per row with totals", () => {
    render(
      <StackedBars
        title="組成"
        series={[
          { key: "a", label: "甲", color: "#000" },
          { key: "b", label: "乙", color: "#111" },
        ]}
        rows={[
          {
            key: "r",
            label: "計劃一",
            plainLabel: "計劃一",
            values: { a: 2, b: 1 },
          },
        ]}
      />,
    );
    expect(
      screen.getByLabelText("計劃一：甲 2 隻，乙 1 隻（合計 3 隻）"),
    ).toBeInTheDocument();
    expect(screen.getByText("甲")).toBeVisible();
  });

  it("names both axes of a scatter plot", () => {
    render(
      <Scatter
        title="散點"
        points={[{ x: 10, y: 5, label: "基金一" }]}
        xLabel="波幅"
        yLabel="回報"
      />,
    );
    expect(
      screen.getByRole("img", { name: "散點：1 隻基金；橫軸波幅，縱軸回報" }),
    ).toBeInTheDocument();
  });

  it("renders KPI tiles as a labelled region", () => {
    render(
      <StatTiles label="摘要" items={[{ label: "基金類別", value: 451 }]} />,
    );
    expect(screen.getByRole("region", { name: "摘要" })).toHaveTextContent(
      "基金類別 451",
    );
  });

  it("prints the official risk class and admits when it is missing", () => {
    const { rerender } = render(<RiskScale riskClass={5} />);
    expect(
      screen.getByRole("img", { name: "風險級別 5（1 最低，7 最高）" }),
    ).toBeInTheDocument();
    rerender(<RiskScale riskClass={undefined} />);
    expect(
      screen.getByRole("img", { name: "風險級別：官方未提供" }),
    ).toBeInTheDocument();
  });
});

const rankings = (snapshotId: string, rows: object[]) =>
  Response.json({ snapshotId, rankings: rows });

describe("peer position", () => {
  it("places the fund inside its comparison group only from the same snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          rankings("snap-1", [
            {
              fundClassId: "me",
              comparisonGroup: "G",
              value: 4,
              displayValue: "4%",
              rank: 2,
              dataAsOf: "2026-08-31",
            },
            {
              fundClassId: "peer",
              comparisonGroup: "G",
              value: 8,
              displayValue: "8%",
              rank: 1,
              dataAsOf: "2026-08-31",
            },
            {
              fundClassId: "other",
              comparisonGroup: "H",
              value: 99,
              displayValue: "99%",
              rank: 1,
              dataAsOf: "2026-08-31",
            },
          ]),
        ),
      ),
    );
    render(
      <PeerPosition
        apiBaseUrl="https://api.test"
        fundClassId="me"
        comparisonGroup="G"
        snapshotId="snap-1"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "載入同組位置圖" }));
    expect(
      await screen.findByText("本基金在同組的回報位置"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByLabelText(/一年回報：同組 2 隻，範圍 4% 至 8%/),
    ).toHaveLength(1);
  });
});

describe("scheme overview", () => {
  it("counts official fund-type families without inventing categories", () => {
    render(
      <SchemeOverview
        schemes={[
          {
            schemeName: "計劃一",
            trusteeName: "受託人",
            fundClassCount: 3,
            riskClassDistribution: { "1": 1, "5": 2 },
            managementFee: { min: 0.5, median: 1, max: 1.5, fundCount: 3 },
            funds: [
              { fundType: "Equity Fund - Hong Kong Equity Fund" },
              { fundType: "Equity Fund - Global Equity Fund" },
              { fundType: "Bond Fund - Global Bond Fund" },
            ],
          },
        ]}
      />,
    );
    // 費用放最後：預設先看風險級別，管理費範圍是最後一個選項。
    const views = screen
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(views).toEqual(["風險級別分布", "基金種類組合", "管理費範圍"]);
    expect(screen.queryByText("各計劃管理費範圍")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "管理費範圍" }));
    expect(screen.getByText("各計劃管理費範圍")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "基金種類組合" }));
    expect(
      screen.getByLabelText(
        "計劃一：股票基金 2 隻，債券基金 1 隻（合計 3 隻）",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "風險級別分布" }));
    expect(
      screen.getByLabelText("計劃一：級別 1 1 隻，級別 5 2 隻（合計 3 隻）"),
    ).toBeInTheDocument();
  });
});
