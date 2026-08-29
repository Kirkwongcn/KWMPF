import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../fixtures/mpfa/cf-429.json";
import { FundClassPage } from "./FundClassPage";

describe("fund class page", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the fund identity and publication provenance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-mpfa-cf-429-2026-06-30",
          fundClass: fixture.fundClass,
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: fixture.fundClass.dataAsOf,
            retrievedAt: fixture.source.retrievedAt,
            rawSha256: "a".repeat(64),
            verificationStatus: "verified",
          },
        }),
      ),
    );

    render(
      <FundClassPage
        apiBaseUrl="https://api.test"
        fundClassId="mpfa-cf-429-class-i"
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Principal Hong Kong Equity Fund",
      }),
    ).toBeVisible();
    expect(screen.getByText("資料截至：2026-06-30")).toBeVisible();
    expect(screen.getByText("擷取版本：2026-08-11T00:00:00Z")).toBeVisible();
    expect(screen.getByText("驗證狀態：已驗證")).toBeVisible();
    expect(screen.getByText("基金開支比率（歷史財政期）")).toBeVisible();
    expect(screen.getByText("經常性費用（每年）")).toBeVisible();
    expect(screen.getByText("一次性及交易收費")).toBeVisible();
    expect(screen.getByText("持續成本說明（OCI）")).toBeVisible();
    expect(screen.getByRole("rowheader", { name: "管理費" })).toBeVisible();
    expect(screen.getByText(/資料比較不代表投資建議/)).toBeVisible();
    expect(screen.getByText(/配置及持倉資料的截至日期可能不同/)).toBeVisible();
    expect(screen.getByText("snapshot-mpfa-cf-429-2026-06-30")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "積金局原始資料" }),
    ).toHaveAttribute("href", fixture.source.url);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.test/fund-classes/mpfa-cf-429-class-i",
    );
  });

  it("keeps site navigation and the sitewide disclaimer available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-mpfa-cf-429-2026-06-30",
          fundClass: fixture.fundClass,
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: fixture.fundClass.dataAsOf,
            retrievedAt: fixture.source.retrievedAt,
            verificationStatus: "verified",
          },
        }),
      ),
    );

    render(
      <FundClassPage
        apiBaseUrl="https://api.test"
        fundClassId="mpfa-cf-429-class-i"
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Principal Hong Kong Equity Fund",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "主要導覽" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "計劃比較" })).toHaveAttribute(
      "href",
      "/schemes",
    );
    expect(
      screen.getByText(/本網站只提供資料比較及投資教育，不構成投資建議/),
    ).toBeVisible();
  });

  it("shows the official five and ten year returns alongside the one year figure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-mpfa-cf-429-2026-06-30",
          fundClass: {
            ...fixture.fundClass,
            annualizedReturn1y: 4.2,
            annualizedReturn5y: 6.14,
            annualizedReturn10y: 5.37,
          },
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: fixture.fundClass.dataAsOf,
            retrievedAt: fixture.source.retrievedAt,
            verificationStatus: "verified",
          },
        }),
      ),
    );

    render(
      <FundClassPage
        apiBaseUrl="https://api.test"
        fundClassId="mpfa-cf-429-class-i"
      />,
    );

    const table = await screen.findByRole("table", { name: "回報" });
    const row = (horizon: string) =>
      within(table)
        .getAllByRole("row")
        .find((candidate) => candidate.textContent?.startsWith(horizon))!;
    expect(within(row("一年")).getByText("4.20%")).toBeVisible();
    expect(within(row("五年")).getByText("6.14%")).toBeVisible();
    expect(within(row("十年")).getByText("5.37%")).toBeVisible();
  });

  it("marks long horizon returns the official source never published", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-mpfa-cf-429-2026-06-30",
          fundClass: { ...fixture.fundClass, annualizedReturn1y: 4.2 },
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: fixture.fundClass.dataAsOf,
            retrievedAt: fixture.source.retrievedAt,
            verificationStatus: "verified",
          },
        }),
      ),
    );

    render(
      <FundClassPage
        apiBaseUrl="https://api.test"
        fundClassId="mpfa-cf-429-class-i"
      />,
    );

    const table = await screen.findByRole("table", { name: "回報" });
    const rows = within(table).getAllByRole("row");
    expect(
      rows.find((row) => row.textContent?.startsWith("五年")),
    ).toBeVisible();
    expect(
      rows.find((row) => row.textContent?.startsWith("十年")),
    ).toBeVisible();
    expect(
      within(table).getAllByText("官方未提供").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("shows official unavailability instead of crashing on absent fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-missing-fields",
          fundClass: {
            ...fixture.fundClass,
            riskClass: undefined,
            latestFer: undefined,
            oci1yHkd: undefined,
          },
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: "2026-07-31",
            retrievedAt: "2026-08-13T00:00:00Z",
            verificationStatus: "verified",
          },
        }),
      ),
    );

    render(
      <FundClassPage
        apiBaseUrl="https://api.test"
        fundClassId="missing-fields"
      />,
    );

    expect(await screen.findAllByText("官方未提供")).toHaveLength(23);
    expect(screen.getByText(/適用披露規則/)).toBeVisible();
    expect(screen.getByText("官方未提供年度回報。")).toBeVisible();
  });

  it("groups the disclosed fee components and marks `Up to` rates as caps", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-fee-breakdown",
          fundClass: {
            ...fixture.fundClass,
            managementFee: 1.205,
            trusteeCustodianFee: 0.14,
            empfPlatformFee: 0.29,
            memberServicingFee: 0.2,
            investmentManagementFee: 0.4,
            guaranteeCharge: 0,
            joiningFee: 0,
            contributionCharge: 0,
            bidSpread: 0,
            offerSpread: 0,
            withdrawalCharge: 0,
            oci1yHkd: 15,
            oci3yHkd: 46,
            feeCaps: ["managementFee"],
            feeDisclosures: {
              annualFee: "(Based on Number of Members) 1 to 14, Up to HKD3,000",
            },
          },
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: "2026-07-31",
            retrievedAt: "2026-08-13T00:00:00Z",
            verificationStatus: "verified",
          },
        }),
      ),
    );

    render(
      <FundClassPage
        apiBaseUrl="https://api.test"
        fundClassId="fee-breakdown"
      />,
    );

    // 官方披露 1.205%，顯示時不可四捨五入成 1.21%。
    expect(await screen.findByText("1.205%（上限）")).toBeVisible();
    expect(screen.getByText(/披露的是收費上限而非實際費率/)).toBeVisible();
    expect(screen.getByText("HK$46")).toBeVisible();
    expect(
      screen.getByText("(Based on Number of Members) 1 to 14, Up to HKD3,000"),
    ).toBeVisible();
    // 年費是文字披露，不可當成缺失，也不可讀成分級門檻的數字。
    expect(screen.getByText("見下方文字披露")).toBeVisible();
    // 官方未提供五年 OCI，仍然顯示為未提供而不是 0。
    expect(screen.getAllByText("官方未提供").length).toBeGreaterThan(0);
  });

  it("keeps the official line breaks in a text fee disclosure", async () => {
    const annualFee = [
      "(Based on Number of Members)",
      "1 to 14, Up to HKD3,000",
      "15 to 29, Up to HKD1,500",
      "30 or more HKD0",
    ].join("\n");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-disclosure",
          fundClass: { ...fixture.fundClass, feeDisclosures: { annualFee } },
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: "2026-07-31",
            retrievedAt: "2026-08-13T00:00:00Z",
            verificationStatus: "verified",
          },
        }),
      ),
    );

    render(
      <FundClassPage apiBaseUrl="https://api.test" fundClassId="disclosure" />,
    );

    const value = await screen.findByText(
      (_, element) =>
        element?.tagName === "DD" && element.textContent === annualFee,
    );
    // 分行要留在 DOM，並靠 pre-line 顯示；擠成一行會讀成 `HKD3,00015 to 29`。
    expect(value.textContent).toContain("HKD3,000\n15 to 29");
    expect(value.closest("dl")).toHaveClass("fee-disclosures");
  });

  it("shows fund size, launch date and calendar year returns", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-profile",
          fundClass: {
            ...fixture.fundClass,
            fundSizeHkdMillion: 12974.87,
            fundSizeAsOf: "2026-07-31",
            returnsAsOf: "2026-07-31",
            launchDate: "2012-09-03",
            calendarYearReturns: { 2023: 24.3, 2024: 21.9, 2025: 16.49 },
            sinceLaunchReturnAnnualized: 12.39,
            sinceLaunchReturnCumulative: 407.79,
          },
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: "2026-07-31",
            retrievedAt: "2026-08-13T00:00:00Z",
            verificationStatus: "verified",
          },
        }),
      ),
    );

    render(
      <FundClassPage apiBaseUrl="https://api.test" fundClassId="profile" />,
    );

    expect(
      await screen.findByText("HK$12,974.87 百萬（截至 2026-07-31）"),
    ).toBeVisible();
    expect(screen.getByText("2012-09-03")).toBeVisible();

    const calendar = screen.getByRole("table", { name: "年度回報" });
    const years = within(calendar)
      .getAllByRole("rowheader")
      .map((cell) => cell.textContent);
    expect(years).toEqual(["2025", "2024", "2023"]);
    expect(within(calendar).getByText("16.49%")).toBeVisible();

    const returns = screen.getByRole("table", { name: "回報" });
    const sinceLaunch = within(returns).getByRole("rowheader", {
      name: "成立至今",
    }).parentElement!;
    expect(within(sinceLaunch).getByText("12.39%")).toBeVisible();
    expect(within(sinceLaunch).getByText("407.79%")).toBeVisible();
    expect(screen.getByText(/年度回報是該個曆年的累積回報/)).toBeVisible();
  });

  it("flags a fund size measured on a different date from the returns", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-mixed-dates",
          fundClass: {
            ...fixture.fundClass,
            fundSizeHkdMillion: 3344.42,
            fundSizeAsOf: "2026-05-31",
            returnsAsOf: "2026-07-31",
          },
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: "2026-07-31",
            retrievedAt: "2026-08-13T00:00:00Z",
            verificationStatus: "verified",
          },
          fundSizeFreshness: {
            status: "stale",
            dataAsOf: "2026-05-31",
            graceDays: 45,
            ageDays: 90,
          },
        }),
      ),
    );

    render(
      <FundClassPage apiBaseUrl="https://api.test" fundClassId="mixed-dates" />,
    );

    expect(await screen.findByText(/並非完全可比/)).toBeVisible();
    expect(screen.getByText(/基金規模已超出官方披露寬限期/)).toBeVisible();
  });
  it("titles the browser tab with the fund being viewed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-mpfa-cf-429-2026-06-30",
          fundClass: fixture.fundClass,
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: fixture.fundClass.dataAsOf,
            retrievedAt: fixture.source.retrievedAt,
            verificationStatus: "verified",
          },
        }),
      ),
    );

    render(
      <FundClassPage
        apiBaseUrl="https://api.test"
        fundClassId="mpfa-cf-429-class-i"
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Principal Hong Kong Equity Fund",
      }),
    ).toBeVisible();
    await waitFor(() =>
      expect(document.title).toBe("Principal Hong Kong Equity Fund｜KWMPF"),
    );
  });

  it("links to the fund's own comparison group ranking", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-mpfa-cf-429-2026-06-30",
          fundClass: fixture.fundClass,
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: fixture.fundClass.dataAsOf,
            retrievedAt: fixture.source.retrievedAt,
            verificationStatus: "verified",
          },
        }),
      ),
    );

    render(
      <FundClassPage
        apiBaseUrl="https://api.test"
        fundClassId="mpfa-cf-429-class-i"
      />,
    );

    const link = await screen.findByRole("link", { name: /同組基金排名/ });
    expect(link).toHaveAttribute(
      "href",
      `/rankings?period=1&group=${encodeURIComponent(fixture.fundClass.fundCategory)}`,
    );
  });

  const renderWithFreshness = (freshness: unknown) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-mpfa-cf-429-2026-06-30",
          fundClass: fixture.fundClass,
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: fixture.fundClass.dataAsOf,
            retrievedAt: fixture.source.retrievedAt,
            verificationStatus: "verified",
          },
          freshness,
        }),
      ),
    );
    render(
      <FundClassPage
        apiBaseUrl="https://api.test"
        fundClassId="mpfa-cf-429-class-i"
      />,
    );
  };

  it("marks a stale figure without hiding it or its original date", async () => {
    renderWithFreshness({
      status: "stale",
      dataAsOf: fixture.fundClass.dataAsOf,
      graceDays: 45,
      ageDays: 200,
    });

    expect(await screen.findByText("資料過期")).toBeVisible();
    expect(
      screen.getByText(
        new RegExp(`超出官方披露寬限期.*${fixture.fundClass.dataAsOf}`),
      ),
    ).toBeVisible();
    const oneYear = within(screen.getByRole("table", { name: "回報" }))
      .getAllByRole("row")
      .find((row) => row.textContent?.startsWith("一年"))!;
    expect(
      within(oneYear).getAllByText(
        `${fixture.fundClass.annualizedReturn1y.toFixed(2)}%`,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("shows a verified status when the data is inside the grace period", async () => {
    renderWithFreshness({
      status: "verified",
      dataAsOf: fixture.fundClass.dataAsOf,
      graceDays: 45,
      ageDays: 20,
    });

    expect(await screen.findByText("資料現行")).toBeVisible();
    expect(screen.queryByText("資料過期")).not.toBeInTheDocument();
  });
});

describe("fund class page without a separate class", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("omits the official n.a. placeholder from the subtitle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-mpfa-cf-429-2026-06-30",
          fundClass: { ...fixture.fundClass, fundClassName: "n.a." },
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: fixture.fundClass.dataAsOf,
            retrievedAt: fixture.source.retrievedAt,
            rawSha256: "a".repeat(64),
            verificationStatus: "verified",
          },
        }),
      ),
    );

    render(
      <FundClassPage
        apiBaseUrl="https://api.test"
        fundClassId="mpfa-cf-429-class-i"
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: fixture.fundClass.constituentFundName,
      }),
    ).toBeVisible();
    expect(
      screen.getByText(
        `${fixture.fundClass.fundType}／${fixture.fundClass.fundCategory}`,
      ),
    ).toBeVisible();
    expect(screen.queryByText(/n\.a\./i)).not.toBeInTheDocument();
  });
});

describe("cumulative returns", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const renderWithFields = (extra: Record<string, number | undefined>) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-mpfa-cf-429-2026-06-30",
          fundClass: { ...fixture.fundClass, ...extra },
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: fixture.fundClass.dataAsOf,
            retrievedAt: fixture.source.retrievedAt,
            rawSha256: "a".repeat(64),
            verificationStatus: "verified",
          },
        }),
      ),
    );
    render(
      <FundClassPage
        apiBaseUrl="https://api.test"
        fundClassId="mpfa-cf-429-class-i"
      />,
    );
  };

  it("puts each horizon's annualized and cumulative figures on the same row", async () => {
    renderWithFields({
      annualizedReturn1y: 29.58,
      cumulativeReturn1y: 29.58,
      annualizedReturn5y: 4.2,
      cumulativeReturn5y: 22.85,
      annualizedReturn10y: 9.41,
      cumulativeReturn10y: 145.86,
    });

    const table = await screen.findByRole("table", { name: "回報" });
    const rows = within(table).getAllByRole("row");
    expect(rows[0]).toHaveTextContent("年率化回報");
    expect(rows[0]).toHaveTextContent("累積回報");

    const tenYear = rows.find((row) => row.textContent?.startsWith("十年"))!;
    expect(within(tenYear).getByText("9.41%")).toBeVisible();
    expect(within(tenYear).getByText("145.86%")).toBeVisible();

    const fiveYear = rows.find((row) => row.textContent?.startsWith("五年"))!;
    expect(within(fiveYear).getByText("4.20%")).toBeVisible();
    expect(within(fiveYear).getByText("22.85%")).toBeVisible();
  });

  it("does not invent a cumulative figure the official source omits", async () => {
    renderWithFields({
      annualizedReturn5y: 4.2,
      annualizedReturn10y: undefined,
      cumulativeReturn5y: undefined,
      cumulativeReturn10y: undefined,
    });

    const table = await screen.findByRole("table", { name: "回報" });
    const fiveYear = within(table)
      .getAllByRole("row")
      .find((row) => row.textContent?.startsWith("五年"))!;
    expect(within(fiveYear).getByText("4.20%")).toBeVisible();
    expect(within(fiveYear).getByText("官方未提供")).toBeVisible();
    expect(screen.queryByText("22.85%")).not.toBeInTheDocument();
  });

  it("explains how the annualized and cumulative figures differ", async () => {
    renderWithFields({
      annualizedReturn10y: 9.41,
      cumulativeReturn10y: 145.86,
    });

    expect(
      await screen.findByText(
        /年率化回報是每年平均.*累積回報是整段期間的總變幅/,
      ),
    ).toBeVisible();
  });
});
