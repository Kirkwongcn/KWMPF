import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("health API", () => {
  it("reports the release and required storage bindings without exposing identifiers", async () => {
    const response = await SELF.fetch("https://kwmpf.test/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      version: "development",
      bindings: { d1: true, r2: true },
    });
  });
});
