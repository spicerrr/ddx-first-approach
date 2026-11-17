import { defineConfig, devices } from "@playwright/test";

const local = "http://127.0.0.1:4173/ddx-first-approach/";
const remote = process.env.PLAYWRIGHT_BASE_URL;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  timeout: 40_000,
  reporter: "list",
  use: {
    baseURL: remote ?? local,
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "touch", testIgnore: "**/responsive.spec.ts", use: { ...devices["Pixel 7"], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1 } },
  ],
  webServer: remote ? undefined : {
    command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: local,
  },
});
