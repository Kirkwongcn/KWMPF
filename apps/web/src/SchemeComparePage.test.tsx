import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SchemeComparePage } from "./SchemeComparePage";

const completeScheme = {
  id: "計劃甲",
  schemeName: "計劃甲",
  trusteeName: "受託人甲",
  fundChoiceCount: 12,
  fundClassCount: 18,
  fer: { min: 0.5, median: 0.8, max: 1.2, fundCount: 10 },
  administrationScore: null,
  disPerformance: {
    status: "complete" as const,
    missing: [],
    coreAccumulation: {
      constituentFundName: "Core Accumulation Fund",
      returns: {
        "1y": { min: 8.1, max: 8.2, fundClassCount: 2 },
        "3y": { min: 5.0, max: 5.0, fundClassCount: 1 },
        "5y": null,
        "10y": null,
      },
      fundClasses: [
        {
          id: "core-a",
          fundClassName: "Class A",
          observations: {
            "3y": {
              value: 5,
              dataAsOf: "2026-06-30",
              sourceUrl: "https://trustee.test/june.pdf",
              status: "stale",
              graceDays: 90,
            },
          },
        },
      ],
    },
    age65Plus: {
      constituentFundName: "Age 65 Plus Fund",
      returns: {
        "1y": { min: 3.1, max: 3.1, fundClassCount: 1 },
        "3y": null,
        "5y": null,
        "10y": null,
      },
      fundClasses: [],
    },
  },
};

const incompleteScheme = {
  id: "計劃乙",
  schemeName: "計劃乙",
  trusteeName: "受託人乙",
  fundChoiceCount: 8,
  fundClassCount: 9,
  fer: { min: 0.7, median: 1.0, max: 1.4, fundCount: 8 },
  administrationScore: null,
  disPerformance: {
    status: "incomplete" as const,
    missing: ["age65_plus"] as Array<"age65_plus">,
    coreAccumulation: {
      constituentFundName: "Core Accumulation Fund",
      returns: {
        "1y": { min: 7.0, max: 7.0, fundClassCount: 1 },
        "3y": null,
        "5y": null,
        "10y": null,
      },
      fundClasses: [],
    },
    age65Plus: null,
  },
};

describe("SchemeComparePage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("titles the browser tab for the compare page", () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ snapshotId: "snapshot-compare", schemes: [] }),
        ),
    );
    render(
      <SchemeComparePage apiBaseUrl="https://api.test" search="?ids=計劃甲" />,
    );
    expect(document.title).toBe("計劃逐項比較｜KWMPF");
  });

  it("asks the user to pick schemes when the URL has no ids", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<SchemeComparePage apiBaseUrl="https://api.test" search="" />);
    expect(
      screen.getByText(/請先在計劃比較頁勾選 1 至 4 個計劃/),
    ).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("renders the comparison table and marks incomplete DIS clearly", async () => {
    // 每次呼叫回一個新 Response：比較頁另外讀 /schemes 做同類基金對照。
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        Response.json({
          snapshotId: "snapshot-compare",
          schemes: [completeScheme, incompleteScheme],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SchemeComparePage
        apiBaseUrl="https://api.test"
        search={`?ids=${encodeURIComponent("計劃甲")},${encodeURIComponent("計劃乙")}`}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "逐項對比" }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.test/schemes/compare?ids=${encodeURIComponent("計劃甲")},${encodeURIComponent("計劃乙")}`,
    );
    expect(screen.getByText("受託人甲")).toBeVisible();
    expect(screen.getByText("受託人乙")).toBeVisible();
    expect(screen.getByText("成分齊備")).toBeVisible();
    expect(screen.getByText(/1 筆過期/)).toBeVisible();
    const disclosure = screen.getByText("DIS 逐筆披露：日期、來源及時效");
    disclosure.click();
    expect(
      screen.getByText(/過期，僅供歷史參考；截至 2026-06-30/),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Class A · 查看基金詳情" }),
    ).toHaveAttribute("href", "/fund-classes/core-a");
    expect(screen.getByRole("link", { name: "官方來源" })).toHaveAttribute(
      "href",
      "https://trustee.test/june.pdf",
    );
    expect(screen.getByText("不完整")).toBeVisible();
    expect(screen.getByText(/缺少65歲後基金/)).toBeVisible();
    expect(screen.getAllByText("不完整，不顯示").length).toBeGreaterThan(0);
    // 行政評分未有方法前唔再顯示空白佔位行。
    expect(screen.queryByText("v1 暫不評分")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "逐項數據圖" })).toBeVisible();
    expect(
      screen.getByRole("figure", { name: "FER 中位數（本站統計）" }),
    ).toBeVisible();
    expect(screen.getByText("不完整")).toBeVisible();
  });

  it("shows the API error when a scheme id is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: "Scheme not found", missingIds: ["沒有的計劃"] },
            { status: 404 },
          ),
        ),
    );

    render(
      <SchemeComparePage
        apiBaseUrl="https://api.test"
        search={`?ids=${encodeURIComponent("沒有的計劃")}`}
      />,
    );

    expect(await screen.findByText("Scheme not found")).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: "返回計劃概覽" })[0],
    ).toHaveAttribute("href", "/schemes");
  });

  it("lines up each scheme's funds by MPFA fund type", async () => {
    const list = [
      {
        schemeName: "計劃甲",
        trusteeName: "受託人甲",
        funds: [
          {
            id: "hk-a",
            constituentFundName: "港股甲",
            fundClassName: "n.a.",
            comparisonGroup: "股票基金 - 香港股票基金",
            annualizedReturn1y: 3.5,
            latestFer: 1.2,
            returnsFreshness: {
              "1": { status: "verified", dataAsOf: "2026-08-31" },
            },
          },
        ],
      },
      {
        schemeName: "計劃乙",
        trusteeName: "受託人乙",
        funds: [
          {
            id: "bond-b",
            constituentFundName: "債券乙",
            fundClassName: "Class A",
            comparisonGroup: "債券基金 - 環球債券基金",
            annualizedReturn1y: 0.5,
            returnsFreshness: {
              "1": { status: "stale", dataAsOf: "2026-05-31" },
            },
          },
        ],
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          Response.json(
            url.endsWith("/schemes")
              ? list
              : {
                  snapshotId: "snapshot-compare",
                  schemes: [completeScheme, incompleteScheme],
                },
          ),
        ),
      ),
    );
    render(
      <SchemeComparePage
        apiBaseUrl="https://api.test"
        search={`?ids=${encodeURIComponent("計劃甲")},${encodeURIComponent("計劃乙")}`}
      />,
    );
    const matrix = await screen.findByRole("region", {
      name: "同類基金對照表",
    });
    const rows = within(matrix).getAllByRole("row");
    // 股票基金排喺債券基金之前；冇該類型的計劃明確寫出。
    expect(rows[1]).toHaveTextContent("股票基金 - 香港股票基金");
    expect(rows[1]).toHaveTextContent("港股甲");
    expect(rows[1]).toHaveTextContent("1年 3.5%");
    expect(rows[1]).toHaveTextContent("沒有此類基金");
    expect(rows[2]).toHaveTextContent("債券乙 · Class A");
    expect(within(rows[2]!).getByText("過期")).toBeVisible();
    expect(rows[2]).toHaveTextContent("開支比率 —");
    expect(screen.getByRole("link", { name: "移除：計劃甲" })).toHaveAttribute(
      "href",
      `/schemes/compare?ids=${encodeURIComponent("計劃乙")}`,
    );
  });
});
