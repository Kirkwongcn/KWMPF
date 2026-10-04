import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NarrativeBlock } from "./FundNarrative";

afterEach(cleanup);

const commentary = {
  heading: "評論 Commentary",
  zh: "• 第一段。\n• 第二段，貸款增速放緩至5.6%。\n• 第三段。",
  en: "• First point.\n• Second point, loan growth slowed to 5.6%.\n• Third point.",
};

describe("official narrative block", () => {
  it("shows the trustee text verbatim with its own date and source", () => {
    render(
      <NarrativeBlock
        id="t"
        title="最新投資方向"
        text={commentary}
        missing="未取得"
        source={{ url: "https://example.test/ffs.pdf", label: "開啟官方便覽" }}
        date={{ asOf: "2026-06-30", label: "便覽截至（評論未另註日期）" }}
        today={new Date("2026-10-04T00:00:00Z")}
      />,
    );
    expect(screen.getByText("第二段，貸款增速放緩至5.6%。")).toBeVisible();
    expect(screen.getByText(/受託人便覽原文，本站未改寫/)).toHaveTextContent(
      "便覽截至（評論未另註日期） 2026-06-30（距今 96 日）",
    );
    expect(screen.getByRole("link", { name: "開啟官方便覽" })).toHaveAttribute(
      "href",
      "https://example.test/ffs.pdf",
    );
  });

  it("switches language without translating", () => {
    render(
      <NarrativeBlock
        id="t"
        title="投資目標"
        text={commentary}
        missing="未取得"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(
      screen.getByText("Second point, loan growth slowed to 5.6%."),
    ).toBeVisible();
    expect(screen.queryByText("第一段。")).not.toBeInTheDocument();
  });

  it("collapses long commentary and expands to the full text", () => {
    render(
      <NarrativeBlock
        id="t"
        title="最新投資方向"
        text={commentary}
        missing="未取得"
        collapsible
      />,
    );
    expect(screen.queryByText("第三段。")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "展開全文（共 3 段）" }),
    );
    expect(screen.getByText("第三段。")).toBeVisible();
  });

  it("offers no language switch when only one language was disclosed", () => {
    render(
      <NarrativeBlock
        id="t"
        title="投資目標"
        text={{ heading: "Objective", en: "Seeks growth." }}
        missing="未取得"
      />,
    );
    expect(screen.getByText("Seeks growth.")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "中文" }),
    ).not.toBeInTheDocument();
  });

  it("labels commentary shared by several funds in the same fact sheet", () => {
    render(
      <NarrativeBlock
        id="t"
        title="最新投資方向"
        text={{ ...commentary, sharedAcrossFunds: 3 }}
        missing="未取得"
      />,
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      "受託人同一期便覽內 3 隻基金共用這段文字，屬計劃整體的市場評論，並非這隻基金專屬。",
    );
  });

  it("states the gap instead of inventing text", () => {
    render(
      <NarrativeBlock
        id="t"
        title="投資目標"
        missing="官方未提供。這份便覽沒有披露這一項。"
      />,
    );
    expect(
      screen.getByText("官方未提供。這份便覽沒有披露這一項。"),
    ).toBeVisible();
  });
});
