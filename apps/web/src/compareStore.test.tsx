import {
  within,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CompareToggle, CompareTray } from "./CompareTray";
import {
  COMPARE_LIMIT,
  readCompareItems,
  toggleCompareItem,
  writeCompareItems,
} from "./compareStore";

afterEach(() => {
  cleanup();
  localStorage.clear();
  writeCompareItems([]);
});

describe("compare list", () => {
  it("keeps at most four distinct funds and ignores a fifth", () => {
    for (const id of ["a", "b", "c", "d", "e"])
      toggleCompareItem({ id, label: `Fund ${id}` });
    expect(readCompareItems().map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(COMPARE_LIMIT).toBe(4);
    toggleCompareItem({ id: "b", label: "Fund b" });
    expect(readCompareItems().map((item) => item.id)).toEqual(["a", "c", "d"]);
  });

  it("treats unreadable stored data as an empty list", () => {
    localStorage.setItem("kwmpf.compare.funds.v1", "{not json");
    expect(readCompareItems()).toEqual([]);
    localStorage.setItem(
      "kwmpf.compare.funds.v1",
      JSON.stringify([{ id: 3 }, { id: "ok", label: "OK" }, "x"]),
    );
    expect(readCompareItems()).toEqual([{ id: "ok", label: "OK" }]);
  });

  it("shows the tray with a compare link once a fund is added", () => {
    render(
      <>
        <CompareToggle item={{ id: "fund-a", label: "Fund A", group: "G1" }} />
        <CompareToggle item={{ id: "fund-b", label: "Fund B", group: "G2" }} />
        <CompareTray />
      </>,
    );
    expect(
      screen.queryByRole("complementary", { name: "比較清單" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "加入比較：Fund A" }));
    fireEvent.click(screen.getByRole("button", { name: "加入比較：Fund B" }));
    expect(screen.getByText("已選 2/4")).toBeVisible();
    expect(screen.getByText("不同基金類型，只作並列")).toBeVisible();
    expect(screen.getByRole("link", { name: "並列比較" })).toHaveAttribute(
      "href",
      "/funds/compare?ids=fund-a,fund-b",
    );
    fireEvent.click(
      within(screen.getByRole("complementary", { name: "比較清單" })).getByRole(
        "button",
        { name: "從比較移除：Fund A" },
      ),
    );
    expect(screen.getByText("已選 1/4")).toBeVisible();
  });
});
