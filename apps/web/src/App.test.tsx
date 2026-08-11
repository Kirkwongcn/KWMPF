import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("health page", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the release and service state returned by the public API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "ok",
            version: "test-release",
            bindings: { d1: true, r2: true },
          }),
          { status: 200 },
        ),
      ),
    );

    render(<App apiUrl="https://api.test/health" />);

    expect(
      screen.getByRole("heading", { name: "KWMPF 正在建立中" }),
    ).toBeVisible();
    expect(await screen.findByText("test-release")).toBeVisible();
    expect(await screen.findByText("API：正常")).toBeVisible();
    expect(fetch).toHaveBeenCalledWith("https://api.test/health");
  });

  it("does not claim the API is healthy when the health check fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<App apiUrl="https://api.test/health" />);

    expect(await screen.findByText("API：無法連線")).toBeVisible();
    expect(screen.getByText("未能取得")).toBeVisible();
  });
});
