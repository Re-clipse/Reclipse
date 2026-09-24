import { defineConfig, devices } from '@playwright/test';

// NOTE: @playwright/test is pinned to an EXACT version in package.json
// (1.56.0, not ^1.56.0) because it must match the Chromium revision that
// ships pre-installed in this environment (chromium-1194 under
// PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers). A newer @playwright/test
// expects a newer bundled Chromium revision and will fail to launch with
// "Executable doesn't exist" until `npx playwright install` downloads it —
// bump the pin and the installed browser together, deliberately.

const PORT = process.env.PORT || 3211;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Retries exist to *measure* flakiness (pass-on-retry is a signal to
  // investigate), never to paper over a real race. Locally: 0. In CI: 1,
  // purely so a flaky run is visible in the report rather than silently red.
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Boots the real Next.js app (against dummy local-only env vars — see
  // .env.local / tests/e2e/README.md) and reuses it across a local watch
  // loop, but always starts fresh in CI.
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
