import { cleanup, render, screen } from "@testing-library/react";
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
      fundClasses: [],
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
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        snapshotId: "snapshot-compare",
        schemes: [completeScheme, incompleteScheme],
      }),
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
    expect(screen.getByText("完整")).toBeVisible();
    expect(screen.getByText("不完整")).toBeVisible();
    expect(screen.getByText(/缺少65歲後基金/)).toBeVisible();
    expect(screen.getAllByText("不完整，不顯示").length).toBeGreaterThan(0);
    expect(screen.getAllByText("v1 暫不評分").length).toBe(2);
    expect(screen.getByRole("heading", { name: "雷達圖概覽" })).toBeVisible();
    expect(screen.getByRole("img", { name: /計劃比較雷達圖/ })).toBeVisible();
    expect(screen.getByText("DIS 不完整")).toBeVisible();
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
    expect(screen.getByRole("link", { name: "返回計劃概覽" })).toHaveAttribute(
      "href",
      "/schemes",
    );
  });
});
