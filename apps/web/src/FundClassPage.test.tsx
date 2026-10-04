import {
  cleanup,
  fireEvent,
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
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.queryByText("預設投資策略")).not.toBeInTheDocument();
  });

  it("labels a DIS core accumulation fund from the exact-name tag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-dis-core",
          fundClass: {
            ...fixture.fundClass,
            constituentFundName: "Principal Core Accumulation Fund",
            isDisComponent: "core_accumulation",
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
      <FundClassPage apiBaseUrl="https://api.test" fundClassId="dis-core" />,
    );

    expect(await screen.findByText("預設投資策略")).toBeVisible();
    expect(screen.getByText("核心累積基金")).toBeVisible();
  });

  it("labels a DIS age 65 plus fund from the exact-name tag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-dis-age65",
          fundClass: {
            ...fixture.fundClass,
            constituentFundName: "Principal Age 65 Plus Fund",
            isDisComponent: "age65_plus",
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
      <FundClassPage apiBaseUrl="https://api.test" fundClassId="dis-age65" />,
    );

    expect(await screen.findByText("預設投資策略")).toBeVisible();
    expect(screen.getByText("65歲後基金")).toBeVisible();
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
      screen.getByText(/本網站提供資料比較及投資教育，不構成投資建議/),
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
    expect(within(row("一年")).getByText("4.2%")).toBeVisible();
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
    expect(within(table).getAllByText("未取得").length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("shows the fund risk indicator next to the risk class without conflating them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-risk-indicator",
          fundClass: {
            ...fixture.fundClass,
            riskClass: 6,
            fundRiskIndicator: 20.73,
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
        fundClassId="risk-indicator"
      />,
    );

    expect(await screen.findByText("基金風險指標")).toBeVisible();
    expect(screen.getByText("20.73%")).toBeVisible();
    expect(screen.getByText(/過去三年的年度化標準差/)).toBeVisible();
  });

  it("marks an absent fund risk indicator as officially unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-no-risk-indicator",
          fundClass: { ...fixture.fundClass, fundRiskIndicator: undefined },
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
        fundClassId="no-indicator"
      />,
    );

    const indicator = (await screen.findByText("基金風險指標")).closest("div");
    expect(indicator).toHaveTextContent("未取得");
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

    expect(await screen.findAllByText("未取得")).toHaveLength(29); // 包括圖幅標題欄的積金局基金類型
    expect(screen.getByText(/不足以判定官方沒有披露/)).toBeVisible();
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
    expect(screen.getAllByText("未取得").length).toBeGreaterThan(0);
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
      await screen.findByText("HK$12974.87 百萬（截至 2026-07-31）"),
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
    expect(screen.getByText(/基金規模已超出網站時效門檻/)).toBeVisible();
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

    expect(await screen.findByText("回報資料過期")).toBeVisible();
    expect(
      screen.getByText(
        new RegExp(`超出網站時效門檻.*${fixture.fundClass.dataAsOf}`),
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

    expect(await screen.findByText("回報資料現行")).toBeVisible();
    expect(screen.queryByText("回報資料過期")).not.toBeInTheDocument();
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
        `${fixture.fundClass.schemeName} · ${fixture.fundClass.fundType}／${fixture.fundClass.fundCategory}`,
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
    expect(within(fiveYear).getByText("4.2%")).toBeVisible();
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
    expect(within(fiveYear).getByText("4.2%")).toBeVisible();
    expect(within(fiveYear).getByText("未取得")).toBeVisible();
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

  function renderWithDisclosure(
    factSheetDisclosure: unknown,
    extra: Record<string, unknown> = {},
  ) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          snapshotId: "snapshot-fact-sheet",
          fundClass: fixture.fundClass,
          provenance: {
            sourceUrl: fixture.source.url,
            dataAsOf: "2026-07-31",
            retrievedAt: "2026-08-29T00:00:00Z",
            verificationStatus: "verified",
          },
          ...(factSheetDisclosure ? { factSheetDisclosure } : {}),
          ...extra,
        }),
      ),
    );
    render(
      <FundClassPage apiBaseUrl="https://api.test" fundClassId="disclosed" />,
    );
  }

  const disclosure = {
    factSheetFile: "MT00172.pdf",
    factSheetUrl: "https://www.mpfa.org.hk/assets/FF/MT00172.pdf",
    factSheetSource: "mpfa-registry",
    factSheetAsOf: "2025-11-30",
    allocations: [
      {
        heading: "ASSET ALLOCATION 資產分佈",
        entries: [
          { label: "中國China", percent: 62.61 },
          { label: "現金及其他Cash and Others", percent: 0.7 },
        ],
      },
    ],
    topHoldings: [
      { rank: 1, security: "騰訊控股TENCENT HOLDINGS LTD", percent: 9.36 },
    ],
    unavailableFields: [],
    unavailableReasons: {},
    unavailableKinds: {},
  };

  it("shows the fact sheet allocation and holdings under their own headings", async () => {
    renderWithDisclosure(disclosure);

    const allocation = await screen.findByRole("table", {
      name: "ASSET ALLOCATION 資產分佈",
    });
    expect(
      within(allocation).getByRole("rowheader", { name: "中國China" }),
    ).toBeVisible();
    expect(within(allocation).getByText("62.61%")).toBeVisible();
    // 披露寫 0.7，補成 0.70 就係改寫官方數字。
    expect(within(allocation).getByText("0.7%")).toBeVisible();

    const holdings = screen.getByRole("table", { name: "十大持倉" });
    expect(
      within(holdings).getByText("騰訊控股TENCENT HOLDINGS LTD"),
    ).toBeVisible();
    expect(within(holdings).getByText("9.36%")).toBeVisible();
  });

  it("labels an allocation read from the official chart and keeps its printed figures", async () => {
    renderWithDisclosure({
      ...disclosure,
      allocations: [
        {
          heading: "Portfolio Allocation 投資組合分佈",
          entries: [
            { label: "金融 Financials", percent: 71.2, printed: "71.20%" },
            {
              label: "現金及其他 Cash & Others",
              percent: 28.8,
              printed: "28.80%",
            },
          ],
        },
      ],
      allocationSource: {
        method: "chart-read",
        readAt: "2026-10-04T16:00:00.000Z",
        reads: ["rapidocr-onnxruntime 1.4.4", "tesseract 5.3.4"],
        total: 100,
        page: 22,
      },
    });

    const allocation = await screen.findByRole("table", {
      name: "Portfolio Allocation 投資組合分佈",
    });
    // 圖上印「28.80%」，唔可以食咗尾隨的 0。
    expect(within(allocation).getByText("28.80%")).toBeVisible();
    expect(screen.getByText(/資產配置由官方圖表讀取/)).toHaveTextContent(
      "用兩套文字辨識程式各讀一次，逐個數字核對一致，合計 100%（本站計算）",
    );
  });

  it("separates the document date from the platform snapshot date", async () => {
    renderWithDisclosure(disclosure);

    const factSheet = within(
      await screen.findByRole("region", { name: "投資組合披露" }),
    );
    const notes = await factSheet.findAllByRole("note");
    const dateNote = notes.find((note) =>
      note.textContent?.includes(
        "單憑文件日期未能確認每項披露是否反映同一期別",
      ),
    );

    expect(dateNote).toBeDefined();
    if (!dateNote) throw new Error("The document-date note was not rendered");
    expect(dateNote).toHaveTextContent("2025-11-30");
    expect(dateNote).toHaveTextContent("2026-07-31");
  });

  it("falls back to scheme-level commentary and says so", async () => {
    renderWithDisclosure({
      ...disclosure,
      schemeNarrative: {
        managerCommentary: {
          heading: "MANAGER’S REPORT 基金經理評論",
          zh: "發達市場股市在8月錄得 2.48% 的漲幅。",
          en: "Developed market equities rose 2.48% in August.",
        },
      },
    });

    const direction = within(
      await screen.findByRole("region", { name: "最新投資方向" }),
    );
    expect(
      direction.getByText("發達市場股市在8月錄得 2.48% 的漲幅。"),
    ).toBeVisible();
    expect(direction.getByRole("note")).toHaveTextContent("計劃層面的市場評論");
  });

  it("prefers the fund's own commentary over scheme-level text", async () => {
    renderWithDisclosure({
      ...disclosure,
      narrative: {
        managerCommentary: { heading: "評論", zh: "本基金增持科技股。" },
      },
      schemeNarrative: {
        managerCommentary: { heading: "基金經理評論", zh: "整體市場評論。" },
      },
    });

    const direction = within(
      await screen.findByRole("region", { name: "最新投資方向" }),
    );
    expect(direction.getByText("本基金增持科技股。")).toBeVisible();
    expect(direction.queryByText("整體市場評論。")).not.toBeInTheDocument();
    expect(direction.queryByRole("note")).not.toBeInTheDocument();
  });

  it("keeps the gap when the fund's own commentary exists but cannot be read", async () => {
    renderWithDisclosure({
      ...disclosure,
      narrative: {},
      unavailableFields: ["managerCommentary"],
      unavailableKinds: { managerCommentary: "overlaid-text-layer" },
      schemeNarrative: {
        managerCommentary: { heading: "基金經理評論", zh: "整體市場評論。" },
      },
    });

    const direction = within(
      await screen.findByRole("region", { name: "最新投資方向" }),
    );
    expect(direction.queryByText("整體市場評論。")).not.toBeInTheDocument();
    expect(direction.getByText(/官方文件無法可靠讀取/)).toBeVisible();
  });

  it("states why scheme-level commentary could not be read", async () => {
    renderWithDisclosure({
      ...disclosure,
      unavailableFields: ["schemeNarrative.managerCommentary"],
      unavailableKinds: {
        "schemeNarrative.managerCommentary": "unreadable-layout",
      },
    });

    const direction = within(
      await screen.findByRole("region", { name: "最新投資方向" }),
    );
    expect(direction.getByText(/官方有披露，但本站未能完整讀取/)).toBeVisible();
  });

  it("says the trustee source is simply not transcribed yet", async () => {
    renderWithDisclosure(disclosure);

    expect(
      await screen.findByText(/資料來自積金局便覽庫存放的計劃便覽副本/),
    ).toBeVisible();
    expect(
      screen.getByText(/尚未收錄這個計劃在受託人官網的便覽/),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "查閱這份計劃便覽原文" }),
    ).toHaveAttribute("href", "https://www.mpfa.org.hk/assets/FF/MT00172.pdf");
  });

  it("separates a failed trustee read from one that was never transcribed", async () => {
    // 兩種情況措辭唔同：試過讀唔到，同從來未抄錄，唔可以當成同一句。
    renderWithDisclosure({ ...disclosure, trusteeFallback: true });

    expect(await screen.findByText(/受託人官網那一期未能讀取/)).toBeVisible();
    expect(
      screen.queryByText(/尚未收錄這個計劃在受託人官網的便覽/),
    ).not.toBeInTheDocument();
  });

  it("names the trustee as the source when its own issue was used", async () => {
    renderWithDisclosure({
      ...disclosure,
      factSheetSource: "trustee",
      factSheetUrl: "https://www.bcthk.com/wr/Simple-Fund-Fact-Sheet",
      factSheetAsOf: "2026-03-31",
    });

    expect(
      await screen.findByText(/資料來自受託人官網刊發的計劃便覽/),
    ).toBeVisible();
    expect(
      screen.queryByText(/受託人官網那一期未能取得/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "查閱這份計劃便覽原文" }),
    ).toHaveAttribute(
      "href",
      "https://www.bcthk.com/wr/Simple-Fund-Fact-Sheet",
    );
  });

  it("says the official disclosure is a chart rather than calling it unavailable", async () => {
    renderWithDisclosure({
      ...disclosure,
      allocations: [],
      unavailableFields: ["allocation"],
      unavailableReasons: {
        allocation:
          "the bar chart's labels and percentages are drawn as vector art, not text",
      },
      unavailableKinds: { allocation: "chart-only" },
    });

    expect(await screen.findByText(/資產配置：官方以圖表披露/)).toBeVisible();
    expect(
      screen.queryByRole("table", { name: "ASSET ALLOCATION 資產分佈" }),
    ).not.toBeInTheDocument();
    // 診斷用的英文原因唔應該原封不動出街。
    expect(screen.queryByText(/vector art/)).not.toBeInTheDocument();
  });

  it("keeps calling a block the fact sheet never carried officially unavailable", async () => {
    renderWithDisclosure({
      ...disclosure,
      topHoldings: [],
      unavailableFields: ["topHoldings", "annualizedReturn3y"],
      returnUnavailable: {
        "3": {
          reason: "official-na",
          dataAsOf: "2026-06-30",
          sourceUrl: "https://example.test/official.pdf",
          sourceSha256: "a".repeat(64),
          page: 9,
        },
      },
      unavailableReasons: {
        topHoldings: "no holdings rows in the disclosed block",
      },
      unavailableKinds: { topHoldings: "not-disclosed" },
    });

    expect(await screen.findByText(/十大持倉：官方未提供/)).toBeVisible();
    const row = within(screen.getByRole("table", { name: /^回報$/ }))
      .getByRole("rowheader", { name: "三年" })
      .closest("tr")!;
    expect(row).toHaveTextContent("官方未提供（N/A）");
    expect(row).toHaveTextContent("截至 2026-06-30");
    expect(
      within(row).getByRole("link", { name: "官方便覽（第 9 頁）" }),
    ).toHaveAttribute("href", "https://example.test/official.pdf");
  });

  it("shows only the verbatim allocation table, with no editorial asset-class buckets", async () => {
    renderWithDisclosure(disclosure);

    expect(
      await screen.findByRole("table", { name: "ASSET ALLOCATION 資產分佈" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("table", { name: "編輯歸類的資產類別" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/編輯歸類|非官方分類|三桶/)).toBeNull();
  });

  it("tells a fund without an MPFA fund type apart and offers no group ranking", async () => {
    renderWithDisclosure(undefined, {
      comparisonGroup: "積金局未提供基金類型",
      comparisonGroupFamily: null,
    });

    expect(
      await screen.findByText(/積金局平台沒有為這隻基金提供基金類型/),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "查看同組基金排名" }),
    ).not.toBeInTheDocument();
  });

  it("says so when no fact sheet disclosure pairs with the fund at all", async () => {
    renderWithDisclosure(undefined);

    expect(
      await screen.findByText(/這隻基金未有可對應的計劃便覽披露/),
    ).toBeVisible();
    expect(
      screen.queryByRole("table", { name: "十大持倉" }),
    ).not.toBeInTheDocument();
  });

  function interpretationResponse(
    status: "complete" | "insufficient" = "complete",
  ) {
    const unavailable = status === "insufficient";
    return {
      snapshotId: "snapshot-interpretation-ui",
      fundClassId: "interpretation-ui",
      comparisonGroup: "股票基金 - 香港股票基金",
      comparisonGroupSource: "mpfa",
      values: {
        top10Concentration: {
          fund: unavailable ? null : 33,
          groupAverage: unavailable ? null : 30,
        },
        volatility3y: {
          fund: unavailable ? null : 17,
          groupAverage: unavailable ? null : 20,
        },
      },
      provenance: {
        top10Concentration: {
          fundSourceLabel: "受託人基金便覽",
          fundSourceUrl: "https://source.test/fund-factsheet.pdf",
          fundFieldAsOf: "2026-05-31",
          fundDocumentAsOf: "2026-05-31",
          groupSourceLabel: "同組已核實基金便覽樣本（來源各異）",
          groupSampleCount: unavailable ? 2 : 8,
          groupMemberCount: unavailable ? 2 : 12,
          groupSampleDates: {
            from: "2026-03-31",
            to: "2026-05-31",
            undatedCount: 2,
          },
        },
        volatility3y: {
          fundSourceLabel: "積金局基金平台",
          fundSourceUrl: "https://source.test/platform",
          fundFieldAsOf: "2026-08-31",
          fundDocumentAsOf: null,
          groupSourceLabel: "積金局基金平台快照",
          groupSampleCount: unavailable ? 2 : 8,
          groupMemberCount: unavailable ? 2 : 12,
          groupSampleDates: {
            from: "2026-08-31",
            to: "2026-08-31",
            undatedCount: 0,
          },
        },
      },
      interpretation: {
        thresholdVersion: "2026-09-10-trial-1",
        thresholdStatus: "trial",
        top10Concentration: {
          status: unavailable ? "insufficient-sample" : "higher",
          text: unavailable
            ? "十大持倉佔比：同組別樣本不足，未能比較。"
            : "十大持倉佔比 33%，比同組別平均高 3 個百分點。",
        },
        volatility3y: {
          status: unavailable ? "insufficient-sample" : "lower",
          text: unavailable
            ? "3年波幅：同組別樣本不足，未能比較。"
            : "3年波幅 17%，比同組別平均低 3 個百分點。",
        },
      },
    };
  }

  function renderInterpretation(
    status: "complete" | "insufficient" = "complete",
  ) {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        Response.json(
          url.endsWith("/interpretation")
            ? interpretationResponse(status)
            : {
                snapshotId: "snapshot-interpretation-ui",
                fundClass: fixture.fundClass,
                comparisonGroup: "股票基金 - 香港股票基金",
                provenance: {
                  sourceUrl: fixture.source.url,
                  dataAsOf: fixture.fundClass.dataAsOf,
                  retrievedAt: fixture.source.retrievedAt,
                  verificationStatus: "verified",
                },
              },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <FundClassPage
        apiBaseUrl="https://api.test"
        fundClassId="interpretation-ui"
      />,
    );
    return fetchMock;
  }

  it("shows snapshot interpretation text and matching comparison charts", async () => {
    const fetchMock = renderInterpretation();

    fireEvent.click(await screen.findByRole("button", { name: "基金解讀" }));

    expect(
      await screen.findByText(/十大持倉佔比 33%.*高 3 個百分點/),
    ).toBeVisible();
    expect(screen.queryByText(/股票配置|編輯歸類/)).toBeNull();
    expect(screen.getByText(/3年波幅 17%.*低 3 個百分點/)).toBeVisible();
    expect(screen.getByText(/規則版本 2026-09-10-trial-1/)).toBeVisible();
    expect(screen.getAllByText("8 / 12 隻已核實基金有可用數值")).toHaveLength(
      2,
    );
    expect(
      screen.getAllByRole("link", {
        name: "受託人基金便覽（在新分頁開啟）",
      }),
    ).toHaveLength(1);
    expect(
      screen.getByText(
        "2026-03-31 至 2026-05-31；另有 2 筆有值樣本未明示欄位日期",
      ),
    ).toBeVisible();
    expect(
      screen.getAllByText("同組已核實基金便覽樣本（來源各異）"),
    ).toHaveLength(1);
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://api.test/fund-classes/interpretation-ui/interpretation",
    );
  });

  it("shows explicit sample status without partial charts", async () => {
    renderInterpretation("insufficient");

    fireEvent.click(await screen.findByRole("button", { name: "基金解讀" }));

    expect(await screen.findAllByText("樣本不足")).toHaveLength(2);
    expect(screen.getAllByText(/同組別樣本不足，未能比較/)).toHaveLength(2);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
