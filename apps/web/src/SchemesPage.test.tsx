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
});
