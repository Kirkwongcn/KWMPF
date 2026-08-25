import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const redirects = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "public", "_redirects"),
  "utf8",
);

const rules = redirects
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"));

describe("_redirects", () => {
  it("has no catch-all fallback, so a missing asset is not answered with the HTML shell", () => {
    const catchAll = rules.filter((rule) => rule.startsWith("/*"));

    expect(catchAll).toEqual([]);
  });

  it("rewrites every real page route to the SPA shell", () => {
    expect(rules).toContain("/schemes / 200");
    expect(rules).toContain("/rankings / 200");
    expect(rules).toContain("/funds / 200");
    expect(rules).toContain("/fund-classes/* / 200");
  });

  it("never targets /index.html, which Pages normalises back into a 308", () => {
    const normalised = rules.filter((rule) => rule.includes("/index.html"));

    expect(normalised).toEqual([]);
  });

  it("claims no rule over /assets/, which Cloudflare Pages serves directly", () => {
    const assetRules = rules.filter((rule) => rule.startsWith("/assets"));

    expect(assetRules).toEqual([]);
  });

  it("uses only status codes Cloudflare Pages supports", () => {
    const supported = new Set(["200", "301", "302", "303", "307", "308"]);

    for (const rule of rules) {
      const code = rule.split(/\s+/)[2];

      expect(supported.has(code ?? "302")).toBe(true);
    }
  });
});
