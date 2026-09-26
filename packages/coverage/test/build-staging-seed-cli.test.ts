import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const seedScript = fileURLToPath(
  new URL("../src/build-staging-seed.ts", import.meta.url),
);

it("requires a trustee return overlay instead of falling back to a stale file", () => {
  const result = spawnSync(
    "bun",
    [seedScript, "--source", "unused-source.json", "--output", "unused-seed.sql"],
    { encoding: "utf8" },
  );

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("--return-observations");
});
