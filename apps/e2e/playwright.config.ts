import { defineConfig, devices } from "@playwright/test";

const apiPort = Number(process.env.KWMPF_E2E_API_PORT ?? 8799);
const webPort = Number(process.env.KWMPF_E2E_WEB_PORT ?? 4179);
const apiUrl = `http://127.0.0.1:${apiPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: webUrl,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: [
    {
      command: "bash ../../scripts/e2e-serve-api.sh",
      url: `${apiUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      stderr: "pipe",
    },
    {
      command: `bunx vite build --outDir dist-e2e && bunx vite preview --outDir dist-e2e --port ${webPort} --strictPort`,
      cwd: "../web",
      url: webUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_API_URL: apiUrl },
      stderr: "pipe",
    },
  ],
});
