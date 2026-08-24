import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SiteChrome } from "./SiteChrome";

describe("site chrome metadata", () => {
  afterEach(cleanup);

  it("gives each page its own document title", () => {
    render(
      <SiteChrome eyebrow="同組基金比較" title="五年回報排名">
        <p>內容</p>
      </SiteChrome>,
    );

    expect(document.title).toBe("五年回報排名｜KWMPF");
  });

  it("publishes the page subtitle as the meta description", () => {
    render(
      <SiteChrome
        eyebrow="基金詳情"
        title="Principal Hong Kong Equity Fund"
        subtitle="Class I · Equity Fund／Hong Kong Equity"
      >
        <p>內容</p>
      </SiteChrome>,
    );

    expect(document.title).toBe("Principal Hong Kong Equity Fund｜KWMPF");
    expect(
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content"),
    ).toBe("Class I · Equity Fund／Hong Kong Equity");
  });

  it("keeps the site name alone on the home page", () => {
    render(
      <SiteChrome eyebrow="香港強積金研究" title="KWMPF" isHome>
        <p>內容</p>
      </SiteChrome>,
    );

    expect(document.title).toBe("KWMPF｜香港強積金比較");
    expect(screen.getByRole("navigation", { name: "主要導覽" })).toBeVisible();
  });
});
