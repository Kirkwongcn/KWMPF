import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PeerFeatures } from "./PeerFeatures";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const response = {
  snapshotId: "snapshot-1",
  fundClassId: "mpfa-cf-502",
  comparisonGroup: "股票基金 - 香港股票基金",
  groupMemberCount: 46,
  methodology: {
    rule: "本站計算：同一積金局基金類型、同一快照內已核實及未過期的官方數值；同值同名次；四分位按同類隻數計。只表示位置，不代表較佳或較差。",
    minPeersForQuartile: 4,
  },
  positions: [
    {
      key: "fundSize",
      value: 1234.5,
      asOf: "2026-08-31",
      peerCount: 40,
      rank: 3,
      quartile: 1,
      median: 456.789,
      order: "descending",
    },
    {
      key: "fundAge",
      value: 9131,
      asOf: "2001-10-01",
      peerCount: 46,
      rank: 10,
      quartile: 1,
      median: 4000,
      order: "descending",
    },
    {
      key: "volatility",
      excludedReason: "stale",
      staleValue: 21.35,
      asOf: "2025-12-31",
      peerCount: 38,
      median: 22.1,
      order: "ascending",
    },
    {
      key: "managementFee",
      value: 0.75,
      feeCap: true,
      asOf: "2026-08-31",
      peerCount: 3,
      rank: 2,
      median: 0.8,
      order: "ascending",
    },
  ],
};

function renderWith(body: unknown, snapshotId = "snapshot-1") {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
  render(
    <PeerFeatures
      apiBaseUrl="https://api.test"
      fundClassId="mpfa-cf-502"
      snapshotId={snapshotId}
    />,
  );
}

describe("same-type position under fund features", () => {
  it("shows official values verbatim and labels derived figures", async () => {
    renderWith(response);
    const list = await screen.findByRole("list");
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.firstChild?.textContent)).toEqual([
      "基金規模",
      "成立年期",
      "波幅（基金風險指標）",
      "管理費",
    ]);
    expect(rows[0]).toHaveTextContent("HK$1234.5 百萬");
    expect(rows[0]).toHaveTextContent("同類 40 隻中第 3 大");
    expect(rows[0]).toHaveTextContent("同類中位數 HK$456.79 百萬（本站計算）");
    expect(
      within(rows[0]!).getByRole("img", { name: "較大一端數起的首四分之一" }),
    ).toBeVisible();
    expect(rows[1]).toHaveTextContent(
      "約 25.0 年（成立日期 2001-10-01，本站計算）",
    );
    // 管理費照原值，標上限，置最後。
    expect(rows[3]).toHaveTextContent("0.75%（上限）");
  });

  it("does not rank a stale value and says why", async () => {
    renderWith(response);
    const rows = within(await screen.findByRole("list")).getAllByRole(
      "listitem",
    );
    expect(rows[2]).toHaveTextContent(
      "21.35%（截至 2025-12-31，已超出時效，不作比較）",
    );
    expect(rows[2]).not.toHaveTextContent("第");
  });

  it("gives no quartile when the type has too few eligible funds", async () => {
    renderWith(response);
    const rows = within(await screen.findByRole("list")).getAllByRole(
      "listitem",
    );
    expect(rows[3]).toHaveTextContent("不分四分位");
    expect(within(rows[3]!).queryByRole("img")).not.toBeInTheDocument();
  });

  it("says a value awaiting verification is not compared", async () => {
    renderWith({
      ...response,
      positions: [
        {
          key: "fundSize",
          excludedReason: "unverified",
          peerCount: 12,
          order: "descending",
        },
      ],
    });
    expect(await screen.findByText("官方數值待核實，不作比較")).toBeVisible();
  });

  it("refuses to mix snapshots", async () => {
    renderWith(response, "snapshot-2");
    expect(await screen.findByText(/暫時未能取得同類位置/)).toBeVisible();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("never uses promotional wording", async () => {
    renderWith(response);
    await screen.findByRole("list");
    expect(document.body.textContent).not.toMatch(/推薦|最佳|優質|首選|值得/);
    expect(screen.getByRole("note")).toHaveTextContent(
      "只表示位置，不代表較佳或較差。",
    );
  });
});
