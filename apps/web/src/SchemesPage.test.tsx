import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SchemesPage } from "./SchemesPage";

describe("scheme comparison page", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps site navigation and the sitewide disclaimer available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json([
          {
            schemeName: "Scheme One",
            trusteeName: "Trustee One",
            fundClassCount: 2,
            fundTypes: ["Equity Fund"],
            riskClassDistribution: { "5": 2 },
            funds: [
              {
                id: "fund-a",
                constituentFundName: "Growth Fund",
                fundClassName: "Class A",
                fundType: "Equity Fund",
                riskClass: 5,
              },
              {
                id: "fund-b",
                constituentFundName: "Stable Fund",
                fundClassName: "Class B",
                fundType: "Bond Fund",
              },
            ],
          },
        ]),
      ),
    );

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    expect(
      await screen.findByRole("heading", { name: "Scheme One" }),
    ).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "主要導覽" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "基金排名" })).toHaveAttribute(
      "href",
      "/rankings",
    );
    expect(screen.getByRole("link", { name: "KWMPF 首頁" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.getByText(/本網站只提供資料比較及投資教育，不構成投資建議/),
    ).toBeVisible();
  });

  it("lists funds by official name and links to each fund class page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json([
          {
            schemeName: "Scheme One",
            trusteeName: "Trustee One",
            fundClassCount: 2,
            fundTypes: ["Equity Fund", "Bond Fund"],
            riskClassDistribution: { "5": 1 },
            funds: [
              {
                id: "fund-a",
                constituentFundName: "Growth Fund",
                fundClassName: "Class A",
                fundType: "Equity Fund",
                riskClass: 5,
              },
              {
                id: "fund-b",
                constituentFundName: "Stable Fund",
                fundClassName: "Class B",
                fundType: "Bond Fund",
              },
            ],
          },
        ]),
      ),
    );

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    const growth = await screen.findByRole("link", {
      name: /Growth Fund/,
    });
    expect(growth).toHaveAttribute("href", "/fund-classes/fund-a");
    expect(growth).toHaveTextContent("Class A");
    expect(screen.getByText("風險級別 5")).toBeVisible();
    expect(screen.getByText("風險級別官方未提供")).toBeVisible();
    expect(screen.queryByText("fund-a")).not.toBeInTheDocument();
  });
  it("titles the browser tab with the scheme comparison page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    expect(document.title).toBe("強積金計劃比較｜KWMPF");
  });
  it("compares official management fees and says how many funds they cover", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json([
          {
            schemeName: "Cheap Scheme",
            trusteeName: "Trustee One",
            fundClassCount: 4,
            fundTypes: ["Equity Fund"],
            riskClassDistribution: { "5": 4 },
            managementFee: {
              min: 0.75,
              median: 1.05,
              max: 1.55,
              fundCount: 3,
            },
            funds: [],
          },
          {
            schemeName: "Unknown Fee Scheme",
            trusteeName: "Trustee Two",
            fundClassCount: 2,
            fundTypes: ["Bond Fund"],
            riskClassDistribution: {},
            managementFee: null,
            funds: [],
          },
        ]),
      ),
    );

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    expect(await screen.findByText("0.75% – 1.55%")).toBeVisible();
    expect(screen.getByText("中位數 1.05%")).toBeVisible();
    expect(screen.getByText("4 隻基金中 3 隻有官方管理費")).toBeVisible();
    expect(screen.getByText("官方未提供")).toBeVisible();
  });
  it("sorts schemes by median official fee and keeps unknown fees last", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json([
          {
            schemeName: "Unknown Fee Scheme",
            trusteeName: "T",
            fundClassCount: 1,
            fundTypes: [],
            riskClassDistribution: {},
            managementFee: null,
            funds: [],
          },
          {
            schemeName: "Pricey Scheme",
            trusteeName: "T",
            fundClassCount: 1,
            fundTypes: [],
            riskClassDistribution: {},
            managementFee: { min: 1.4, median: 1.4, max: 1.4, fundCount: 1 },
            funds: [],
          },
          {
            schemeName: "Cheap Scheme",
            trusteeName: "T",
            fundClassCount: 1,
            fundTypes: [],
            riskClassDistribution: {},
            managementFee: { min: 0.6, median: 0.6, max: 0.6, fundCount: 1 },
            funds: [],
          },
        ]),
      ),
    );

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    expect(await screen.findByLabelText("排序")).toBeVisible();
    fireEvent.change(screen.getByLabelText("排序"), {
      target: { value: "fee" },
    });

    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((node) => node.textContent),
    ).toEqual(["Cheap Scheme", "Pricey Scheme", "Unknown Fee Scheme"]);
  });
  it("leads each card with the fee and keeps long fund type lists collapsed", async () => {
    const fundTypes = Array.from(
      { length: 12 },
      (_, index) => `Mixed Assets Fund - Long Descriptor ${index}`,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json([
          {
            schemeName: "Wide Scheme",
            trusteeName: "T",
            fundClassCount: 21,
            fundTypes,
            riskClassDistribution: { "4": 21 },
            managementFee: {
              min: 0.65,
              median: 1.03,
              max: 1.31,
              fundCount: 21,
            },
            funds: [],
          },
        ]),
      ),
    );

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    const card = (await screen.findByRole("heading", { level: 3 })).closest(
      "article",
    );
    const terms = Array.from(card?.querySelectorAll("dt") ?? []).map(
      (node) => node.textContent,
    );
    expect(terms[0]).toBe("官方管理費");

    const fundTypeSummary = screen.getByText("基金種類（12）");
    expect(fundTypeSummary.closest("details")).not.toHaveAttribute("open");
    expect(fundTypeSummary.closest("details")).toHaveTextContent(fundTypes[0]!);
  });
});

describe("scheme fund returns", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const schemeWithReturns = [
    {
      schemeName: "Return Scheme",
      trusteeName: "Trustee One",
      fundClassCount: 2,
      fundTypes: ["Equity Fund", "Bond Fund"],
      riskClassDistribution: { "5": 1 },
      managementFee: { min: 0.8, median: 0.9, max: 1.0, fundCount: 2 },
      funds: [
        {
          id: "fund-full",
          constituentFundName: "Growth Fund",
          fundClassName: "Class A",
          fundType: "Equity Fund",
          riskClass: 5,
          annualizedReturn1y: 6.09,
          annualizedReturn5y: 4.2,
          annualizedReturn10y: 9.41,
        },
        {
          id: "fund-short",
          constituentFundName: "New Fund",
          fundClassName: "Class B",
          fundType: "Bond Fund",
          annualizedReturn1y: 2.5,
        },
      ],
    },
  ];

  it("shows each fund's one-year annualized return by default", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(schemeWithReturns)),
    );

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    expect(await screen.findByText("一年年率化 6.09%")).toBeVisible();
    expect(screen.getByText("一年年率化 2.50%")).toBeVisible();
  });

  it("switches every fund to the selected return horizon", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(schemeWithReturns)),
    );

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    expect(await screen.findByLabelText("回報期間")).toBeVisible();
    fireEvent.change(screen.getByLabelText("回報期間"), {
      target: { value: "10" },
    });

    expect(screen.getByText("十年年率化 9.41%")).toBeVisible();
    expect(screen.getByText("十年年率化官方未提供")).toBeVisible();
    expect(screen.queryByText(/一年年率化/)).not.toBeInTheDocument();
  });

  it("says how many funds carry the selected horizon", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(schemeWithReturns)),
    );

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    expect(await screen.findByText("2 隻基金中 2 隻有一年回報")).toBeVisible();

    fireEvent.change(screen.getByLabelText("回報期間"), {
      target: { value: "5" },
    });

    expect(screen.getByText("2 隻基金中 1 隻有五年回報")).toBeVisible();
  });

  it("warns that returns across different fund types are not comparable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(schemeWithReturns)),
    );

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    expect(
      await screen.findByText(
        /不同基金種類的回報不能直接比較.*同組比較請使用基金排名/,
      ),
    ).toBeVisible();
  });
});

describe("scheme funds without a separate class", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("omits the official n.a. placeholder from the fund list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json([
          {
            schemeName: "Scheme One",
            trusteeName: "Trustee One",
            fundClassCount: 1,
            fundTypes: ["Equity Fund"],
            riskClassDistribution: { "5": 1 },
            funds: [
              {
                id: "fund-na",
                constituentFundName: "Growth Fund",
                fundClassName: "n.a.",
                fundType: "Equity Fund",
                riskClass: 5,
              },
            ],
          },
        ]),
      ),
    );

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    const fundLink = await screen.findByRole("link", { name: /Growth Fund/ });
    expect(fundLink).toBeVisible();
    expect(fundLink).toHaveTextContent("Equity Fund");
    expect(fundLink).not.toHaveTextContent(/n\.a\./i);
    expect(screen.queryByText(/n\.a\./i)).not.toBeInTheDocument();
  });
});

describe("scheme data-as-of dates", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const schemes = [
    {
      schemeName: "Mixed Dates Scheme",
      trusteeName: "Trustee One",
      fundClassCount: 2,
      fundTypes: ["Equity Fund"],
      riskClassDistribution: { "5": 2 },
      managementFee: { min: 0.8, median: 0.9, max: 1, fundCount: 2 },
      dataAsOf: { earliest: "2026-05-31", latest: "2026-07-31" },
      funds: [
        {
          id: "fund-early",
          constituentFundName: "Growth Fund",
          fundClassName: "Class A",
          fundType: "Equity Fund",
          riskClass: 5,
          dataAsOf: "2026-05-31",
          annualizedReturn1y: 6.09,
        },
        {
          id: "fund-late",
          constituentFundName: "Stable Fund",
          fundClassName: "Class B",
          fundType: "Equity Fund",
          riskClass: 5,
          dataAsOf: "2026-07-31",
          annualizedReturn1y: 2.5,
        },
      ],
    },
    {
      schemeName: "Single Date Scheme",
      trusteeName: "Trustee Two",
      fundClassCount: 1,
      fundTypes: ["Bond Fund"],
      riskClassDistribution: { "3": 1 },
      managementFee: null,
      dataAsOf: { earliest: "2026-07-31", latest: "2026-07-31" },
      funds: [
        {
          id: "fund-single",
          constituentFundName: "Bond Fund One",
          fundClassName: "Class A",
          fundType: "Bond Fund",
          riskClass: 3,
          dataAsOf: "2026-07-31",
        },
      ],
    },
    {
      schemeName: "Undated Scheme",
      trusteeName: "Trustee Three",
      fundClassCount: 1,
      fundTypes: ["Equity Fund"],
      riskClassDistribution: {},
      managementFee: null,
      dataAsOf: null,
      funds: [
        {
          id: "fund-undated",
          constituentFundName: "Unknown Fund",
          fundClassName: "Class A",
          fundType: "Equity Fund",
        },
      ],
    },
  ];

  it("shows one date when every fund in a scheme shares it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(schemes)));

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    expect(await screen.findByText("2026-07-31")).toBeVisible();
    expect(screen.getAllByText("資料截至").length).toBe(3);
  });

  it("shows a date range when funds in a scheme carry different dates", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(schemes)));

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    expect(await screen.findByText("2026-05-31 – 2026-07-31")).toBeVisible();
  });

  it("states when the scheme has no official date at all", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(schemes)));

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    expect(await screen.findByText("官方未提供日期")).toBeVisible();
  });

  it("does not repeat the date on every fund when the scheme states one date", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(schemes)));

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    const fundItem = (
      await screen.findByRole("link", { name: /Bond Fund One/ })
    ).closest("li")!;
    expect(fundItem).not.toHaveTextContent("截至");
  });

  it("labels each published return with the date it was measured on", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(schemes)));

    render(<SchemesPage apiBaseUrl="https://api.test" />);

    const fundItem = (
      await screen.findByRole("link", { name: /Growth Fund/ })
    ).closest("li")!;
    expect(fundItem).toHaveTextContent("6.09%");
    expect(fundItem).toHaveTextContent("截至 2026-05-31");

    const undated = screen
      .getByRole("link", { name: /Unknown Fund/ })
      .closest("li")!;
    expect(undated).not.toHaveTextContent("截至");
  });
});
