import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
// Lets a pre-installed Chromium be used when its revision differs from @playwright/test's.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions: { executablePath } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } },
  ],
  webServer: {
    // Run `pnpm build` first; E2E tests the production build. CI builds a root-path copy into E2E_DIST.
    command: `pnpm preview --port ${PORT} --strictPort${process.env.E2E_DIST ? ` --outDir ${process.env.E2E_DIST}` : ""}`,
    port: PORT,
    // The tests open "/", so the preview server must not inherit a subpath base.
    env: { BASE_PATH: "/" },
    reuseExistingServer: !process.env.CI,
  },
});
