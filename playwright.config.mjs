// End-to-end tests for the built site. Run: npm run test:e2e (builds first, then runs every spec in tests/e2e).
// The suite serves _site on port 8941 with scripts/serve-site.mjs and stops the server when it finishes.
import { defineConfig } from "@playwright/test";

const PORT = 8941;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.mjs",
  fullyParallel: true,
  // Other work shares this PC, so keep the worker count modest.
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["list"], ["json", { outputFile: "test-results/e2e-results.json" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1366, height: 900 } },
    },
    {
      name: "phone",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36",
      },
    },
  ],
  webServer: {
    command: `node scripts/serve-site.mjs --port ${PORT} --dir _site`,
    url: `http://127.0.0.1:${PORT}/`,
    // Never borrow a server someone else started on this port.
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
