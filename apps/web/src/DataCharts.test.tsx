import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ValueBars, AllocationChart } from "./DataCharts";
import { csvText } from "./downloadCsv";
afterEach(cleanup);
describe("honest data graphics", () => {
  it("preserves precision, zero and negatives while omitting missing bars", () => {
    const { container } = render(
      <ValueBars
        label="回報"
        rows={[
          { label: "A", value: 1.205 },
          { label: "B", value: 0 },
          { label: "C", value: -2.63 },
          { label: "D" },
        ]}
      />,
    );
    expect(screen.getAllByText("1.205%")[0]).toBeVisible();
    expect(screen.getByText("0%")).toBeVisible();
    expect(screen.getAllByText("-2.63%")[0]).toBeVisible();
    expect(container.querySelectorAll(".kw-bars__bar")).toHaveLength(3);
    expect(
      container.querySelector(".kw-bars__bar--negative"),
    ).toBeInTheDocument();
    expect(screen.getByText("官方未提供")).toBeVisible();
  });
  it("does not invent an allocation bucket for partial totals", () => {
    const { container } = render(
      <AllocationChart
        heading="配置"
        entries={[
          { label: "Stocks", percent: 60 },
          { label: "Bonds", percent: 20 },
        ]}
      />,
    );
    expect(container.querySelector(".kw-allocation__track")).toBeNull();
    expect(screen.queryByText("其他")).toBeNull();
    expect(screen.getAllByText("60%")[0]).toBeVisible();
  });
  it("uses complete allocation proportions without rewriting labels", () => {
    const { container } = render(
      <AllocationChart
        heading="原文標題"
        entries={[
          { label: "Equity", percent: 60.1 },
          { label: "Bond", percent: 39.9 },
        ]}
      />,
    );
    expect(container.querySelectorAll(".kw-allocation__part")).toHaveLength(2);
    expect(screen.getByText("60.1%")).toBeVisible();
  });
  it("escapes CSV formulas and quotations and preserves decimals", () => {
    const csv = csvText([['=HYPERLINK("bad")', 1.205, -2.63, null]]);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"1.205"');
    expect(csv).toContain('"-2.63"');
    expect(csv).toContain('"官方未提供"');
  });
});
